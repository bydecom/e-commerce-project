import { z } from 'zod';

export const updateOneSchema = z.object({
  value: z.string().min(1, 'Value is required'),
});

export const bulkUpdateSchema = z.object({
  configs: z.array(z.object({
    key:   z.string().min(1),
    value: z.string().min(1),
  })).min(1, 'configs must be a non-empty array'),
});
