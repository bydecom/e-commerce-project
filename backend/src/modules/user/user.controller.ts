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

function normalizeOptionalString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length === 0 ? null : s;
}
export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const name          = normalizeOptionalString(body['name']);
    const phone         = normalizeOptionalString(body['phone']);
    const provinceId    = normalizeOptionalString(body['provinceId']);
    const districtId    = normalizeOptionalString(body['districtId']);
    const wardId        = normalizeOptionalString(body['wardId']);
    const streetAddress = normalizeOptionalString(body['streetAddress']);
    const fullAddress   = normalizeOptionalString(body['fullAddress']);

    if (name !== undefined && name !== null && name.length > 100) {
      res.status(400).json({ success: false, message: 'name is too long', errors: null });
      return;
    }
    if (phone !== undefined && phone !== null && phone.length > 30) {
      res.status(400).json({ success: false, message: 'phone is too long', errors: null });
      return;
    }
    if (streetAddress !== undefined && streetAddress !== null && streetAddress.length > 200) {
      res.status(400).json({ success: false, message: 'streetAddress is too long', errors: null });
      return;
    }
    if (fullAddress !== undefined && fullAddress !== null && fullAddress.length > 500) {
      res.status(400).json({ success: false, message: 'fullAddress is too long', errors: null });
      return;
    }

    const updated = await userService.updateMe(auth.userId, {
      name,
      phone,
      provinceId,
      districtId,
      wardId,
      streetAddress,
      fullAddress,
    });
    res.json(success(updated, 'Updated'));
  } catch (err) {
    next(err);
  }
}
