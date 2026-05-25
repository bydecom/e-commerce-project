import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination-query.schema';

export const createOrderSchema = z.object({
  shippingAddress: z.string().trim().min(1, 'Shipping address is required'),
  items: z.array(z.object({
    productId: z.number().min(1),
    quantity: z.number().min(1).int(),
  })).min(1, 'Cart cannot be empty'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED']),
});

export const adminOrderQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED']).optional(),
  search: z.string().optional(),
});

export const userOrderQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED']).optional(),
});
