import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  throwError,
  Observable,
  filter,
  take,
  switchMap,
  catchError,
} from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

// Typed error codes — kept in sync with backend src/utils/prisma-error.ts
export type PrismaErrorCode =
  | 'UNIQUE_CONSTRAINT_VIOLATION'
  | 'FOREIGN_KEY_VIOLATION'
  | 'RECORD_NOT_FOUND'
  | 'NULL_CONSTRAINT_VIOLATION'
  | 'PRISMA_VALIDATION_ERROR'
  | 'INTERNAL_DB_ERROR';

// Auth error codes — set explicitly in backend auth.service.ts
export type AuthErrorCode = 'AUTH_REFRESH_INVALID_OR_EXPIRED';

export type ApiErrorCode = PrismaErrorCode | AuthErrorCode;

export interface ApiErrorBody {
  success: false;
  message: string;
  errors: { code: ApiErrorCode } | null;
}

/** Extracts the typed error code from an HttpErrorResponse body, or null. */
export function getApiErrorCode(err: HttpErrorResponse): ApiErrorCode | null {
  const body = err.error as unknown;
  if (!body || typeof body !== 'object') return null;
  const errors = (body as { errors?: unknown }).errors;
  if (!errors || typeof errors !== 'object') return null;
  const code = (errors as { code?: unknown }).code;
  return typeof code === 'string' ? (code as ApiErrorCode) : null;
}

// Module-level singletons — shared across all interceptor invocations for the lifetime of the app.
let isRefreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handle401WithRefresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  toast: ToastService,
  router: Router
): Observable<HttpEvent<unknown>> {
  if (isRefreshing) {
    // Another request is already refreshing — queue this one until the new token arrives.
    return refreshSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => next(addToken(req, token!)))
    );
  }

  isRefreshing = true;
  refreshSubject.next(null);

  return auth.refreshAccessToken().pipe(
    switchMap((newToken: string) => {
      isRefreshing = false;
      refreshSubject.next(newToken);
      return next(addToken(req, newToken));
    }),
    catchError((refreshErr) => {
      isRefreshing = false;
      refreshSubject.next(null);
      toast.show('Session expired. Please sign in again.', 'error');
      auth.logout({ returnUrl: router.url, reason: 'session_expired' });
      return throwError(() => refreshErr);
    })
  );
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const url = req.url;
      const isLogout = url.includes('/api/auth/logout');
      const isRefresh = url.includes('/api/auth/refresh');
      const isOrdersApi = url.includes('/api/orders');
      const errorCode = getApiErrorCode(err);
      const isRefreshInvalidOrExpired = errorCode === 'AUTH_REFRESH_INVALID_OR_EXPIRED';

      if (isOrdersApi && (err.status === 403 || err.status === 404)) {
        toast.show('You do not have permission to view this order or it does not exist.', 'error');
        void router.navigate(['/orders']);
        return throwError(() => err);
      }

      if (err.status === 401 && req.headers.has('Authorization') && !isLogout && !isRefresh) {
        return handle401WithRefresh(req, next, auth, toast, router);
      }

      if (err.status === 401 && (isLogout || isRefresh)) {
        if ((isRefreshInvalidOrExpired || isRefresh) && !isRefreshing) {
          toast.show('Session expired. Please sign in again.', 'error');
        }
        auth.logout({
          returnUrl: router.url,
          ...(isRefreshInvalidOrExpired || isRefresh ? { reason: 'session_expired' } : null),
        });
        return throwError(() => err);
      }

      if (err.status === 403) {
        toast.show('You do not have permission for this action.', 'error');
      } else if (err.status >= 500) {
        toast.show('Server error. Try again later.', 'error');
        // Replace the error body so components displaying err.error.message
        // never show raw internal details (Redis, Prisma stack traces, file paths, etc.)
        const sanitized = new HttpErrorResponse({
          error: { success: false, message: 'Server error. Try again later.', errors: null },
          status: err.status,
          statusText: err.statusText,
          url: err.url ?? undefined,
          headers: err.headers,
        });
        return throwError(() => sanitized);
      }

      return throwError(() => err);
    })
  );
};
