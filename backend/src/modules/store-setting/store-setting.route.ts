import { Router } from 'express';
import { StoreSettingController } from './store-setting.controller';

export const storeSettingRoute = Router();

storeSettingRoute.get('/', StoreSettingController.get);

// TODO: gắn lại authMiddleware + roleMiddleware('ADMIN') sau khi merge auth
storeSettingRoute.put('/', StoreSettingController.update);
