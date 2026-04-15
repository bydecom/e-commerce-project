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
      <div class="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight text-gray-900">Đơn hàng của tôi</h1>
          <p class="mt-2 text-sm text-gray-500">Quản lý và đánh giá các sản phẩm bạn đã mua.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="space-y-4">
          @for (i of [1, 2, 3]; track i) {
            <div class="h-32 w-full animate-pulse rounded-2xl bg-gray-100"></div>
          }
        </div>
      } @else if (orders().length === 0) {
        <div
          class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-gray-50 py-24 text-center"
        >
          <p class="text-gray-500">Bạn chưa có đơn hàng nào.</p>
          <a routerLink="/products" class="mt-4 font-bold text-indigo-600 hover:underline"
            >Mua sắm ngay &rarr;</a
          >
        </div>
      } @else {
        <div class="space-y-6">
          @for (o of orders(); track o.id) {
            <div
              class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
            >
              <div
                class="flex flex-col border-b border-gray-100 bg-gray-50/50 p-5 sm:flex-row sm:items-center"
              >
                <div
                  class="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white"
                >
                  <img
                    [src]="o.items.at(0)?.imageUrl || 'https://via.placeholder.com/160x160?text=Product'"
                    class="h-full w-full object-cover"
                    alt="Order Thumbnail"
                  />
                  @if (o.items.length > 1) {
                    <div
                      class="absolute bottom-0 right-0 bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white"
                    >
                      +{{ o.items.length - 1 }}
                    </div>
                  }
                </div>

                <div
                  class="mt-4 flex flex-1 flex-col gap-4 sm:ml-6 sm:mt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Mã đơn hàng</p>
                      <p class="mt-1 font-bold text-gray-900">#{{ o.id }}</p>
                    </div>
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Ngày đặt</p>
                      <p class="mt-1 text-sm text-gray-700">{{ o.createdAt | date: 'dd/MM/yyyy' }}</p>
                    </div>
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Tổng tiền</p>
                      <p class="mt-1 font-extrabold text-indigo-600">{{ o.total | currencyVnd }}</p>
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <app-order-status-badge [status]="o.status" />

                    @if (o.status === 'DONE' && !isOrderFullyReviewed(o)) {
                      <button
                        type="button"
                        (click)="toggleFeedback(o.id)"
                        class="rounded-lg bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                      >
                        {{ expandedOrderId() === o.id ? 'Đóng' : 'Đánh giá' }}
                      </button>
                    }
                    <a
                      [routerLink]="['/orders', o.id]"
                      class="text-xs font-bold text-gray-500 hover:text-gray-900"
                      >Chi tiết</a
                    >
                  </div>
                </div>
              </div>

              @if (expandedOrderId() === o.id) {
                <div class="bg-indigo-50/20 p-6">
                  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    @for (it of o.items; track it.productId) {
                      <div class="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div class="flex items-center gap-3">
                          <img
                            [src]="it.imageUrl || 'https://via.placeholder.com/96x96?text=Product'"
                            class="h-12 w-12 rounded-lg object-cover"
                          />
                          <div class="min-w-0">
                            <p class="truncate text-sm font-bold text-gray-900">{{ it.name }}</p>
                            <p class="text-xs text-gray-500">Số lượng: {{ it.quantity }}</p>
                          </div>
                        </div>

                        @if (it.isReviewed || isSubmitted(o.id, it.productId)) {
                          <div
                            class="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                          >
                            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              />
                            </svg>
                            Đã gửi đánh giá
                          </div>
                        } @else {
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
                            placeholder="Chia sẻ cảm nhận về sản phẩm..."
                            class="w-full rounded-lg border-gray-200 bg-gray-50 p-2 text-xs focus:ring-indigo-500"
                          ></textarea>

                          <button
                            type="button"
                            (click)="submitFeedback(o.id, it.productId)"
                            [disabled]="isSubmitting(o.id, it.productId) || getStars(o.id, it.productId) < 1"
                            class="w-full rounded-lg bg-gray-900 py-2 text-xs font-bold text-white transition hover:bg-gray-800 disabled:opacity-50"
                          >
                            Gửi đánh giá
                          </button>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
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

  isOrderFullyReviewed(order: OrderDetail): boolean {
    return order.items.every((it) => Boolean(it.isReviewed) || this.isSubmitted(order.id, it.productId));
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
    if (this.isOrderFullyReviewed(o)) {
      setTimeout(() => this.expandedOrderId.set(null), 1500);
    }
  }
}
