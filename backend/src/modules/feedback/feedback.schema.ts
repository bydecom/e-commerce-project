import { z } from 'zod';

export const createFeedbackSchema = z.object({
  orderId:   z.number().min(1),
  productId: z.number().min(1),
  typeId:    z.number().min(1).optional(),
  rating:    z.number().min(1, 'Rating min is 1').max(5, 'Rating max is 5').int(),
  comment:   z.string()
    .trim()
    .max(8000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const createActionPlanSchema = z.object({
  title:       z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional(),
});

export const updateActionPlanSchema = z.object({
  status:     z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED']).optional(),
  resolution: z.string().optional(),
  assigneeId: z.number().min(1).nullable().optional(),
});
