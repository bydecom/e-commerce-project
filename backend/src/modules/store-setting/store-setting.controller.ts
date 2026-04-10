import type { NextFunction, Request, Response } from 'express';
import { StoreSettingService } from './store-setting.service';
import { successResponse } from '../../utils/response';

export class StoreSettingController {
  static async get(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const setting = await StoreSettingService.getSetting();
      res.json(successResponse(setting, 'Store setting fetched successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, address, phone, email, logoUrl, description } = req.body as Record<string, unknown>;

      const payload: Parameters<typeof StoreSettingService.updateSetting>[0] = {};
      if (name !== undefined) payload.name = String(name);
      if (address !== undefined) payload.address = address === null ? null : String(address);
      if (phone !== undefined) payload.phone = phone === null ? null : String(phone);
      if (email !== undefined) payload.email = email === null ? null : String(email);
      if (logoUrl !== undefined) payload.logoUrl = logoUrl === null ? null : String(logoUrl);
      if (description !== undefined) payload.description = description === null ? null : String(description);

      const updatedSetting = await StoreSettingService.updateSetting(payload);
      res.json(successResponse(updatedSetting, 'Store setting updated successfully'));
    } catch (error) {
      next(error);
    }
  }
}
