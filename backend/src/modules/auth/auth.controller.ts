import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import * as authService from './auth.service';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const b = req.body as Record<string, unknown>;
    const name = typeof b.name === 'string' ? b.name : '';
    const email = typeof b.email === 'string' ? b.email : '';
    const password = typeof b.password === 'string' ? b.password : '';

    const data = await authService.register({ name, email, password });
    res.status(201).json(success(data, 'Created'));
  } catch (err) {
    next(err);
  }
}
