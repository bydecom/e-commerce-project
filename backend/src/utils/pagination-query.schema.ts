import { z } from 'zod';

function trimToString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return trimToString(v[0]);
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

const intString = (label: string) =>
  z
    .string()
    .regex(/^\d+$/, `${label} must be an integer`)
    .transform((s) => parseInt(s, 10));

export const paginationQuerySchema = z
  .object({
    page: z.preprocess((v) => trimToString(v), intString('page').min(1)).optional(),
    limit: z.preprocess((v) => trimToString(v), intString('limit').min(1).max(100)).optional(),
  })
  .transform((q) => ({
    ...(q.page !== undefined ? { page: String(q.page) } : {}),
    ...(q.limit !== undefined ? { limit: String(q.limit) } : {}),
  }));

