import type { NextFunction, Request, Response } from 'express';
import { StoreSettingService } from './store-setting.service';
import { successResponse } from '../../utils/response';

export class StoreSettingController {
  static async get(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const setting = await StoreSettingService.getSetting();
      res.json(successResponse(setting, 'Store setting fetched successfully'));
    } catch (error) { next(error); }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, address, phone, email, logoUrl, description } = req.body;
      const updatedSetting = await StoreSettingService.updateSetting({
        name,
        address:     address     ?? null,
        phone:       phone       ?? null,
        email:       email       ?? null,
        logoUrl:     logoUrl     ?? null,
        description: description ?? null,
      });
      res.json(successResponse(updatedSetting, 'Store setting updated successfully'));
    } catch (error) { next(error); }
  }
}
