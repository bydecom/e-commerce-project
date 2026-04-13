import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import * as productController from './product.controller';

export const productRouter = Router();

productRouter.get('/', productController.listProducts);
productRouter.get('/:id', productController.getProductById);
productRouter.post('/', authMiddleware, requireRole(['ADMIN']), productController.createProduct);
productRouter.put('/:id', authMiddleware, requireRole(['ADMIN']), productController.updateProduct);
productRouter.delete('/:id', authMiddleware, requireRole(['ADMIN']), productController.deleteProduct);
