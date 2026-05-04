import { Injectable, inject, NgZone, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  fromEvent,
  merge,
  timer,
  Subscription,
  switchMap,
  startWith,
  catchError,
  map,
  take,
  of,
} from 'rxjs';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';

const DEFAULT_IDLE_SECONDS = 900;

@Injectable({
  providedIn: 'root',
})
export class IdleService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly zone = inject(NgZone);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private configSub?: Subscription;
  private idleSubscription?: Subscription;

  startWatching(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.configSub || this.idleSubscription) {
      return;
    }

    this.configSub = this.http
      .get<ApiSuccess<{ idle_timeout_seconds: number }>>(`${environment.apiUrl}/api/system-config/public`)
      .pipe(
        take(1),
        map((res): number => {
          if (!res?.success || !res.data) {
            return DEFAULT_IDLE_SECONDS;
          }
          const n = Number(res.data.idle_timeout_seconds);
          return Number.isFinite(n) && n > 0 ? n : DEFAULT_IDLE_SECONDS;
        }),
        catchError(() => of(DEFAULT_IDLE_SECONDS))
      )
      .subscribe((seconds) => {
        this.configSub = undefined;
        const timeoutMs = seconds * 1000;

        this.zone.runOutsideAngular(() => {
          const userActivity$ = merge(
            fromEvent(document, 'mousemove'),
            fromEvent(document, 'keydown'),
            fromEvent(document, 'click'),
            fromEvent(document, 'scroll')
          );

          this.idleSubscription = userActivity$
            .pipe(startWith(null), switchMap(() => timer(timeoutMs)))
            .subscribe(() => {
              this.zone.run(() => {
                if (this.auth.isAuthenticated()) {
                  this.toast.show('You have been logged out due to inactivity.', 'info');
                  this.auth.logout({ reason: 'idle_timeout' });
                }
              });
            });
        });
      });
  }

  stopWatching(): void {
    this.configSub?.unsubscribe();
    this.configSub = undefined;
    if (this.idleSubscription) {
      this.idleSubscription.unsubscribe();
      this.idleSubscription = undefined;
    }
  }

  ngOnDestroy(): void {
    this.stopWatching();
  }
}
