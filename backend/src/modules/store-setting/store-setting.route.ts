import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { StoreSettingController } from './store-setting.controller';

export const storeSettingRoute = Router();

storeSettingRoute.get('/', StoreSettingController.get);
storeSettingRoute.put('/', authMiddleware, requireRole(['ADMIN']), StoreSettingController.update);
