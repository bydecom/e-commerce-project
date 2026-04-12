import { Router } from 'express';
import * as feedbackController from './feedback.controller';

export const feedbackRouter = Router();

/** Admin: GET /feedbacks — list feedbacks with filters */
feedbackRouter.get('', feedbackController.listAdminFeedbacks);
feedbackRouter.get('/', feedbackController.listAdminFeedbacks);

/** Public: GET /feedbacks/product/:id — list feedbacks by product */
feedbackRouter.get('/product/:id', feedbackController.listByProduct);

/** User: POST /feedbacks — submit a new feedback */
feedbackRouter.post('/', feedbackController.createFeedback);
