import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import * as ctrl from './system-config.controller';

export const systemConfigRouter = Router();

// All endpoints require ADMIN role
systemConfigRouter.use(authMiddleware, requireRole(['ADMIN']));

systemConfigRouter.get('/', ctrl.getAll);
systemConfigRouter.put('/bulk', ctrl.bulkUpdate);
systemConfigRouter.put('/:key', ctrl.updateOne);

