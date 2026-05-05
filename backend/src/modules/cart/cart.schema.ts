import { z } from 'zod';

export const upsertCartItemSchema = z.object({
  quantity: z.number().min(1).max(99).int(),
  name:     z.string().min(1, 'Product name is required'),
  mode:     z.enum(['inc', 'set']).default('inc'),
});
