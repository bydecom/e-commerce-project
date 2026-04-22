import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  const returnUrl = typeof state.url === 'string' && state.url.startsWith('/') ? state.url : '/';
  if (returnUrl === '/login') {
    return router.createUrlTree(['/login']);
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
};
