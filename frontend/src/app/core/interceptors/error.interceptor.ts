import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

/** 429 được component form auth xử lý inline — tránh toast chồng */
function shouldSkip429GlobalToast(url: string): boolean {
  return (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/register') ||
    url.includes('/api/auth/resend-verification') ||
    url.includes('/api/auth/change-password') ||
    url.includes('/api/auth/forgot-password/') ||
    url.includes('/api/auth/otp/')
  );
}

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
        const body = err.error as { errors?: { code?: string } } | null;
        const otpRequired = body?.errors?.code === 'AUTH_OTP_REQUIRED';
        if (otpRequired && url.includes('/api/auth/login')) {
          // Login changed to /verify-otp; don't show "no permission" toast to avoid confusion.
        } else {
          toast.show('You do not have permission for this action.', 'error');
        }
      } else if (err.status === 429) {
        if (!shouldSkip429GlobalToast(url)) {
          const msg =
            (err.error as { message?: string } | null)?.message ??
            'Too many requests. Please try again later.';
          toast.show(msg, 'error');
        }
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
