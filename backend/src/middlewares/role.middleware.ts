import type { Request, Response, NextFunction } from 'express';

/** TODO: attach user role from JWT and compare */
export function requireRole(_role: 'ADMIN' | 'USER') {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
}
