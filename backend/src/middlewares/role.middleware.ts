import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';

/**
 * Requires `authMiddleware` to run first so `req.auth` is set.
 * Returns an Express middleware that allows only the given roles.
 */
export function requireRole(allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    if (!allowed.includes(auth.role)) {
      res.status(403).json({ success: false, message: 'Forbidden', errors: null });
      return;
    }
    next();
  };
}
