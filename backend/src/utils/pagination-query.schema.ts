import { z } from 'zod';

// Helper: Xử lý chuỗi từ Query -> Ép sang Number -> Check Min/Max -> Trả về lại String
const paginationField = (min: number, max?: number) =>
  z
    .preprocess(
      (val) => {
        // 1. Trích xuất và dọn dẹp query param
        if (typeof val === 'string') {
          const trimmed = val.trim();
          // Nếu chuỗi rỗng thì coi như undefined để rơi vào .optional()
          return trimmed === '' ? undefined : Number(trimmed);
        }
        return val;
      },
      // 2. Validate lúc nó đang là Number, sau đó transform lại thành String
      max !== undefined
        ? z.number().int().min(min).max(max).transform(String)
        : z.number().int().min(min).transform(String)
    )
    .optional();

export const paginationQuerySchema = z.object({
  page: paginationField(1),
  limit: paginationField(1, 100),
});

