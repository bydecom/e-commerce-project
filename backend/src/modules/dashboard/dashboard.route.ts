import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import * as dashboardController from './dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.get('/export-pdf', authMiddleware, requireRole(['ADMIN']), dashboardController.exportPdf);
dashboardRouter.get('/summary', authMiddleware, requireRole(['ADMIN']), dashboardController.getSummary);
