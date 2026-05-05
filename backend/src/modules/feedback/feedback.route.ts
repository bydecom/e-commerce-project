import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validateBody, validateQuery } from '../../middlewares/validate.middleware';
import { paginationQuerySchema } from '../../utils/pagination-query.schema';
import { createFeedbackSchema, createActionPlanSchema, updateActionPlanSchema } from './feedback.schema';
import * as feedbackController from './feedback.controller';

export const feedbackRouter = Router();

feedbackRouter.get('/product/:id', validateQuery(paginationQuerySchema), feedbackController.listByProduct);
feedbackRouter.post('/',           authMiddleware, validateBody(createFeedbackSchema), feedbackController.createFeedback);
feedbackRouter.get('/',            authMiddleware, requireRole(['ADMIN']), validateQuery(paginationQuerySchema), feedbackController.listAdminFeedbacks);
feedbackRouter.post('/:id/action-plans',      authMiddleware, requireRole(['ADMIN']), validateBody(createActionPlanSchema), feedbackController.createActionPlan);
feedbackRouter.patch('/action-plans/:planId', authMiddleware, requireRole(['ADMIN']), validateBody(updateActionPlanSchema), feedbackController.updateActionPlan);
feedbackRouter.delete('/action-plans/:planId', authMiddleware, requireRole(['ADMIN']), feedbackController.deleteActionPlan);
