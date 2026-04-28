import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const url = req.url;
      const isOrdersApi = url.includes('/api/orders');

      if (isOrdersApi && (err.status === 403 || err.status === 404)) {
        toast.show('You do not have permission to view this order or it does not exist.', 'error');
        void router.navigate(['/orders']);
        return throwError(() => err);
      }

      if (err.status === 403) {
        toast.show('You do not have permission for this action.', 'error');
      } else if (err.status >= 500) {
        toast.show('Server error. Try again later.', 'error');
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
