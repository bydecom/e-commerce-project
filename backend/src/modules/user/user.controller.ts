import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { success } from '../../utils/response';
import * as userService from './user.service';

function parseIdParam(req: Request): number {
  const raw = req.params['id'];
  const s = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(String(s), 10);
  return id;
}

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const { data, meta } = await userService.listUsers({ page, limit, search });
    res.json(success(data, 'OK', meta));
  } catch (err) {
    next(err);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid id', errors: null });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const role = body['role'];
    if (role !== 'USER' && role !== 'ADMIN') {
      res.status(400).json({ success: false, message: 'role must be USER or ADMIN', errors: null });
      return;
    }
    const updated = await userService.updateUserRole(id, role as Role);
    res.json(success(updated));
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    const me = await userService.getMe(auth.userId);
    res.json(success(me));
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const updated = await userService.updateMe(auth.userId, {
      name: typeof body['name'] === 'string' ? body['name'] : null,
      phone: typeof body['phone'] === 'string' ? body['phone'] : null,
      address: typeof body['address'] === 'string' ? body['address'] : null,
    });
    res.json(success(updated, 'Updated'));
  } catch (err) {
    next(err);
  }
}
