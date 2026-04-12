import { Router } from 'express';
import * as aiController from './ai.controller';

export const aiRouter = Router();

aiRouter.post('/enhance-product-description', aiController.postEnhanceProductDescription);
