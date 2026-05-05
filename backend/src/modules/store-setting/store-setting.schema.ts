import { z } from 'zod';

export const updateStoreSettingSchema = z.object({
  name:        z.string().trim().min(1, 'Store name is required'),
  description: z.string().optional().nullable(),
  logoUrl:     z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  email:       z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  phone:       z.string().optional().nullable(),
  address:     z.string().optional().nullable(),
});
