import { z } from 'zod';

export const updateMeSchema = z.object({
  name:          z.string().max(100).nullable().optional(),
  phone:         z.string().max(30).nullable().optional(),
  provinceId:    z.string().nullable().optional(),
  districtId:    z.string().nullable().optional(),
  wardId:        z.string().nullable().optional(),
  streetAddress: z.string().max(200).nullable().optional(),
  fullAddress:   z.string().max(500).nullable().optional(),
});
