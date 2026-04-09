import type { Request, Response, NextFunction } from 'express';

export function errorMiddleware(
  err: { status?: number; message?: string; errors?: unknown; stack?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errors: err.errors ?? null,
  });
}
