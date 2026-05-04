import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/** 401 on these auth endpoints must not trigger refresh (loop or wrong UX). */
function shouldSkipTokenRefresh(url: string): boolean {
  return (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/logout') ||
    url.includes('/api/auth/signout')
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  const api = environment.apiUrl;

  if (!req.url.startsWith(api)) {
    return next(req);
  }

  let authReq = req.clone({ withCredentials: true });

  if (token) {
    authReq = authReq.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || shouldSkipTokenRefresh(req.url)) {
        return throwError(() => error);
      }

      return auth.refreshAccessTokenSingleFlight().pipe(
        switchMap((newToken) =>
          next(
            req.clone({
              withCredentials: true,
              setHeaders: { Authorization: `Bearer ${newToken}` },
            })
          )
        ),
        catchError((refreshErr) => {
          auth.logout({ reason: 'session_expired' });
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
