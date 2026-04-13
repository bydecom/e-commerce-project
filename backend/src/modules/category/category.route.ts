import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import * as categoryController from './category.controller';

export const categoryRouter = Router();

categoryRouter.get('/', categoryController.listCategories);
categoryRouter.post('/', authMiddleware, requireRole(['ADMIN']), categoryController.createCategory);
categoryRouter.patch('/:id', authMiddleware, requireRole(['ADMIN']), categoryController.updateCategory);
categoryRouter.delete('/:id', authMiddleware, requireRole(['ADMIN']), categoryController.deleteCategory);
