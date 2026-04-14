import { HttpClient } from '@angular/common/http';
import { NgClass } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { ServerCartService } from '../../core/services/server-cart.service';
import { ToastService } from '../../core/services/toast.service';
import { UserApiService } from '../../core/services/user-api.service';
import type { ApiSuccess } from '../../shared/models/api-response.model';
import type { User } from '../../shared/models/user.model';
import { CurrencyVndPipe } from '../../shared/pipes/currency-vnd.pipe';

type CheckoutCartLine = {
  productId: number;
  quantity: number;
  name: string;
  unitPrice: number;
  lineTotal: number;
};

type CartPricingData = {
  items: CheckoutCartLine[];
  total: number;
};

type CacheEntry = { data: CartPricingData; ts: number };

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [RouterLink, NgClass, CurrencyVndPipe],
  template: `
    <div class="relative isolate">
      <div class="pointer-events-none absolute inset-x-0 -top-16 -z-10 h-72 bg-gradient-to-b from-indigo-50 via-white to-transparent">
      </div>

      <div class="mx-auto w-full max-w-6xl px-4 py-8">
        <div class="min-w-0">
          <a routerLink="/cart" class="text-sm font-medium text-indigo-700 hover:underline">← Back to cart</a>
          <h1 class="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">Order verification</h1>
          <p class="mt-1 text-sm text-gray-600">Review your items, confirm delivery details, then continue to payment.</p>
        </div>

        @if (loading()) {
          <p class="mt-8 text-gray-600">Loading your checkout…</p>
        } @else if (error()) {
          <div class="mt-8 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
            {{ error() }}
          </div>
        } @else if (items().length === 0) {
          <div class="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p class="text-gray-700">Your cart is empty.</p>
            <a routerLink="/products" class="mt-3 inline-block text-indigo-700 hover:underline">Browse products</a>
          </div>
        } @else {
          <div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div class="lg:col-span-2">
              <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="text-sm font-bold uppercase tracking-wide text-gray-900">Customer</p>
                    <p class="mt-1 truncate text-base font-semibold text-gray-800">
                      {{ user()?.name || 'Guest Customer' }}
                    </p>
                    <p class="truncate text-sm text-gray-600">{{ user()?.email || '—' }}</p>
                  </div>

                  <div
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold"
                    [ngClass]="
                      isAuthenticated()
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    "
                  >
                    <span
                      class="h-2 w-2 rounded-full"
                      [ngClass]="isAuthenticated() ? 'bg-emerald-500' : 'bg-amber-500'"
                    ></span>
                    {{ isAuthenticated() ? 'Signed in' : 'Not signed in' }}
                  </div>
                </div>

                <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div
                    class="flex gap-4 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-5 shadow-sm"
                  >
                    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                      <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <div class="min-w-0">
                      <h2 class="text-sm font-bold uppercase tracking-wide text-gray-900">Contact</h2>
                      <p class="mt-2 truncate text-sm font-medium text-gray-700">{{ user()?.email || '—' }}</p>
                      <p class="truncate text-sm text-gray-600">{{ user()?.phone || '' }}</p>
                    </div>
                  </div>

                  <div
                    class="flex gap-4 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm"
                  >
                    <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
                      </svg>
                    </div>
                    <div class="min-w-0 flex-1">
                      <h2 class="text-sm font-bold uppercase tracking-wide text-gray-900">Shipping address</h2>

                      <label class="mt-2 block text-xs font-semibold text-gray-600">Address</label>
                      <p class="mt-2 truncate text-sm font-medium text-gray-700">{{ shippingAddress || '—' }}</p>
                      <p class="mt-1 text-xs text-gray-500">Update your address in profile if needed.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div class="flex items-center gap-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-white px-5 py-3">
                  <svg class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  <h2 class="text-base font-bold text-gray-900">Items in your order</h2>
                </div>

                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead class="bg-white">
                      <tr>
                        <th class="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Product</th>
                        <th class="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Qty
                        </th>
                        <th class="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Unit price
                        </th>
                        <th class="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Line total
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100 bg-white">
                      @for (line of items(); track line.productId) {
                        <tr class="transition-colors hover:bg-indigo-50/40">
                          <td class="px-5 py-3 font-medium text-gray-900">{{ line.name }}</td>
                          <td class="px-5 py-3 text-center text-gray-700">
                            <span class="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-800">
                              {{ line.quantity }}
                            </span>
                          </td>
                          <td class="px-5 py-3 text-right text-gray-500">{{ line.unitPrice | currencyVnd }}</td>
                          <td class="px-5 py-3 text-right font-semibold text-gray-900">
                            {{ line.lineTotal | currencyVnd }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="lg:col-span-1">
              <div class="sticky top-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p class="text-sm font-bold uppercase tracking-wide text-gray-900">Summary</p>

                <div class="mt-4 space-y-2 text-sm">
                  <div class="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span class="font-semibold text-gray-900">{{ total() | currencyVnd }}</span>
                  </div>
                  <div class="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span class="font-semibold text-emerald-700">Free</span>
                  </div>
                  <div class="pt-3 border-t border-gray-200 flex items-center justify-between">
                    <span class="text-base font-extrabold text-gray-900">Total</span>
                    <span class="text-xl font-extrabold text-indigo-600">{{ total() | currencyVnd }}</span>
                  </div>
                </div>

                <button
                  type="button"
                  (click)="confirmAndPay()"
                  [disabled]="paying() || loading() || items().length === 0"
                  class="mt-5 inline-flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  @if (paying()) {
                    <svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  }
                  Confirm & Pay
                </button>

                <p class="mt-2 text-xs text-gray-500">Payment will be connected to a sandbox later.</p>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class CheckoutComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserApiService);
  private readonly toast = inject(ToastService);
  private readonly serverCart = inject(ServerCartService);

  readonly loading = signal(true);
  readonly paying = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<CheckoutCartLine[]>([]);
  readonly total = signal(0);
  readonly user = signal<User | null>(null);

  shippingAddress = '';

  private cache: CacheEntry | null = null;
  private readonly CACHE_TTL_MS = 30_000;

  ngOnInit(): void {
    this.load();
  }

  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  confirmAndPay(): void {
    if (this.paying()) return;
    if (this.items().length === 0) {
      this.toast.show('Your cart is empty.', 'error');
      return;
    }
    if (!this.isAuthenticated()) {
      this.toast.show('Please login to continue to payment.', 'error');
      return;
    }
    if (!this.shippingAddress.trim()) {
      this.toast.show('Please update your shipping address in your profile before paying.', 'error');
      return;
    }

    this.paying.set(true);
    const returnUrl = `${window.location.origin}/checkout/result`;
    this.http
      .post<ApiSuccess<{ paymentUrl: string }>>(`${environment.apiUrl}/api/payments/vnpay/create`, {
        shippingAddress: this.shippingAddress.trim(),
        returnUrl,
      })
      .pipe(
        map((r) => {
          if (!r.success) throw new Error(r.message);
          return r.data.paymentUrl;
        }),
        tap((paymentUrl) => {
          window.location.href = paymentUrl;
        }),
        catchError((e: Error) => {
          this.toast.show(e.message ?? 'Failed to start payment', 'error');
          this.paying.set(false);
          return of(null);
        })
      )
      .subscribe();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    // 1) Serve from cache if fresh (keeps the UI stable).
    if (this.cache && Date.now() - this.cache.ts < this.CACHE_TTL_MS) {
      this.applyPricing(this.cache.data);
      this.loading.set(false);
      this.loadUserBestEffort();
      return;
    }

    this.fetchPricing$()
      .pipe(
        tap((data) => {
          this.cache = { data, ts: Date.now() };
          this.applyPricing(data);
          this.serverCart.refresh().subscribe();
        }),
        tap(() => this.loadUserBestEffort()),
        catchError((e: Error) => {
          this.error.set(e.message ?? 'Failed to load checkout');
          this.items.set([]);
          this.total.set(0);
          return of(null);
        }),
        tap(() => this.loading.set(false))
      )
      .subscribe();
  }

  private loadUserBestEffort(): void {
    if (!this.isAuthenticated()) {
      this.user.set(null);
      return;
    }
    this.users
      .getMe()
      .pipe(
        tap((u) => {
          this.user.set(u);
          if (!this.shippingAddress.trim() && typeof u.address === 'string' && u.address.trim()) {
            this.shippingAddress = u.address;
          }
        }),
        catchError(() => {
          // Avoid blocking checkout UI if profile fetch fails.
          this.user.set(this.auth.currentUser());
          return of(null);
        })
      )
      .subscribe();
  }

  private fetchPricing$() {
    return this.http.get<ApiSuccess<CartPricingData>>(`${environment.apiUrl}/api/cart/pricing`).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      })
    );
  }

  private applyPricing(data: CartPricingData | null): void {
    if (!data) return;
    this.items.set(data.items);
    this.total.set(data.total);
  }
}
