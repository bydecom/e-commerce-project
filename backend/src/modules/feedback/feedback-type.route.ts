import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import * as feedbackTypeController from './feedback-type.controller';

export const feedbackTypeRouter = Router();

feedbackTypeRouter.post(
  '/demo/analyze',
  authMiddleware,
  requireRole(['ADMIN']),
  feedbackTypeController.demoAnalyzeFeedback
);
feedbackTypeRouter.get('/', feedbackTypeController.listFeedbackTypes);
feedbackTypeRouter.post('/', authMiddleware, requireRole(['ADMIN']), feedbackTypeController.createFeedbackType);
feedbackTypeRouter.patch('/:id', authMiddleware, requireRole(['ADMIN']), feedbackTypeController.updateFeedbackType);
