import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Unauthenticated calls (no Bearer) are not "session expired".
      // Skip logout: AuthService.logout() sends Bearer; 401 there must not re-enter logout (loop).
      const url = req.url;
      const isLogout = url.includes('/api/auth/logout');
      if (err.status === 401 && req.headers.has('Authorization') && !isLogout) {
        toast.show('Session expired. Please sign in again.', 'error');
        auth.logout();
      } else if (err.status === 403) {
        toast.show('You do not have permission for this action.', 'error');
      } else if (err.status >= 500) {
        toast.show('Server error. Try again later.', 'error');
      }
      return throwError(() => err);
    })
  );
};
