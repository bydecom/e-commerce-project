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
    <div class="bg-white">
      <div class="mx-auto max-w-2xl px-4 pb-24 py-8 sm:px-6 lg:max-w-7xl lg:px-8">
        <div class="min-w-0">
          <a routerLink="/cart" class="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">
            &larr; Back to cart
          </a>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Confirm your order</h1>
          <p class="mt-2 text-sm text-gray-500">Review delivery details and items before proceeding to payment.</p>
        </div>

        @if (loading()) {
          <div class="flex justify-center py-24">
            <div class="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" aria-hidden="true"></div>
          </div>
        } @else if (error()) {
          <div class="mt-6 rounded-md bg-red-50 p-4 shadow-sm border border-red-100">
            <div class="flex">
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Something went wrong</h3>
                <div class="mt-2 text-sm text-red-700">
                  <p>{{ error() }}</p>
                </div>
              </div>
            </div>
          </div>
        } @else if (items().length === 0) {
          <div class="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-24 text-center">
            <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <h2 class="mt-4 text-lg font-medium text-gray-900">Your cart is empty</h2>
            <a
              routerLink="/products"
              class="mt-6 inline-flex items-center rounded-sm bg-gray-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            >
              Continue shopping
            </a>
          </div>
        } @else {
          <div class="mt-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-12 xl:gap-x-16">

            <div class="lg:col-span-7 space-y-8">

              <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex justify-between items-center">
                  <h2 class="font-bold text-gray-900">Delivery details</h2>
                </div>

                <div class="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <div class="flex justify-between items-center mb-1">
                      <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</label>
                      @if (isAuthenticated() && !hasPhone()) {
                        <a routerLink="/profile/edit" class="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">Add phone</a>
                      }
                    </div>
                    <p class="font-medium text-gray-900">{{ user()?.name || 'Customer' }}</p>
                    <p class="text-sm text-gray-600">{{ user()?.email || '—' }}</p>

                    @if (hasPhone()) {
                      <p class="text-sm text-gray-600">{{ user()?.phone }}</p>
                    } @else {
                      <div class="mt-1 flex items-center gap-1 text-red-600">
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <span class="text-xs font-medium">Phone number is missing</span>
                      </div>
                    }
                  </div>

                  <div>
                    <div class="flex justify-between items-center mb-1">
                      <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Shipping address</label>
                      @if (isAuthenticated()) {
                        <a routerLink="/profile/edit" class="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                          {{ hasAddress() ? 'Change' : 'Add address' }}
                        </a>
                      }
                    </div>

                    @if (hasAddress()) {
                      <p class="text-sm text-gray-900 leading-relaxed">{{ shippingAddress }}</p>
                    } @else {
                      <div class="mt-1 flex items-center gap-1 text-red-600">
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <span class="text-xs font-medium">Shipping address is missing</span>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
                 <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                  <h2 class="font-bold text-gray-900">Items ({{ items().length }})</h2>
                </div>
                <ul role="list" class="divide-y divide-gray-100 px-6">
                  @for (line of items(); track line.productId) {
                    <li class="flex py-6">
                      <div class="flex flex-1 flex-col">
                        <div class="flex justify-between text-base font-medium text-gray-900">
                          <h3 class="line-clamp-2 pr-4">{{ line.name }}</h3>
                          <p class="whitespace-nowrap">{{ line.lineTotal | currencyVnd }}</p>
                        </div>
                        <div class="mt-1 flex items-end justify-between text-sm">
                          <p class="text-gray-500">Unit price: {{ line.unitPrice | currencyVnd }}</p>
                          <p class="font-medium text-gray-900">Qty: {{ line.quantity }}</p>
                        </div>
                      </div>
                    </li>
                  }
                </ul>
              </div>
            </div>

            <div class="mt-16 rounded-lg bg-gray-50 px-4 py-6 sm:p-6 lg:col-span-5 lg:mt-0 lg:p-8 border border-gray-100 shadow-sm sticky top-8">
              <h2 class="text-lg font-medium text-gray-900">Order summary</h2>

              <dl class="mt-6 space-y-4">
                <div class="flex items-center justify-between">
                  <dt class="text-sm text-gray-600">Subtotal</dt>
                  <dd class="text-sm font-medium text-gray-900">{{ total() | currencyVnd }}</dd>
                </div>
                <div class="flex items-center justify-between border-t border-gray-200 pt-4">
                  <dt class="flex items-center text-sm text-gray-600">
                    <span>Shipping</span>
                  </dt>
                  <dd class="text-sm font-medium text-green-600">Free</dd>
                </div>
                <div class="flex items-center justify-between border-t border-gray-200 pt-4">
                  <dt class="text-base font-bold text-gray-900">Total</dt>
                  <dd class="text-xl font-bold text-gray-900">{{ total() | currencyVnd }}</dd>
                </div>
              </dl>

              @if (isAuthenticated() && (!hasAddress() || !hasPhone())) {
                <div class="mt-6 rounded-sm border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-800">
                  <p class="font-medium">Please update:</p>
                  <ul class="mt-1 ml-4 list-disc text-red-700">
                    @if (!hasPhone()) { <li>Phone number</li> }
                    @if (!hasAddress()) { <li>Shipping address</li> }
                  </ul>
                  <a routerLink="/profile/edit" class="mt-3 inline-block font-bold text-red-700 hover:text-red-900 transition-colors">
                    Update now &rarr;
                  </a>
                </div>
              }

              @if (!isAuthenticated()) {
                <div class="mt-6 rounded-sm border-l-4 border-gray-500 bg-gray-100 p-4 text-sm text-gray-800">
                  Please log in to complete checkout.
                  <a routerLink="/login" class="mt-2 block font-bold text-gray-900 hover:underline">
                    Go to login &rarr;
                  </a>
                </div>
              }

              <button
                type="button"
                (click)="confirmAndPay()"
                [disabled]="paying() || loading() || items().length === 0 || !isAuthenticated() || !hasAddress() || !hasPhone()"
                class="mt-6 flex w-full items-center justify-center gap-2 rounded-sm bg-gray-900 px-4 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                @if (paying()) {
                  <svg class="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                } @else {
                  Pay with VNPay
                }
              </button>

              <p class="mt-4 text-center text-xs text-gray-500 flex items-center justify-center gap-1">
                <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                Secure payment via VNPay
              </p>
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

  hasPhone(): boolean {
    return !!this.user()?.phone?.trim();
  }

  hasAddress(): boolean {
    return !!this.shippingAddress?.trim();
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

    // Double-check in TS (do not rely on disabled button only)
    if (!this.hasPhone()) {
      this.toast.show('Please add a phone number before paying.', 'error');
      return;
    }
    if (!this.hasAddress()) {
      this.toast.show('Please add a shipping address before paying.', 'error');
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
          if (!this.shippingAddress.trim()) {
            this.shippingAddress =
              u.fullAddress?.trim() ||
              u.streetAddress?.trim() ||
              '';
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
