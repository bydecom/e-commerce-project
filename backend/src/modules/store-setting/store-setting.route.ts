import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { updateStoreSettingSchema } from './store-setting.schema';
import { StoreSettingController } from './store-setting.controller';

export const storeSettingRoute = Router();

storeSettingRoute.get('/', StoreSettingController.get);
storeSettingRoute.put('/', authMiddleware, requireRole(['ADMIN']), validateBody(updateStoreSettingSchema), StoreSettingController.update);
