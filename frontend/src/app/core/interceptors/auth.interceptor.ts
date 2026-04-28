import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

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
      if (
        error.status === 401 &&
        !req.url.includes('/api/auth/login') &&
        !req.url.includes('/api/auth/refresh')
      ) {
        if (!auth.isRefreshingToken) {
          auth.setRefreshingState(true);
          auth.broadcastNewToken(null);

          return auth.refreshAccessToken().pipe(
            switchMap((newToken) => {
              auth.setRefreshingState(false);
              auth.broadcastNewToken(newToken);

              return next(
                req.clone({
                  withCredentials: true,
                  setHeaders: { Authorization: `Bearer ${newToken}` },
                })
              );
            }),
            catchError((refreshErr) => {
              auth.setRefreshingState(false);
              auth.logout({ reason: 'session_expired' });
              return throwError(() => refreshErr);
            })
          );
        }

        return auth.refreshToken$.pipe(
          filter((t): t is string => t !== null),
          take(1),
          switchMap((newToken) =>
            next(
              req.clone({
                withCredentials: true,
                setHeaders: { Authorization: `Bearer ${newToken}` },
              })
            )
          )
        );
      }

      return throwError(() => error);
    })
  );
};
