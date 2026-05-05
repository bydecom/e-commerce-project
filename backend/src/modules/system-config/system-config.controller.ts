import type { NextFunction, Request, Response } from 'express';
import { httpError } from '../../utils/http-error';
import { success } from '../../utils/response';
import * as systemConfigService from './system-config.service';

export async function getPublic(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idle_timeout_seconds = await systemConfigService.getConfigInt('idle_timeout_seconds', 900);
    res.json(success({ idle_timeout_seconds }, 'OK'));
  } catch (err) { next(err); }
}

export async function getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const configs = await systemConfigService.getAllConfigs();
    res.json(success(configs, 'OK'));
  } catch (err) { next(err); }
}

export async function updateOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = String(req.params['key'] ?? '').trim();
    if (!key) throw httpError(400, 'Key is required');
    const { value } = req.body;
    const updated = await systemConfigService.updateConfig(key, value);
    res.json(success(updated, 'Config updated'));
  } catch (err) { next(err); }
}

export async function bulkUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { configs } = req.body;
    const entries = configs.map((e: { key: string; value: string }) => ({
      key: e.key.trim(),
      value: e.value,
    }));
    const results = await systemConfigService.bulkUpdateConfigs(entries);
    res.json(success(results, 'Configs updated'));
  } catch (err) { next(err); }
}
