module.exports = {
  apps: [
    {
      name: 'bandai-api',
      script: './dist/index.js',

      // ─── 1.3 PM2 Cluster Mode ──────────────────────────────────────
      // 'max' = use all available CPU cores for the API server.
      // Each instance is a separate Node.js process sharing the same port.
      // Prerequisites (all implemented):
      //   1.1 Graceful shutdown (SIGTERM handler in index.ts)
      //   1.4 Rate limit uses RedisStore (shared counter across instances)
      //   1.5 Cleanup loop uses Redis distributed lock (only 1 instance runs it)
      // ───────────────────────────────────────────────────────────────
      instances: 'max',
      exec_mode: 'cluster',
      node_args: '--dns-result-order=ipv4first',

      autorestart: true,
      watch: false,
      max_memory_restart: '750M',

      // Give graceful shutdown 10s to drain connections before SIGKILL.
      // Must match the forceKillTimer timeout in index.ts.
      kill_timeout: 10000,

      // ─── Zero-downtime reload ──────────────────────────────────────
      // wait_ready: PM2 waits for process.send('ready') from the new
      //   instance before routing traffic to it. Without this, PM2 uses
      //   its own internal timer and may route requests before the app
      //   is fully initialized (Redis/DB connected, routes mounted).
      // listen_timeout: Max time (ms) PM2 waits for the 'ready' signal.
      //   If the new instance doesn't send it in time, PM2 treats it
      //   as a failed start. Production startup measured ~3s, so 8s gives
      //   enough buffer for Neon cold start spikes (connect ~1-2s) + Redis
      //   + module load. Tune: check `pm2 logs` for "Ready in Xms", set
      //   listen_timeout = X * 2.5.
      // In index.ts, server.listen() callback calls process.send?.('ready').
      // ───────────────────────────────────────────────────────────────
      wait_ready: true,
      listen_timeout: 8000,

      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'email-worker',
      script: './dist/src/workers/email.worker.js',

      // Workers should ALWAYS run in fork mode (1 instance).
      // They consume from RabbitMQ which already handles concurrency.
      instances: 1,
      exec_mode: 'fork',
      node_args: '--dns-result-order=ipv4first',

      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      kill_timeout: 5000,
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'ai-worker',
      script: './dist/src/workers/ai.worker.js',
      instances: 1,           // fork mode — 1 instance duy nhất, tránh duplicate job
      exec_mode: 'fork',
      node_args: '--dns-result-order=ipv4first',
      autorestart: true,
      max_memory_restart: '256M',
      env_production: {
        NODE_ENV: 'production',
      },
    }
  ]
};