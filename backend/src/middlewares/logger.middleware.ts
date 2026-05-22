import type { Request, Response, NextFunction } from 'express';

const SKIP_PREFIXES = ['/api/system-logs', '/api/health', '/api-docs'];

export function dbLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PREFIXES.some((p) => req.url.startsWith(p))) {
    next();
    return;
  }

  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const timeInMs = parseFloat((diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2));

    // Log ra stdout thay vì INSERT vào DB
    // PM2 capture → /home/ubuntu/.pm2/logs/bandai-api-out-*.log
    console.log(
      JSON.stringify({
        type: 'http',
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        responseTime: timeInMs,
        timestamp: new Date().toISOString(),
      })
    );
  });

  next();
}
