import { Router } from 'express';
import * as dashboardController from './dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.get('/export-pdf', dashboardController.exportPdf);
dashboardRouter.get('/summary', dashboardController.getSummary);
