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

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const b = req.body as Record<string, unknown>;
    const email = typeof b.email === 'string' ? b.email : '';
    const password = typeof b.password === 'string' ? b.password : '';

    const data = await authService.login({ email, password });
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const mode = typeof req.query.mode === 'string' ? req.query.mode : '';

    const result = await authService.verifyEmail({ token });

    // For real email-link clicks: redirect to frontend login with a success flag.
    // For Swagger/manual API testing: use `?mode=json` to get JSON instead.
    if (mode !== 'json' && process.env.CLIENT_URL) {
      const url = new URL('/login', process.env.CLIENT_URL);
      url.searchParams.set('verified', '1');
      res.redirect(302, url.toString());
      return;
    }

    res.json(success(result, 'Verification successful'));
  } catch (err) {
    // Redirect errors to frontend (default), unless mode=json
    const mode = typeof req.query.mode === 'string' ? req.query.mode : '';
    if (mode !== 'json' && process.env.CLIENT_URL) {
      const url = new URL('/login', process.env.CLIENT_URL);
      url.searchParams.set('verified', '0');
      url.searchParams.set('reason', 'invalid_or_expired');
      res.redirect(302, url.toString());
      return;
    }
    next(err);
  }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const b = req.body as Record<string, unknown>;
    const email = typeof b.email === 'string' ? b.email : '';

    const data = await authService.resendVerification({ email });
    res.json(success(data, 'OK'));
  } catch (err) {
    next(err);
  }
}
