import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { updateOneSchema, bulkUpdateSchema } from './system-config.schema';
import * as ctrl from './system-config.controller';

export const systemConfigRouter = Router();

systemConfigRouter.get('/public', ctrl.getPublic);
systemConfigRouter.use(authMiddleware, requireRole(['ADMIN']));
systemConfigRouter.get('/', ctrl.getAll);
systemConfigRouter.put('/bulk', validateBody(bulkUpdateSchema), ctrl.bulkUpdate);
systemConfigRouter.put('/:key', validateBody(updateOneSchema), ctrl.updateOne);
