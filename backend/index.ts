require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' });
import { app } from './src/app';
import http from 'http';
import https from 'https';
import fs from 'fs';

const PORT = Number(process.env.PORT ?? 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 3443);
const HTTPS_ENABLED = String(process.env.HTTPS_ENABLED ?? '').toLowerCase() === 'true';
const HTTPS_REDIRECT = String(process.env.HTTPS_REDIRECT ?? '').toLowerCase() === 'true';
const TLS_KEY_PATH = process.env.TLS_KEY_PATH;
const TLS_CERT_PATH = process.env.TLS_CERT_PATH;
const HOST = process.env.HOST ?? '0.0.0.0';

function startHttpServer() {
  const server = http.createServer(app);
  server.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log('========================================');
    // eslint-disable-next-line no-console
    console.log(`Backend: http://${HOST}:${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`Health:  http://3.25.162.48:${PORT}/api/health`);
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
  server.listen(HTTPS_PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log('========================================');
    // eslint-disable-next-line no-console
    console.log(`Backend: https://${HOST}:${HTTPS_PORT}`);
    // eslint-disable-next-line no-console
    console.log(`Health:  https://3.25.162.48:${HTTPS_PORT}/api/health`);
    // eslint-disable-next-line no-console
    console.log('========================================');
  });

  if (HTTPS_REDIRECT) {
    const redirectServer = http.createServer((req, res) => {
      const host = req.headers.host?.split(':')[0] ?? 'localhost';
      const url = req.url ?? '/';
      const portPart = HTTPS_PORT === 443 ? '' : `:${HTTPS_PORT}`;
      res.statusCode = 301;
      res.setHeader('Location', `https://${host}${portPart}${url}`);
      res.end();
    });

    redirectServer.listen(PORT, HOST, () => {
      // eslint-disable-next-line no-console
      console.log(`HTTP redirect: http://${HOST}:${PORT} -> https://${HOST}:${HTTPS_PORT}`);
    });
  }
}

if (HTTPS_ENABLED) {
  startHttpsServer();
} else {
  startHttpServer();
}
