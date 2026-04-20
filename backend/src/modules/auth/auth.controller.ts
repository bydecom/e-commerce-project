import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import { httpError } from '../../utils/http-error';
import * as authService from './auth.service';

function refreshTtlMs(): number {
  const s = Number(process.env.REFRESH_TOKEN_TTL_SECONDS?.trim() || '604800');
  return (Number.isFinite(s) && s > 0 ? s : 604800) * 1000;
}

function isSecure(): boolean {
  return process.env.NODE_ENV === 'production' || String(process.env.HTTPS_ENABLED).toLowerCase() === 'true';
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: isSecure(),
    sameSite: 'strict',
    maxAge: refreshTtlMs(),
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: isSecure(),
    sameSite: 'strict',
    path: '/api/auth',
  });
}

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
    setRefreshCookie(res, data.refreshToken);
    res.json(success({ token: data.token, user: data.user }));
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

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      next(httpError(500, 'Auth context missing'));
      return;
    }
    const data = await authService.getMe(auth.userId);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      next(httpError(500, 'Auth context missing'));
      return;
    }
    const rawRefreshToken = typeof req.cookies?.refresh_token === 'string'
      ? req.cookies.refresh_token
      : undefined;
    await authService.logoutSession(auth.jti, auth.exp, rawRefreshToken);
    clearRefreshCookie(res);
    res.json(success(null, 'Logged out'));
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawRefreshToken = typeof req.cookies?.refresh_token === 'string'
      ? req.cookies.refresh_token
      : '';
    const data = await authService.refreshAccessToken(rawRefreshToken);
    setRefreshCookie(res, data.newRefreshToken);
    res.json(success({ token: data.token }));
  } catch (err) {
    clearRefreshCookie(res);
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      next(httpError(500, 'Auth context missing'));
      return;
    }

    const b = req.body as Record<string, unknown>;
    const currentPassword = typeof b.currentPassword === 'string' ? b.currentPassword : '';
    const newPassword = typeof b.newPassword === 'string' ? b.newPassword : '';

    await authService.changePassword({ userId: auth.userId, currentPassword, newPassword });
    res.json(success(null, 'Updated'));
  } catch (err) {
    next(err);
  }
}
