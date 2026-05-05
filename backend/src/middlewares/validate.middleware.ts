import { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

function firstZodMessage(error: { issues: readonly { message?: string }[] }): string {
  return error.issues[0]?.message ?? 'Invalid input';
}

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: firstZodMessage(result.error),
        errors: null,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: firstZodMessage(result.error),
        errors: null,
      });
      return;
    }
    req.query = result.data as Request['query'];
    next();
  };
}
