import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';

type VerifyPayload = {
  verify: { isSuccess: boolean; responseCode?: string; transactionStatus?: string };
  order: { id: number } | null;
};

@Component({
  selector: 'app-checkout-result',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto w-full max-w-3xl px-4 py-10">
      @if (loading()) {
        <p class="text-gray-700">Verifying your payment…</p>
      } @else if (success()) {
        <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
          <h1 class="text-xl font-extrabold">Payment successful</h1>
          @if (orderId()) {
            <p class="mt-2 text-sm">Order ID: <span class="font-bold">#{{ orderId() }}</span></p>
          }
        </div>
        <a
          routerLink="/"
          class="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white hover:brightness-105"
        >
          Back to home
        </a>
      } @else {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <h1 class="text-xl font-extrabold">Payment failed</h1>
          <p class="mt-2 text-sm">{{ error() || 'Your payment could not be verified.' }}</p>
        </div>
        <a
          routerLink="/"
          class="mt-6 inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-extrabold text-white hover:brightness-105"
        >
          Back to home
        </a>
      }
    </div>
  `,
})
export class CheckoutResultComponent {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly loading = signal(true);
  readonly success = signal(false);
  readonly orderId = signal<number | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      this.success.set(false);
      return;
    }

    const qs = window.location.search || '';
    this.http
      .get<ApiSuccess<VerifyPayload>>(`${environment.apiUrl}/api/payments/vnpay/verify${qs}`)
      .pipe(
        map((r) => {
          if (!r.success) throw new Error(r.message);
          return r.data;
        }),
        tap((data) => {
          this.success.set(Boolean(data.verify?.isSuccess));
          this.orderId.set(data.order?.id ?? null);
        }),
        catchError((e: Error) => {
          this.error.set(e.message ?? 'Failed to verify payment');
          this.success.set(false);
          return of(null);
        }),
        tap(() => this.loading.set(false))
      )
      .subscribe();
  }
}

