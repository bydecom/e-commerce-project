import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, take, takeWhile, tap, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';

type VerifyPayload = {
  verify: { isSuccess: boolean; responseCode?: string; transactionStatus?: string };
  order: { id: number; paymentStatus: 'PENDING' | 'PAID' | 'FAILED'; status: string } | null;
};

@Component({
  selector: 'app-checkout-result',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div
        class="w-full max-w-md transform overflow-hidden rounded-3xl bg-white p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-1 ring-gray-100 transition-all"
      >
        @if (loading()) {
          <div class="flex flex-col items-center justify-center py-8">
            <div class="h-12 w-12 animate-spin rounded-full border-4 border-green-100 border-t-green-600"></div>
            <p class="mt-6 animate-pulse text-sm font-medium text-gray-500">
              Confirming payment with VNPay...
            </p>
          </div>
        } @else if (success()) {
          <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <svg
              class="h-10 w-10 text-green-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold tracking-tight text-gray-900">Payment Successful!</h1>
          <p class="mt-3 text-base text-gray-500">
            Thank you for your purchase.
          </p>

          @if (orderId()) {
            <div class="mt-6 rounded-2xl bg-gray-50 py-4 text-sm font-medium text-gray-600">
              Order Tracking ID: <span class="font-bold text-gray-900">#{{ orderId() }}</span>
            </div>
          }

          <div class="mt-8 flex flex-col gap-3">
            <a
              routerLink="/orders"
              class="inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              View My Orders
            </a>
            <a
              routerLink="/products"
              class="inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-gray-700 ring-1 ring-inset ring-gray-200 transition hover:bg-gray-50"
            >
              Continue Shopping
            </a>
          </div>
        } @else if (pending()) {
          <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
            <svg
              class="h-10 w-10 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold tracking-tight text-gray-900">Đang xử lý giao dịch</h1>
          <p class="mt-3 text-base text-gray-500">
            {{ error() || 'Payment is being processed, please wait a moment or check again later.' }}
          </p>

          <div class="mt-8 flex flex-col gap-3">
            <a
              routerLink="/orders"
              class="inline-flex w-full items-center justify-center rounded-xl bg-amber-500 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600 focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
            >
              Check my orders
            </a>
            <a
              routerLink="/products"
              class="inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-gray-700 ring-1 ring-inset ring-gray-200 transition hover:bg-gray-50"
            >
              Continue shopping
            </a>
          </div>
        } @else {
          <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100">
            <svg
              class="h-10 w-10 text-rose-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold tracking-tight text-gray-900">Payment Failed</h1>
          <p class="mt-3 text-base text-gray-500">
            {{ error() || 'The transaction was declined or cancelled.' }}
          </p>

          <div class="mt-8 flex flex-col gap-3">
            <button
              type="button"
              (click)="retryPayment()"
              class="inline-flex w-full items-center justify-center rounded-xl bg-rose-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700"
            >
              Try Again
            </button>
            <a
              routerLink="/cart"
              class="inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-gray-700 ring-1 ring-inset ring-gray-200 transition hover:bg-gray-50"
            >
              Return to Cart
            </a>
          </div>
        }
      </div>
    </div>
  `,
})
export class CheckoutResultComponent {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly pollIntervalMs = 2000;
  private readonly maxPollAttempts = 5;

  readonly loading = signal(true);
  readonly success = signal(false);
  readonly orderId = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly pending = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      this.success.set(false);
      return;
    }

    try {
      sessionStorage.removeItem('pendingCheckoutTxnRef');
    } catch {
    
    }

    const qs = window.location.search || '';
    timer(0, this.pollIntervalMs)
      .pipe(
        take(this.maxPollAttempts),
        switchMap((attempt) =>
          this.http.get<ApiSuccess<VerifyPayload>>(`${environment.apiUrl}/api/payments/vnpay/verify${qs}`).pipe(
            map((r) => {
              if (!r.success) throw new Error(r.message);
              return { attempt, data: r.data };
            })
          )
        ),
        map(({ attempt, data }) => {
          this.orderId.set(data.order?.id ?? null);

          const paymentStatus = data.order?.paymentStatus;
          if (paymentStatus === 'PAID') {
            return { done: true, success: true, pending: false, error: null };
          }
          if (paymentStatus === 'FAILED' || data.order?.status === 'CANCELLED' || data.verify?.isSuccess === false) {
            return {
              done: true,
              success: false,
              pending: false,
              error: 'Payment failed or cancelled.',
            };
          }
          if (attempt >= this.maxPollAttempts - 1) {
            return {
              done: true,
              success: false,
              pending: true,
              error: 'Giao dịch đang được xử lý, vui lòng chờ trong giây lát hoặc kiểm tra lại sau.',
            };
          }

          return { done: false, success: false, pending: false, error: null };
        }),
        takeWhile((result) => !result.done, true),
        catchError((e: Error & { status?: number }) => {
          const status = e instanceof HttpErrorResponse ? e.status : e.status;
          if (status === 0) {
            this.error.set('Can not connect to server. Please check your connection and try again.');
            this.pending.set(true);
          } else {
            this.error.set(e.message ?? 'Failed to verify payment');
            this.pending.set(false);
          }
          this.success.set(false);
          this.loading.set(false);
          return of(null);
        }),
        tap((result) => {
          if (!result || !result.done) return;
          this.success.set(Boolean(result.success));
          this.pending.set(Boolean(result.pending));
          this.error.set(result.error ?? null);
          this.loading.set(false);
        })
      )
      .subscribe();
  }

  retryPayment() {
    window.location.href = '/cart';
  }
}

