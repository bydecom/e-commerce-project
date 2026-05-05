import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { createProductSchema, updateProductSchema } from './product.schema';
import * as productController from './product.controller';

export const productRouter = Router();

productRouter.get('/',           productController.listProducts);
productRouter.get('/landing',    productController.getLandingPage);
productRouter.get('/smart',      productController.listSmart);
productRouter.get('/search',     productController.searchSmart);
productRouter.get('/admin-list', authMiddleware, requireRole(['ADMIN']), productController.listProductsAdmin);
productRouter.get('/:id',        productController.getProductById);
productRouter.post('/',          authMiddleware, requireRole(['ADMIN']), validateBody(createProductSchema), productController.createProduct);
productRouter.put('/:id',        authMiddleware, requireRole(['ADMIN']), validateBody(updateProductSchema), productController.updateProduct);
productRouter.delete('/:id',     authMiddleware, requireRole(['ADMIN']), productController.deleteProduct);
