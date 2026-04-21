import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import * as feedbackController from './feedback.controller';

export const feedbackRouter = Router();

feedbackRouter.get('/product/:id', feedbackController.listByProduct);
feedbackRouter.post('/', authMiddleware, feedbackController.createFeedback);
feedbackRouter.get('/', authMiddleware, requireRole(['ADMIN']), feedbackController.listAdminFeedbacks);

// Action Plans
feedbackRouter.post('/:id/action-plans', authMiddleware, requireRole(['ADMIN']), feedbackController.createActionPlan);
feedbackRouter.patch('/action-plans/:planId', authMiddleware, requireRole(['ADMIN']), feedbackController.updateActionPlan);
feedbackRouter.delete('/action-plans/:planId', authMiddleware, requireRole(['ADMIN']), feedbackController.deleteActionPlan);
