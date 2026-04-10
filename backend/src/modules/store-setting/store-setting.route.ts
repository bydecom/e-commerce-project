import { Router } from 'express';
import { StoreSettingController } from './store-setting.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { roleMiddleware } from '../../middlewares/role.middleware';

export const storeSettingRoute = Router();

storeSettingRoute.get('/', StoreSettingController.get);

storeSettingRoute.put('/', authMiddleware, roleMiddleware('ADMIN'), StoreSettingController.update);
