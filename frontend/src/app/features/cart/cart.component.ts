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
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="text-2xl font-bold text-gray-900">Cart</h1>

      @if (loading()) {
        <p class="mt-4 text-gray-600">Loading your cart…</p>
      } @else {
        @if (error()) {
          <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900" role="alert">
            {{ error() }}
          </div>
        }
      }

      @if (!loading() && items().length === 0) {
        <p class="mt-4 text-gray-600">Your cart is empty.</p>
        <a routerLink="/products" class="mt-4 inline-block text-blue-600 hover:underline">Continue shopping</a>
      } @else if (!loading()) {
        <ul class="mt-6 divide-y rounded-lg border border-gray-200">
          @for (line of items(); track line.productId) {
            <li class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0">
                <p class="truncate font-medium text-gray-900">{{ line.name }}</p>
                <p class="mt-1 text-sm text-gray-600">
                  Unit: {{ line.unitPrice | currencyVnd }}
                </p>
              </div>

              <div class="flex items-center justify-between gap-3 sm:justify-end">
                <div class="flex flex-col items-end gap-1">
                  <div
                    class="inline-flex overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm"
                    role="group"
                    [attr.aria-label]="'Quantity for ' + line.name"
                  >
                    <button
                      type="button"
                      class="min-w-[2.75rem] px-3 py-2 text-lg font-semibold leading-none text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      (click)="adjustLineQuantity(line, -1)"
                      [disabled]="line.quantity <= 1"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span
                      class="flex min-w-[2.75rem] items-center justify-center border-x border-gray-300 px-3 py-2 text-base font-semibold tabular-nums text-gray-900"
                      aria-live="polite"
                    >
                      {{ line.quantity }}
                    </span>
                    <button
                      type="button"
                      class="min-w-[2.75rem] px-3 py-2 text-lg font-semibold leading-none text-gray-800 transition hover:bg-gray-50"
                      (click)="adjustLineQuantity(line, 1)"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  @if (lineErrors()[line.productId]) {
                    <p class="text-xs font-medium text-amber-700">
                      {{ lineErrors()[line.productId] }}
                    </p>
                  }
                </div>

                <div class="w-28 text-right font-semibold text-gray-900">
                  {{ line.lineTotal | currencyVnd }}
                </div>

                <button
                  type="button"
                  class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  (click)="deleteLine(line)"
                >
                  Remove
                </button>
              </div>
            </li>
          }
        </ul>

        <p class="mt-4 text-right text-lg font-semibold">
          Total: {{ total() | currencyVnd }}
        </p>
        <a
          routerLink="/checkout"
          class="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700"
        >
          Checkout
        </a>
      }
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
                  // Per-line error so multiple items don't overwrite each other.
                  const msg = `Bạn chỉ có thể đặt tối đa ${availableStock} sản phẩm.`;
                  this.lineErrors.set({ ...this.lineErrors(), [c.productId]: msg });
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
    const quantity = Math.max(0, line.quantity + delta);

    // Clear per-line error when user is adjusting.
    const nextLineErrors = { ...this.lineErrors() };
    delete nextLineErrors[line.productId];
    this.lineErrors.set(nextLineErrors);

    // Update UI immediately; server will be synced + re-priced after debounce.
    this.items.set(
      this.items().map((it) => (it.productId === line.productId ? { ...it, quantity } : it))
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
