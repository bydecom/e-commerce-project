import { z } from 'zod';

export const updateStoreSettingSchema = z.object({
  name: z.string().trim().min(1, 'Store name is required'),
  description: z.string().optional().nullable(),
  logoUrl: z.string().trim().min(1).optional().nullable().or(z.literal('')),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(30).refine(val => !val || /^\+?[0-9]{9,15}$/.test(val), 'Invalid phone number format').nullable().optional(),
  address: z.string().optional().nullable(),
});
