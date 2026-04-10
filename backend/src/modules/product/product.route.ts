import { Router } from 'express';
import * as productController from './product.controller';

export const productRouter = Router();

productRouter.get('/', productController.listProducts);
productRouter.get('/:id', productController.getProductById);
productRouter.post('/', productController.createProduct);
productRouter.put('/:id', productController.updateProduct);
productRouter.delete('/:id', productController.deleteProduct);
