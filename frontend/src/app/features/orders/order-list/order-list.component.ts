import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderApiService } from '../../../core/services/order-api.service';
import { ProductApiService } from '../../../core/services/product-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CurrencyVndPipe } from '../../../shared/pipes/currency-vnd.pipe';
import type { OrderDetail, OrderStatus } from '../../../shared/models/order.model';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [RouterLink, CurrencyVndPipe, DatePipe],
  template: `
    <div class="bg-white">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">My orders</h1>

        @if (loading()) {
          <div class="flex justify-center py-24">
            <div
              class="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900"
              aria-hidden="true"
            ></div>
          </div>
        } @else {

          @if (error()) {
            <div class="mt-8 rounded-md bg-red-50 p-4 shadow-sm border border-red-100">
              <div class="flex">
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-red-800">Failed to load orders</h3>
                  <div class="mt-2 text-sm text-red-700">
                    <p>{{ error() }}</p>
                  </div>
                </div>
              </div>
            </div>
          }

          @if (orders().length === 0) {
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
              <h2 class="mt-4 text-lg font-medium text-gray-900">You have no orders yet</h2>
              <p class="mt-2 text-sm text-gray-500">Looks like you haven't placed any orders.</p>
              <a
                routerLink="/products"
                class="mt-6 inline-flex items-center rounded-sm bg-gray-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              >
                Start shopping
              </a>
            </div>
          } @else {
            <div class="mt-12 space-y-6">
              @for (o of orders(); track o.id) {
                <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
                  <div class="flex flex-col border-b border-gray-100 p-5 sm:flex-row sm:items-center">
                <div class="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-slate-100 to-slate-200">
                  <img
                    [src]="o.items.at(0)?.imageUrl || 'https://via.placeholder.com/160x160?text=Product'"
                    class="h-full w-full object-contain p-2"
                    alt="Order Thumbnail"
                  />
                  @if (o.items.length > 1) {
                    <div class="absolute bottom-0 right-0 bg-black/70 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                      +{{ o.items.length - 1 }}
                    </div>
                  }
                </div>

                <div class="mt-5 flex flex-1 flex-col gap-5 sm:ml-6 sm:mt-0 sm:flex-row sm:items-center sm:justify-between">
                  <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order</p>
                      <p class="mt-1 text-base font-bold text-gray-900">#{{ o.id }}</p>
                    </div>
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Placed on</p>
                      <p class="mt-1 text-sm font-medium text-gray-700">{{ o.createdAt | date: 'dd/MM/yyyy' }}</p>
                    </div>
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</p>
                      <p class="mt-1 text-base font-extrabold text-indigo-600">{{ o.total | currencyVnd }}</p>
                    </div>
                  </div>

                  <div class="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end">
                    <div class="flex flex-wrap items-center gap-3 sm:justify-end">
                      @if (o.status === 'DONE' && !isOrderFullyReviewed(o)) {
                        <button
                          type="button"
                          (click)="toggleFeedback(o.id)"
                          class="rounded-lg bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          {{ expandedOrderId() === o.id ? 'Close review' : 'Review' }}
                        </button>
                      }

                      <div class="flex items-center gap-2 rounded-full px-3 py-1.5" [class]="statusIconClass(o.status)">
                        @switch (o.status) {
                          @case ('PENDING') {
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                          @case ('CONFIRMED') {
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                          @case ('SHIPPING') {
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                            </svg>
                          }
                          @case ('DONE') {
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                          }
                          @case ('CANCELLED') {
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          }
                          @default {
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                          }
                        }
                        <span class="text-xs font-bold uppercase tracking-wide">{{ statusLabel(o.status) }}</span>
                      </div>

                      <a
                        [routerLink]="['/orders', o.id]"
                        class="text-xs font-bold text-gray-500 hover:text-gray-900 hover:underline"
                        >View details &rarr;</a
                      >
                    </div>
                  </div>
                </div>
              </div>

              @if (expandedOrderId() === o.id) {
                <div class="bg-gray-50 p-6 border-t border-gray-100">
                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    @for (it of getVisibleItems(o); track it.productId) {
                      @if (isSubmitted(o.id, it.productId)) {
                        <div class="flex h-full min-h-[160px] flex-col items-center justify-center rounded-xl border border-green-200 bg-green-50 p-4 text-green-700 shadow-sm animate-pulse">
                          <div class="mb-3 rounded-full bg-green-100 p-3">
                            <svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p class="text-sm font-bold">Review submitted!</p>
                        </div>
                      } @else {
                        <div class="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                          <div class="flex items-center gap-3">
                            <img
                              [src]="it.imageUrl || 'https://via.placeholder.com/96x96?text=Product'"
                              class="h-12 w-12 rounded-lg border border-gray-100 object-cover"
                            />
                            <div class="min-w-0">
                              <p class="truncate text-sm font-bold text-gray-900">{{ it.name }}</p>
                              <p class="text-xs font-medium text-gray-500">Qty: {{ it.quantity }}</p>
                            </div>
                          </div>

                          <div class="flex items-center gap-1">
                            @for (s of [1, 2, 3, 4, 5]; track s) {
                              <button
                                type="button"
                                (click)="setStars(o.id, it.productId, s)"
                                class="text-2xl transition-transform hover:scale-110"
                                [class]="getStars(o.id, it.productId) >= s ? 'text-amber-400' : 'text-gray-200'"
                              >
                                ★
                              </button>
                            }
                          </div>

                          <textarea
                            [value]="getComment(o.id, it.productId)"
                            (input)="setComment(o.id, it.productId, $event)"
                            placeholder="Share your thoughts about this product..."
                            class="w-full rounded-lg border-gray-200 bg-gray-50 p-3 text-xs focus:border-indigo-500 focus:ring-indigo-500"
                          ></textarea>

                          <button
                            type="button"
                            (click)="submitFeedback(o.id, it.productId)"
                            [disabled]="isSubmitting(o.id, it.productId) || getStars(o.id, it.productId) < 1"
                            class="w-full rounded-lg bg-gray-900 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50"
                          >
                            @if (isSubmitting(o.id, it.productId)) {
                              Submitting...
                            } @else {
                              Submit review
                            }
                          </button>
                        </div>
                      }
                    }
                  </div>
                </div>
              }
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class OrderListComponent implements OnInit {
  private readonly api = inject(OrderApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly toast = inject(ToastService);

  orders = signal<OrderDetail[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  expandedOrderId = signal<number | null>(null);

  private readonly starsByKey = signal<Record<string, number>>({});
  private readonly commentByKey = signal<Record<string, string>>({});
  private readonly submittingByKey = signal<Record<string, boolean>>({});
  private readonly submittedByKey = signal<Record<string, boolean>>({});
  private readonly hiddenByKey = signal<Record<string, boolean>>({});

  ngOnInit() {
    this.loading.set(true);
    this.error.set(null);
    this.api.getMyOrders().subscribe({
      next: (data) => {
        this.orders.set((Array.isArray(data) ? data : []).filter((o) => o.paymentStatus === 'PAID'));
        this.loading.set(false);
      },
      error: (e: Error) => {
        this.error.set(e.message || 'Failed to load orders');
        this.loading.set(false);
      },
    });
  }

  // --- Đồng bộ UI Vibe với OrderDetailComponent ---
  statusLabel(s: OrderStatus): string {
    switch (s) {
      case 'PENDING':
        return 'Pending';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'SHIPPING':
        return 'Shipping';
      case 'DONE':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return s;
    }
  }

  statusIconClass(status: OrderStatus): string {
    switch (status) {
      case 'PENDING':
        return 'bg-orange-100 text-orange-600 border border-orange-200';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-600 border border-blue-200';
      case 'SHIPPING':
        return 'bg-indigo-100 text-indigo-600 border border-indigo-200';
      case 'DONE':
        return 'bg-green-100 text-green-700 border border-green-200';
      case 'CANCELLED':
        return 'bg-gray-200 text-gray-600 border border-gray-300';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  }

  statusTitleClass(status: OrderStatus): string {
    switch (status) {
      case 'PENDING':
        return 'text-orange-950';
      case 'CONFIRMED':
        return 'text-blue-950';
      case 'SHIPPING':
        return 'text-indigo-950';
      case 'DONE':
        return 'text-indigo-950';
      case 'CANCELLED':
        return 'text-gray-800';
      default:
        return 'text-gray-900';
    }
  }
  // -------------------------------------------------

  isOrderFullyReviewed(order: OrderDetail): boolean {
    return order.items.every((it) => Boolean(it.isReviewed) || this.isSubmitted(order.id, it.productId));
  }

  toggleFeedback(orderId: number): void {
    this.expandedOrderId.set(this.expandedOrderId() === orderId ? null : orderId);
  }

  private key(orderId: number, productId: number): string {
    return `${orderId}:${productId}`;
  }

  getVisibleItems(order: OrderDetail) {
    const hidden = this.hiddenByKey();
    return order.items
      .filter((it) => !it.isReviewed && !hidden[this.key(order.id, it.productId)])
      .slice(0, 2);
  }

  getStars(orderId: number, productId: number): number {
    return this.starsByKey()[this.key(orderId, productId)] ?? 0;
  }

  setStars(orderId: number, productId: number, stars: number): void {
    const k = this.key(orderId, productId);
    this.starsByKey.update((m) => ({ ...m, [k]: stars }));
  }

  getComment(orderId: number, productId: number): string {
    return this.commentByKey()[this.key(orderId, productId)] ?? '';
  }

  setComment(orderId: number, productId: number, ev: Event): void {
    const v = (ev.target as HTMLTextAreaElement).value;
    const k = this.key(orderId, productId);
    this.commentByKey.update((m) => ({ ...m, [k]: v }));
  }

  isSubmitting(orderId: number, productId: number): boolean {
    return this.submittingByKey()[this.key(orderId, productId)] ?? false;
  }

  isSubmitted(orderId: number, productId: number): boolean {
    return this.submittedByKey()[this.key(orderId, productId)] ?? false;
  }

  submitFeedback(orderId: number, productId: number): void {
    const rating = this.getStars(orderId, productId);
    if (rating < 1) return;

    const k = this.key(orderId, productId);
    const comment = this.getComment(orderId, productId).trim();

    this.submittingByKey.update((m) => ({ ...m, [k]: true }));
    this.productApi
      .createFeedback({ orderId, productId, rating, ...(comment ? { comment } : {}) })
      .subscribe({
        next: () => {
          this.submittingByKey.update((m) => ({ ...m, [k]: false }));
          this.submittedByKey.update((m) => ({ ...m, [k]: true }));
          this.toast.show('Thanks! Your review has been submitted.', 'success');

          // After 1.5s -> Hide item to make room for next item
          setTimeout(() => {
            this.hiddenByKey.update((m) => ({ ...m, [k]: true }));
            this.closeIfAllSubmitted(orderId);
          }, 1500);
        },
        error: (e: Error) => {
          this.submittingByKey.update((m) => ({ ...m, [k]: false }));
          const msg = e.message || 'Could not submit review.';
          if (msg.includes('already been submitted')) {
            this.submittedByKey.update((m) => ({ ...m, [k]: true }));
            this.toast.show('You already submitted a review for this item.', 'info');

            // If already submitted before, also delay and hide it
            setTimeout(() => {
              this.hiddenByKey.update((m) => ({ ...m, [k]: true }));
              this.closeIfAllSubmitted(orderId);
            }, 1500);
            return;
          }
          this.toast.show(msg, 'error');
        },
      });
  }

  private closeIfAllSubmitted(orderId: number): void {
    const o = this.orders().find((x) => x.id === orderId);
    if (!o) return;
    // Close panel if the displayed list is empty
    if (this.getVisibleItems(o).length === 0) this.expandedOrderId.set(null);
  }
}