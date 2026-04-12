import { Router } from 'express';
import * as categoryController from './category.controller';

export const categoryRouter = Router();

categoryRouter.get('/', categoryController.listCategories);
categoryRouter.post('/', categoryController.createCategory);
categoryRouter.patch('/:id', categoryController.updateCategory);
categoryRouter.delete('/:id', categoryController.deleteCategory);
