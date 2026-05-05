import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { updateMeSchema } from './user.schema';
import * as userController from './user.controller';

export const userRouter = Router();

userRouter.get('/me',   authMiddleware, userController.getMe);
userRouter.patch('/me', authMiddleware, validateBody(updateMeSchema), userController.updateMe);
userRouter.get('/',     authMiddleware, requireRole(['ADMIN']), userController.listUsers);
