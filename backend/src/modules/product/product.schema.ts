import { z } from 'zod';

export const createProductSchema = z.object({
  name:        z.string().trim().min(1, 'Name is required').max(300),
  description: z.string().trim().max(8000).optional().nullable(),
  price:       z.number().min(0).finite(),
  stock:       z.number().min(0).int(),
  imageUrl:    z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  categoryId:  z.number().min(1),
  status:      z.enum(['AVAILABLE', 'UNAVAILABLE', 'DRAFT']).default('DRAFT'),
});

export const updateProductSchema = createProductSchema.partial();
