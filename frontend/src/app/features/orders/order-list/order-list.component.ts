import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderApiService } from '../../../core/services/order-api.service';
import { ProductApiService } from '../../../core/services/product-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { OrderStatusBadgeComponent } from '../../../shared/components/order-status-badge/order-status-badge.component';
import { CurrencyVndPipe } from '../../../shared/pipes/currency-vnd.pipe';
import type { OrderDetail } from '../../../shared/models/order.model';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [RouterLink, OrderStatusBadgeComponent, CurrencyVndPipe, DatePipe],
  template: `
    <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900">My Orders</h1>
        <p class="text-sm text-gray-500">Check the status of your recent orders.</p>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (i of [1, 2, 3]; track i) {
            <div class="h-24 w-full animate-pulse rounded-xl bg-gray-100"></div>
          }
        </div>
      } @else if (orders().length === 0) {
        <div class="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <p class="text-gray-500">You haven't placed any orders yet.</p>
          <a
            routerLink="/products"
            class="mt-4 inline-block text-sm font-bold text-indigo-600 hover:underline"
            >Start shopping &rarr;</a
          >
        </div>
      } @else {
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th class="px-6 py-4">Order ID</th>
                <th class="px-6 py-4">Date</th>
                <th class="px-6 py-4">Total</th>
                <th class="px-6 py-4">Status</th>
                <th class="px-6 py-4">Feedback</th>
                <th class="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              @for (o of orders(); track o.id) {
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 font-medium text-gray-900">#{{ o.id }}</td>
                  <td class="px-6 py-4 text-gray-500">{{ o.createdAt | date: 'mediumDate' }}</td>
                  <td class="px-6 py-4 font-bold text-gray-900">{{ o.total | currencyVnd }}</td>
                  <td class="px-6 py-4">
                    <app-order-status-badge [status]="o.status" />
                  </td>
                  <td class="px-6 py-4">
                    @if (o.status === 'DONE') {
                      <button
                        type="button"
                        (click)="toggleFeedback(o.id)"
                        class="text-sm font-semibold text-indigo-600 hover:text-indigo-900"
                      >
                        {{ expandedOrderId() === o.id ? 'Hide' : 'Leave a review' }}
                      </button>
                    } @else {
                      <span class="text-xs text-gray-400">—</span>
                    }
                  </td>
                  <td class="px-6 py-4 text-right">
                    <a
                      [routerLink]="['/orders', o.id]"
                      class="font-semibold text-indigo-600 hover:text-indigo-900"
                      >View Details</a
                    >
                  </td>
                </tr>

                @if (expandedOrderId() === o.id) {
                  <tr class="bg-gray-50/40">
                    <td colspan="6" class="px-6 py-5">
                      <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div class="mb-4">
                          <h3 class="text-sm font-bold text-gray-900">Rate your items</h3>
                          <p class="mt-1 text-xs text-gray-500">
                            Choose a star rating and optionally leave a comment for each product.
                          </p>
                        </div>

                        <div class="space-y-4">
                          @for (it of o.items; track it.productId) {
                            <div class="rounded-lg border border-gray-200 p-4">
                              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div class="min-w-0">
                                  <p class="font-semibold text-gray-900">{{ it.name }}</p>
                                  <p class="mt-1 text-xs text-gray-500">
                                    Unit price: {{ it.unitPrice | currencyVnd }} · Qty: {{ it.quantity }}
                                  </p>
                                </div>

                                <div class="flex items-center gap-1">
                                  @for (s of [1, 2, 3, 4, 5]; track s) {
                                    <button
                                      type="button"
                                      (click)="setStars(o.id, it.productId, s)"
                                      [disabled]="isSubmitted(o.id, it.productId)"
                                      class="h-9 w-9 rounded-md border text-sm font-extrabold transition disabled:opacity-60"
                                      [class]="
                                        getStars(o.id, it.productId) >= s
                                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                                          : 'border-gray-200 bg-white text-gray-300 hover:bg-gray-50'
                                      "
                                      [attr.aria-label]="'Set rating to ' + s + ' stars'"
                                    >
                                      ★
                                    </button>
                                  }
                                </div>
                              </div>

                              <div class="mt-3">
                                <textarea
                                  rows="2"
                                  class="block w-full rounded-lg border-0 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                                  [value]="getComment(o.id, it.productId)"
                                  (input)="setComment(o.id, it.productId, $event)"
                                  [disabled]="isSubmitted(o.id, it.productId)"
                                  placeholder="Write a comment (optional)"
                                ></textarea>
                              </div>

                              <div class="mt-3 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  (click)="submitFeedback(o.id, it.productId)"
                                  [disabled]="isSubmitting(o.id, it.productId) || getStars(o.id, it.productId) < 1"
                                  class="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                                >
                                  @if (isSubmitting(o.id, it.productId)) {
                                    <span
                                      class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                                    ></span>
                                  }
                                  @if (isSubmitted(o.id, it.productId)) {
                                    Submitted
                                  } @else {
                                    Submit
                                  }
                                </button>
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class OrderListComponent implements OnInit {
  private readonly api = inject(OrderApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly toast = inject(ToastService);

  orders = signal<OrderDetail[]>([]);
  loading = signal(true);
  expandedOrderId = signal<number | null>(null);

  private readonly starsByKey = signal<Record<string, number>>({});
  private readonly commentByKey = signal<Record<string, string>>({});
  private readonly submittingByKey = signal<Record<string, boolean>>({});
  private readonly submittedByKey = signal<Record<string, boolean>>({});

  ngOnInit() {
    this.api.getMyOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleFeedback(orderId: number): void {
    this.expandedOrderId.set(this.expandedOrderId() === orderId ? null : orderId);
  }

  private key(orderId: number, productId: number): string {
    return `${orderId}:${productId}`;
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
          this.closeIfAllSubmitted(orderId);
        },
        error: (e: Error) => {
          this.submittingByKey.update((m) => ({ ...m, [k]: false }));
          const msg = e.message || 'Failed to submit review.';
          if (msg.includes('already been submitted')) {
            this.submittedByKey.update((m) => ({ ...m, [k]: true }));
            this.toast.show('You already submitted a review for this item.', 'info');
            this.closeIfAllSubmitted(orderId);
            return;
          }
          this.toast.show(msg, 'error');
        },
      });
  }

  private closeIfAllSubmitted(orderId: number): void {
    const o = this.orders().find((x) => x.id === orderId);
    if (!o) return;
    const allDone = o.items.every((it) => this.isSubmitted(orderId, it.productId));
    if (allDone) {
      this.expandedOrderId.set(null);
    }
  }
}
