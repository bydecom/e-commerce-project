import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { success } from '../../utils/response';
import * as userService from './user.service';

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const role = typeof req.query.role === 'string' &&
      ['USER', 'ADMIN'].includes(req.query.role)
        ? (req.query.role as Role) : undefined;
    const { data, meta } = await userService.listUsers({ page, limit, search, role });
    res.json(success(data, 'OK', meta));
  } catch (err) { next(err); }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const me = await userService.getMe(auth.userId);
    res.json(success(me));
  } catch (err) { next(err); }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const updated = await userService.updateMe(auth.userId, req.body);
    res.json(success(updated, 'Updated'));
  } catch (err) { next(err); }
}
