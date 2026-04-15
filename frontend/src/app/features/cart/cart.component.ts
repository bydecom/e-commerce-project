import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subject, Subscription, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { CurrencyVndPipe } from '../../shared/pipes/currency-vnd.pipe';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';
import { ServerCartService } from '../../core/services/server-cart.service';

type CartLinePriced = {
  productId: number;
  quantity: number;
  name: string;
  unitPrice: number;
  lineTotal: number;
};

type CartPricingData = {
  items: CartLinePriced[];
  total: number;
};

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, CurrencyVndPipe],
  template: `
    <div class="bg-white">
      <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:max-w-7xl lg:px-8">
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Shopping Cart</h1>

        @if (loading()) {
          <div class="flex justify-center py-24">
            <div
              class="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900"
              aria-hidden="true"
            ></div>
          </div>
        } @else {

          @if (error()) {
            <div class="mt-6 rounded-md bg-red-50 p-4 shadow-sm border border-red-100">
              <div class="flex">
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-red-800">Failed to update cart</h3>
                  <div class="mt-2 text-sm text-red-700">
                    <p>{{ error() }}</p>
                  </div>
                </div>
              </div>
            </div>
          }

          @if (items().length === 0) {
            <div
              class="mt-8 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-24 text-center"
            >
              <svg
                class="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <h2 class="mt-4 text-lg font-medium text-gray-900">Your cart is empty</h2>
              <p class="mt-2 text-sm text-gray-500">Looks like you haven't added any items yet.</p>
              <a
                routerLink="/products"
                class="mt-6 inline-flex items-center rounded-sm bg-gray-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              >
                Continue shopping
              </a>
            </div>
          } @else {
            <form class="mt-12 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-12 xl:gap-x-16">

              <section aria-labelledby="cart-heading" class="lg:col-span-7">
                <h2 id="cart-heading" class="sr-only">Items in your shopping cart</h2>

                <ul role="list" class="divide-y divide-gray-200 border-b border-t border-gray-200">
                  @for (line of items(); track line.productId) {
                    <li class="flex py-6 sm:py-8">
                      <div class="flex flex-1 flex-col">
                        <div class="flex justify-between text-base font-medium text-gray-900">
                          <h3>
                            <a
                              [routerLink]="['/products', line.productId]"
                              class="hover:text-blue-600 transition-colors"
                            >
                              {{ line.name }}
                            </a>
                          </h3>
                          <p class="ml-4 whitespace-nowrap">{{ line.lineTotal | currencyVnd }}</p>
                        </div>
                        <p class="mt-1 text-sm text-gray-500">Unit price: {{ line.unitPrice | currencyVnd }}</p>

                        <div class="mt-4 flex flex-col gap-2 text-sm">
                          <div class="flex items-center justify-between">
                            <div class="inline-flex h-8 items-center rounded-sm border border-gray-300 bg-white shadow-sm">
                              <button
                                type="button"
                                (click)="adjustLineQuantity(line, -1)"
                                [disabled]="line.quantity <= 1"
                                class="flex h-full w-8 items-center justify-center text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <span class="sr-only">Decrease quantity</span>
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                                </svg>
                              </button>

                              <input
                                type="number"
                                [value]="line.quantity"
                                (change)="setLineQuantity(line, $event)"
                                class="h-full w-12 border-x border-gray-300 bg-transparent p-0 text-center text-sm font-semibold tabular-nums text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                min="1"
                              />

                              <button
                                type="button"
                                (click)="adjustLineQuantity(line, 1)"
                                [disabled]="line.quantity >= (knownMaxStocks()[line.productId] ?? 9999)"
                                class="flex h-full w-8 items-center justify-center text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <span class="sr-only">Increase quantity</span>
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>

                            <button
                              type="button"
                              (click)="deleteLine(line)"
                              class="flex items-center gap-1 font-medium text-red-600 transition-colors hover:text-red-500"
                            >
                              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              <span>Remove</span>
                            </button>
                          </div>

                          @if (lineErrors()[line.productId]) {
                            <p class="flex items-center gap-1 text-xs font-medium text-amber-600">
                              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              {{ lineErrors()[line.productId] }}
                            </p>
                          }
                        </div>
                      </div>
                    </li>
                  }
                </ul>
              </section>

              <section
                aria-labelledby="summary-heading"
                class="mt-16 rounded-lg bg-gray-50 px-4 py-6 sm:p-6 lg:col-span-5 lg:mt-0 lg:p-8 border border-gray-100 shadow-sm"
              >
                <h2 id="summary-heading" class="text-lg font-medium text-gray-900">Order Summary</h2>

                <dl class="mt-6 space-y-4">
                  <div class="flex items-center justify-between">
                    <dt class="text-sm text-gray-600">Subtotal</dt>
                    <dd class="text-sm font-medium text-gray-900">{{ total() | currencyVnd }}</dd>
                  </div>
                  <div class="flex items-center justify-between border-t border-gray-200 pt-4">
                    <dt class="flex items-center text-sm text-gray-600">
                      <span>Shipping</span>
                    </dt>
                    <dd class="text-sm font-medium text-gray-900">Free</dd>
                  </div>
                  <div class="flex items-center justify-between border-t border-gray-200 pt-4">
                    <dt class="text-base font-bold text-gray-900">Total</dt>
                    <dd class="text-base font-bold text-gray-900">{{ total() | currencyVnd }}</dd>
                  </div>
                </dl>

                <div class="mt-8">
                  <a
                    routerLink="/checkout"
                    class="block w-full rounded-sm bg-gray-900 px-4 py-3 text-center text-base font-bold text-white shadow-sm transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:ring-offset-gray-50"
                  >
                    Proceed to checkout
                  </a>
                </div>

                <div class="mt-4 text-center">
                  <p class="text-xs text-gray-500">
                    Or
                    <a routerLink="/products" class="font-medium text-blue-600 hover:text-blue-500">
                      continue shopping
                      <span aria-hidden="true"> &rarr;</span>
                    </a>
                  </p>
                </div>
              </section>

            </form>
          }
        }
      </div>
    </div>
  `,
})
export class CartComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly serverCart = inject(ServerCartService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lineErrors = signal<Record<number, string | undefined>>({});
  readonly items = signal<CartLinePriced[]>([]);
  readonly total = signal(0);

  readonly knownMaxStocks = signal<Record<number, number | undefined>>({});

  private readonly qtyChanges$ = new Subject<{ productId: number; name: string; quantity: number }>();
  private readonly sub = new Subscription();

  ngOnInit(): void {
    this.loadPricing();

    this.sub.add(
      this.qtyChanges$
        .pipe(
          debounceTime(300),
          switchMap((c) =>
            this.syncQuantity(c).pipe(
              switchMap(() => this.fetchPricing$()),
              tap((data) => this.applyPricing(data)),
              catchError((e: unknown) => {
                const anyErr = e as any;
                const status = typeof anyErr?.status === 'number' ? anyErr.status : undefined;
                const apiMessage =
                  typeof anyErr?.error?.message === 'string' ? anyErr.error.message : undefined;
                const availableStock =
                  typeof anyErr?.error?.errors?.availableStock === 'number'
                    ? anyErr.error.errors.availableStock
                    : undefined;

                if (status === 422 && typeof availableStock === 'number') {
                  const msg = `You can only order up to ${availableStock} item(s).`;
                  this.knownMaxStocks.update((m) => ({ ...m, [c.productId]: availableStock }));
                  this.lineErrors.update((m) => ({ ...m, [c.productId]: msg }));

                  // Ép quantity trên UI về đúng max để không bị "kẹt" ở số vượt quá
                  this.items.update((items) =>
                    items.map((it) =>
                      it.productId === c.productId ? { ...it, quantity: availableStock } : it
                    )
                  );

                  // Tự sync lại lên server với số lượng đã được clamp (tránh re-entrancy)
                  queueMicrotask(() => {
                    this.qtyChanges$.next({
                      productId: c.productId,
                      name: c.name,
                      quantity: availableStock,
                    });
                  });

                  return of(null);
                }

                const msg = apiMessage ?? anyErr?.message ?? 'Failed to update cart';
                this.error.set(msg);
                // Variant A (Reject): keep the user's chosen quantity in UI so they can adjust it.
                // Do NOT reload pricing here, otherwise the UI "auto decrements" back to server state.
                // For other errors, best-effort reload to resync.
                this.loadPricing();
                return of(null);
              })
            )
          )
        )
        .subscribe()
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  adjustLineQuantity(line: CartLinePriced, delta: number): void {
    const knownMax = this.knownMaxStocks()[line.productId] ?? 9999;
    const quantity = Math.min(knownMax, Math.max(1, line.quantity + delta));
    if (quantity === line.quantity) return;
    this.updateQuantityState(line, quantity);
  }

  setLineQuantity(line: CartLinePriced, event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = parseInt(input.value, 10);

    if (Number.isNaN(val) || val < 1) val = 1;

    const knownMax = this.knownMaxStocks()[line.productId];
    if (typeof knownMax === 'number' && val > knownMax) val = knownMax;

    if (val !== line.quantity) {
      this.updateQuantityState(line, val);
    } else {
      input.value = line.quantity.toString();
    }
  }

  private updateQuantityState(line: CartLinePriced, quantity: number): void {
    // Clear per-line error when user is adjusting.
    this.lineErrors.update((m) => {
      const next = { ...m };
      delete next[line.productId];
      return next;
    });

    // Update UI immediately; server will be synced + re-priced after debounce.
    this.items.update((items) =>
      items.map((it) => (it.productId === line.productId ? { ...it, quantity } : it))
    );

    this.qtyChanges$.next({ productId: line.productId, name: line.name, quantity });
  }

  deleteLine(line: CartLinePriced): void {
    // Immediate effect for delete.
    const next = this.items().filter((it) => it.productId !== line.productId);
    this.items.set(next);
    this.total.set(next.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0));

    this.http
      .delete<ApiSuccess<{ removed: boolean }>>(
        `${environment.apiUrl}/api/cart/items/${line.productId}`
      )
      .pipe(
        switchMap(() => this.fetchPricing$()),
        tap((data) => this.applyPricing(data)),
        catchError((e: Error) => {
          this.error.set(e.message ?? 'Failed to delete item');
          // Reload best-effort so UI matches server state.
          this.loadPricing();
          return of(null);
        })
      )
      .subscribe();
  }

  private loadPricing(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fetchPricing$()
      .pipe(
        tap((data) => this.applyPricing(data)),
        catchError((e: Error) => {
          this.error.set(e.message ?? 'Failed to load cart');
          this.items.set([]);
          this.total.set(0);
          return of(null);
        }),
        tap(() => this.loading.set(false))
      )
      .subscribe();
  }

  private fetchPricing$() {
    return this.http
      .get<ApiSuccess<CartPricingData>>(`${environment.apiUrl}/api/cart/pricing`)
      .pipe(
        map((r) => {
          if (!r.success) throw new Error(r.message);
          return r.data;
        })
      );
  }

  private syncQuantity(input: { productId: number; name: string; quantity: number }) {
    if (input.quantity <= 0) {
      return this.http
        .delete<ApiSuccess<{ removed: boolean }>>(`${environment.apiUrl}/api/cart/items/${input.productId}`)
        .pipe(map(() => undefined));
    }

    const put$ = this.http.put<ApiSuccess<CartLinePriced>>(
      `${environment.apiUrl}/api/cart/items/${input.productId}`,
      { quantity: input.quantity, name: input.name, mode: 'set' }
    );
    return put$.pipe(map(() => undefined));
  }

  private applyPricing(data: CartPricingData | null): void {
    if (!data) return;
    this.items.set(data.items);
    this.total.set(data.total);
    this.serverCart.refresh().subscribe();
    this.loading.set(false);
    this.error.set(null);
  }
}
