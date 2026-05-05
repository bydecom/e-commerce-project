import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { createCategorySchema, updateCategorySchema } from './category.schema';
import * as categoryController from './category.controller';

export const categoryRouter = Router();

categoryRouter.get('/', categoryController.listCategories);
categoryRouter.post('/', authMiddleware, requireRole(['ADMIN']), validateBody(createCategorySchema), categoryController.createCategory);
categoryRouter.patch('/:id', authMiddleware, requireRole(['ADMIN']), validateBody(updateCategorySchema), categoryController.updateCategory);
categoryRouter.delete('/:id', authMiddleware, requireRole(['ADMIN']), categoryController.deleteCategory);
