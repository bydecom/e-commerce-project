require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' });
import { app, stopCleanupLoop } from './src/app';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { prisma } from './src/db';
import { redisClient } from './src/config/redis';
import { closeRabbitConnection } from './src/config/rabbitmq';

const PORT = Number(process.env.PORT ?? 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 3443);
const HTTPS_ENABLED = String(process.env.HTTPS_ENABLED ?? '').toLowerCase() === 'true';
const HTTPS_REDIRECT = String(process.env.HTTPS_REDIRECT ?? '').toLowerCase() === 'true';
const TLS_KEY_PATH = process.env.TLS_KEY_PATH;
const TLS_CERT_PATH = process.env.TLS_CERT_PATH;
const HOST = process.env.HOST ?? '0.0.0.0';

// Track all active servers for graceful shutdown
const servers: http.Server[] = [];
let isShuttingDown = false;

// ─── 1.1 Graceful Shutdown Handler ──────────────────────────────────────────
// PM2 sends SIGTERM when reloading/restarting. Without this handler, Node.js
// kills the process immediately — any in-flight request (especially Prisma
// transactions for payment) gets cut mid-way. This handler drains existing
// connections, then closes DB/Redis/RabbitMQ cleanly before exiting.
// ─────────────────────────────────────────────────────────────────────────────
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  // eslint-disable-next-line no-console
  console.log(`\n[Shutdown] ${signal} received — closing gracefully...`);

  // Stop the stock reservation cleanup loop first
  stopCleanupLoop();

  // Force kill after 10s if something is stuck (PM2 default kill_timeout = 1600ms,
  // so we also set kill_timeout: 10000 in ecosystem.config.js to match)
  const forceKillTimer = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('[Shutdown] Force kill — timeout exceeded (10s)');
    process.exit(1);
  }, 10_000);
  forceKillTimer.unref(); // Don't keep the event loop alive just for this timer

  // 1. Stop accepting new connections — existing requests will finish
  const closePromises = servers.map(
    (s) => new Promise<void>((resolve) => s.close(() => resolve())),
  );
  await Promise.allSettled(closePromises);
  // eslint-disable-next-line no-console
  console.log('[Shutdown] HTTP server(s) closed — no new connections');

  // 2. Disconnect external services (best-effort, don't let one failure block others)
  const disconnects = [
    prisma.$disconnect().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[Shutdown] Prisma disconnect error:', err);
    }),
    (async () => {
      try {
        const redis = redisClient();
        if (redis.isOpen) await redis.quit();
      } catch { /* Redis may not have been initialized */ }
    })(),
    closeRabbitConnection().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[Shutdown] RabbitMQ disconnect error:', err);
    }),
  ];
  await Promise.allSettled(disconnects);

  // eslint-disable-next-line no-console
  console.log('[Shutdown] All connections closed — exiting cleanly.');
  process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// ─── 1.2 Unhandled Rejection & Uncaught Exception ──────────────────────────
// Node.js 15+ kills the process on unhandled promise rejections. Background
// workers, Redis reconnects, or forgotten .catch() calls can trigger this.
// We log and initiate graceful shutdown instead of a hard crash.
// ─────────────────────────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
  // Don't exit immediately — give graceful shutdown a chance to drain
  void gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (error: Error) => {
  // eslint-disable-next-line no-console
  console.error('[FATAL] Uncaught Exception:', error);
  // uncaughtException: process state may be corrupt, must exit
  void gracefulShutdown('uncaughtException');
});

// ─── Server startup ────────────────────────────────────────────────────────
function startHttpServer() {
  const server = http.createServer(app);

  // Prevent Slowloris attacks — close idle connections after 30s
  server.keepAliveTimeout = 30_000;
  server.headersTimeout = 35_000;

  servers.push(server);
  server.listen(PORT, HOST, () => {
    // Log actual startup time so listen_timeout can be tuned from real data.
    // After first deploy: `pm2 logs bandai-api`, note the ms, set listen_timeout = ms * 1.5.
    const readyMs = Math.round(performance.now());
    // eslint-disable-next-line no-console
    console.log(`[Startup] Ready in ${readyMs}ms`);
    // Signal PM2 that this instance is ready to accept traffic.
    // Required by `wait_ready: true` in ecosystem.config.js — PM2 won't
    // route requests to this instance until it receives this signal.
    // In non-PM2 environments, process.send is undefined → no-op.
    process.send?.('ready');
    // eslint-disable-next-line no-console
    console.log('========================================');
    // eslint-disable-next-line no-console
    console.log(`Backend: http://localhost:${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`Health:  http://localhost:${PORT}/api/health`);
    // eslint-disable-next-line no-console
    console.log('========================================');
  });
}

function startHttpsServer() {
  if (!TLS_KEY_PATH || !TLS_CERT_PATH) {
    throw new Error('HTTPS is enabled but TLS_KEY_PATH/TLS_CERT_PATH are missing.');
  }

  const key = fs.readFileSync(TLS_KEY_PATH);
  const cert = fs.readFileSync(TLS_CERT_PATH);

  const server = https.createServer({ key, cert }, app);
  server.keepAliveTimeout = 30_000;
  server.headersTimeout = 35_000;

  servers.push(server);

  // Wait for BOTH servers to bind before signalling PM2 ready.
  // Without this, there's a tiny race window where PM2 receives 'ready'
  // and kills the old instance, but the HTTP redirect server hasn't bound
  // yet — causing redirect requests to drop during that window.
  const httpsReady = new Promise<void>((resolve) => {
    server.listen(HTTPS_PORT, HOST, () => {
      const readyMs = Math.round(performance.now());
      // eslint-disable-next-line no-console
      console.log(`[Startup] Ready in ${readyMs}ms`);
      // eslint-disable-next-line no-console
      console.log('========================================');
      // eslint-disable-next-line no-console
      console.log(`Backend: https://localhost:${HTTPS_PORT}`);
      // eslint-disable-next-line no-console
      console.log(`Health:  https://localhost:${HTTPS_PORT}/api/health`);
      // eslint-disable-next-line no-console
      console.log('========================================');
      resolve();
    });
  });

  let redirectReady = Promise.resolve();
  if (HTTPS_REDIRECT) {
    const redirectServer = http.createServer((req, res) => {
      const host = req.headers.host?.split(':')[0] ?? 'localhost';
      const url = req.url ?? '/';
      const portPart = HTTPS_PORT === 443 ? '' : `:${HTTPS_PORT}`;
      res.statusCode = 301;
      res.setHeader('Location', `https://${host}${portPart}${url}`);
      res.end();
    });

    servers.push(redirectServer);
    redirectReady = new Promise<void>((resolve) => {
      redirectServer.listen(PORT, HOST, () => {
        // eslint-disable-next-line no-console
        console.log(`HTTP redirect: http://${HOST}:${PORT} -> https://${HOST}:${HTTPS_PORT}`);
        resolve();
      });
    });
  }

  // Signal PM2 only after ALL servers are fully bound
  void Promise.all([httpsReady, redirectReady]).then(() => {
    process.send?.('ready');
  });
}

if (HTTPS_ENABLED) {
  startHttpsServer();
} else {
  startHttpServer();
}
