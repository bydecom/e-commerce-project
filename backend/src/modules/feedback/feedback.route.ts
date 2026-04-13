import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import * as feedbackController from './feedback.controller';

export const feedbackRouter = Router();

feedbackRouter.get('/product/:id', feedbackController.listByProduct);
feedbackRouter.post('/', authMiddleware, feedbackController.createFeedback);
feedbackRouter.get('/', authMiddleware, requireRole(['ADMIN']), feedbackController.listAdminFeedbacks);
