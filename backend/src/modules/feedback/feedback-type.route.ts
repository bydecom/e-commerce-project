import { Router } from 'express';
import * as feedbackTypeController from './feedback-type.controller';

export const feedbackTypeRouter = Router();

feedbackTypeRouter.post('/demo/analyze', feedbackTypeController.demoAnalyzeFeedback);
feedbackTypeRouter.get('/', feedbackTypeController.listFeedbackTypes);
feedbackTypeRouter.post('/', feedbackTypeController.createFeedbackType);
feedbackTypeRouter.patch('/:id', feedbackTypeController.updateFeedbackType);
