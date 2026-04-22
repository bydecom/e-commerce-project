import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import * as userController from './user.controller';

export const userRouter = Router();

userRouter.get('/me', authMiddleware, userController.getMe);
userRouter.patch('/me', authMiddleware, userController.updateMe);

// Admin only
userRouter.get('/', authMiddleware, requireRole(['ADMIN']), userController.listUsers);
