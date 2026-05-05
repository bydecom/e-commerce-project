/// <reference path="../types/express.d.ts" />
import type { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { httpError } from '../utils/http-error';
import { isJwtBlacklisted } from '../utils/jwt-blacklist';

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next(httpError(500, 'JWT secret is not configured'));
    return;
  }
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    const userId = decoded.userId;
    const role = decoded.role;
    const jti = decoded.jti;
    const exp = decoded.exp;
    if (typeof userId !== 'number' || (role !== 'USER' && role !== 'ADMIN')) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    if (typeof jti !== 'string' || typeof exp !== 'number') {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    if (await isJwtBlacklisted(jti)) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    req.auth = { userId, role, jti, exp };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
}

/**
 * Attach `req.auth` when valid Bearer JWT is present and not blacklisted; if no token / token error / expired, skip (no 401).
 * Used for endpoints that need both guest and logged-in user (e.g. POST /api/ai/chat).
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next();
    return;
  }
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    const userId = decoded.userId;
    const role = decoded.role;
    const jti = decoded.jti;
    const exp = decoded.exp;
    if (typeof userId !== 'number' || (role !== 'USER' && role !== 'ADMIN')) {
      next();
      return;
    }
    if (typeof jti !== 'string' || typeof exp !== 'number') {
      next();
      return;
    }
    if (await isJwtBlacklisted(jti)) {
      next();
      return;
    }
    req.auth = { userId, role, jti, exp };
    next();
  } catch {
    next();
  }
}
