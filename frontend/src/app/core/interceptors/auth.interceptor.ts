import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  const api = environment.apiUrl;

  if (!req.url.startsWith(api)) {
    return next(req);
  }

  // Always include credentials so the browser stores Set-Cookie on login
  // and sends the refresh_token cookie on subsequent auth requests.
  const credentialed = req.clone({ withCredentials: true });

  if (!token) {
    return next(credentialed);
  }

  return next(
    credentialed.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    })
  );
};
