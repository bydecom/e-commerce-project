import type { NextFunction, Request, Response } from 'express';
import { httpError } from '../../utils/http-error';
import { success } from '../../utils/response';
import * as systemConfigService from './system-config.service';

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const configs = await systemConfigService.getAllConfigs();
    res.json(success(configs, 'OK'));
  } catch (err) {
    next(err);
  }
}

export async function updateOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = String(req.params['key'] ?? '').trim();
    if (!key) throw httpError(400, 'Key is required');

    const body = req.body as { value?: unknown };
    const value = typeof body?.value === 'string' ? body.value : null;
    if (value === null) throw httpError(400, 'value must be a string');

    const updated = await systemConfigService.updateConfig(key, value);
    res.json(success(updated, 'Config updated'));
  } catch (err) {
    next(err);
  }
}

export async function bulkUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as { configs?: unknown };
    if (!Array.isArray(body?.configs)) throw httpError(400, 'configs must be an array');

    const entries = (body.configs as Array<{ key?: unknown; value?: unknown }>)
      .filter((e) => typeof e?.key === 'string' && typeof e?.value === 'string')
      .map((e) => ({ key: (e.key as string).trim(), value: (e.value as string) }));

    if (entries.length === 0) throw httpError(400, 'configs must be a non-empty array of { key, value }');

    const results = await systemConfigService.bulkUpdateConfigs(entries);
    res.json(success(results, 'Configs updated'));
  } catch (err) {
    next(err);
  }
}

