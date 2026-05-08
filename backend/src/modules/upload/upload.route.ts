import { Router } from 'express';
import { presignedUrl } from './upload.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';

export const uploadRouter = Router();

uploadRouter.get('/presigned-url', authMiddleware, requireRole(['ADMIN']), presignedUrl);
