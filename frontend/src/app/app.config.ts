import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';

import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export function initializeApp(authService: AuthService) {
  return (): Promise<unknown> => {
    // SSR guard: only attempt refresh in the browser.
    if (typeof window === 'undefined') {
      return Promise.resolve();
    }

    // Only attempt refresh if we have a stored user (previously logged in).
    if (authService.currentUser()) {
      return firstValueFrom(
        authService.refreshAccessToken().pipe(
          catchError(() => {
            authService.clearLocalSessionQuietly();
            return of(null);
          })
        )
      );
    }

    return Promise.resolve();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withEnabledBlockingInitialNavigation(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      })
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AuthService],
      multi: true,
    },
  ],
};
