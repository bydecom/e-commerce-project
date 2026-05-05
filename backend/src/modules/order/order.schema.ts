import { z } from 'zod';

export const createOrderSchema = z.object({
  shippingAddress: z.string().min(1, 'Shipping address is required').transform(s => s.trim()),
  items: z.array(z.object({
    productId: z.number().min(1),
    quantity:  z.number().min(1).int(),
  })).min(1, 'Cart cannot be empty'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED']),
});
