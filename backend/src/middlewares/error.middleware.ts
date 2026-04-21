import type { Request, Response, NextFunction } from 'express';
import { toPrismaHttpError } from '../utils/prisma-error';

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const prismaErr = toPrismaHttpError(err);
  if (prismaErr) {
    if (prismaErr.status >= 500) {
      console.error((err as { stack?: string }).stack ?? String(err));
    }
    res.status(prismaErr.status).json({
      success: false,
      message: prismaErr.message,
      errors: prismaErr.errors,
    });
    return;
  }

  const typed = err as { status?: number; message?: string; errors?: unknown; stack?: string };
  if (typed.stack) console.error(typed.stack);
  res.status(typeof typed.status === 'number' ? typed.status : 500).json({
    success: false,
    message: typed.message || 'Internal Server Error',
    errors: typed.errors ?? null,
  });
}
