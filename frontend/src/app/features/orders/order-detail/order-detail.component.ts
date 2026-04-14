import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderApiService } from '../../../core/services/order-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CurrencyVndPipe } from '../../../shared/pipes/currency-vnd.pipe';
import type { OrderDetail, OrderStatus } from '../../../shared/models/order.model';

function nextStatusesForUser(current: OrderStatus): OrderStatus[] {
  switch (current) {
    case 'PENDING':
      return ['CANCELLED'];
    default:
      return [];
  }
}

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [RouterLink, CurrencyVndPipe],
  template: `
    <div class="mx-auto w-full max-w-6xl">
      <a routerLink="/orders" class="text-sm text-blue-600 hover:underline">← Back to orders</a>

      @if (loading()) {
        <p class="mt-6 text-gray-600">Loading...</p>
      } @else if (error()) {
        <p class="mt-6 text-red-600">{{ error() }}</p>
      } @else if (order()) {
        <h1 class="mt-2 text-2xl font-bold text-gray-900">Order #{{ order()!.id }}</h1>

        <div class="mt-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div class="flex items-center gap-4">
              <div
                class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2"
                [class]="statusIconClass(order()!.status)"
              >
                @switch (order()!.status) {
                  @case ('PENDING') {
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                  @case ('CONFIRMED') {
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                  @case ('SHIPPING') {
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                      />
                    </svg>
                  }
                  @case ('DONE') {
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  }
                  @case ('CANCELLED') {
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                  @default {
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                  }
                }
              </div>
              <div>
                <p class="text-sm font-semibold uppercase tracking-wide text-gray-500">Status</p>
                <p class="text-2xl font-extrabold" [class]="statusTitleClass(order()!.status)">
                  {{ statusLabel(order()!.status) }}
                </p>
              </div>
            </div>

            @if (nextOptions().length > 0) {
              <div
                class="flex min-h-[8.5rem] w-full flex-col justify-center sm:min-h-[7.25rem] md:min-h-[6.75rem] md:items-end md:justify-center"
              >
                @if (!pendingConfirmation()) {
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 md:justify-end">
                    <p class="text-sm font-medium text-gray-600">Update to:</p>
                    <div class="flex flex-wrap gap-2">
                      @for (s of nextOptions(); track s) {
                        <button
                          type="button"
                          (click)="selectNextAndConfirm(s)"
                          [disabled]="saving()"
                          class="min-h-[2.5rem] rounded-lg border px-4 py-2 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-50"
                          [class]="
                            s === 'CANCELLED'
                              ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                              : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                          "
                        >
                          {{ statusLabel(s) }}
                        </button>
                      }
                    </div>
                  </div>
                } @else {
                  <div
                    class="flex flex-col items-stretch gap-2 transition duration-300 ease-out motion-reduce:transition-none sm:items-end md:justify-center"
                  >
                    <p class="text-sm font-medium text-gray-800">
                      Confirm update to
                      <span class="rounded bg-gray-100 px-2 py-0.5 font-bold uppercase">{{
                        statusLabel(selectedNext!)
                      }}</span
                      >?
                    </p>
                    <div class="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        (click)="cancelStatusConfirmation()"
                        [disabled]="saving()"
                        class="min-h-[2.5rem] rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        (click)="confirmAndApplyStatus()"
                        [disabled]="saving()"
                        class="flex min-h-[2.5rem] items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                        [class]="
                          selectedNext === 'CANCELLED'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-gray-900 hover:bg-gray-800'
                        "
                      >
                        @if (saving()) {
                          <svg
                            class="h-4 w-4 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              class="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              stroke-width="4"
                            ></circle>
                            <path
                              class="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        }
                        Confirm
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <div class="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div
            class="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"
            >
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div>
              <h2 class="text-sm font-bold uppercase tracking-wide text-gray-900">Customer Info</h2>
              <p class="mt-2 text-base font-semibold text-gray-800">
                {{ order()!.user.name || 'Guest Customer' }}
              </p>
              <a [href]="'mailto:' + order()!.user.email" class="text-sm text-blue-600 hover:underline">
                {{ order()!.user.email }}
              </a>
            </div>
          </div>

          <div
            class="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="size-6"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                />
              </svg>
            </div>
            <div class="flex-1">
              <h2 class="text-sm font-bold uppercase tracking-wide text-gray-900">Shipping Address</h2>
              <p class="mt-2 text-sm leading-relaxed text-gray-600">
                {{ order()!.shippingAddress }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div class="flex items-center gap-2 border-b border-gray-200 bg-gray-50/50 px-5 py-3">
            <svg class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <h2 class="text-base font-bold text-gray-900">Order Items</h2>
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
                    Unit Price
                  </th>
                  <th class="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Line Total
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 bg-white">
                @for (line of order()!.items; track line.productId) {
                  <tr class="transition-colors hover:bg-gray-50">
                    <td class="px-5 py-3 font-medium text-gray-900">{{ line.name }}</td>
                    <td class="px-5 py-3 text-center text-gray-600">
                      <span class="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{{
                        line.quantity
                      }}</span>
                    </td>
                    <td class="px-5 py-3 text-right text-gray-500">{{ line.unitPrice | currencyVnd }}</td>
                    <td class="px-5 py-3 text-right font-semibold text-gray-900">
                      {{ line.quantity * line.unitPrice | currencyVnd }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="border-t border-gray-200 bg-gray-50 p-5">
            <div class="flex flex-col items-end gap-2">
              <div class="flex w-full max-w-sm justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{{ order()!.total | currencyVnd }}</span>
              </div>
              <div class="flex w-full max-w-sm justify-between text-sm text-gray-600">
                <span>Shipping fee</span>
                <span>Free</span>
              </div>
              <div class="mt-1 flex w-full max-w-sm justify-between border-t border-gray-200 pt-3">
                <span class="text-base font-bold text-gray-900">Total</span>
                <span class="text-xl font-extrabold text-indigo-600">{{ order()!.total | currencyVnd }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-2 flex items-center justify-between text-xs text-gray-400">
          <p>Created: <span class="font-medium text-gray-500">{{ formatDate(order()!.createdAt) }}</span></p>
          <p>Last updated: <span class="font-medium text-gray-500">{{ formatDate(order()!.updatedAt) }}</span></p>
        </div>
      }
    </div>
  `,
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OrderApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly order = signal<OrderDetail | null>(null);
  readonly nextOptions = signal<OrderStatus[]>([]);
  /** Second step: must confirm before API call. */
  readonly pendingConfirmation = signal(false);

  selectedNext: OrderStatus | null = null;

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (Number.isNaN(id)) {
      this.error.set('Invalid order id.');
      this.loading.set(false);
      return;
    }
    this.load(id);
  }

  statusLabel(s: OrderStatus): string {
    switch (s) {
      case 'PENDING':
        return 'Pending';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'SHIPPING':
        return 'Shipping';
      case 'DONE':
        return 'Done';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return s;
    }
  }

  /** Icon ring + fill + stroke (currentColor) for status badge. */
  statusIconClass(status: OrderStatus): string {
    switch (status) {
      case 'PENDING':
        return 'border-orange-400 bg-orange-100 text-orange-600';
      case 'CONFIRMED':
        return 'border-blue-400 bg-blue-100 text-blue-600';
      case 'SHIPPING':
        return 'border-indigo-400 bg-indigo-100 text-indigo-600';
      case 'DONE':
        return 'border-emerald-400 bg-emerald-100 text-emerald-600';
      case 'CANCELLED':
        return 'border-gray-400 bg-gray-200 text-gray-600';
      default:
        return 'border-gray-300 bg-gray-50 text-gray-600';
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
        return 'text-emerald-950';
      case 'CANCELLED':
        return 'text-gray-800';
      default:
        return 'text-gray-900';
    }
  }

  selectNextAndConfirm(s: OrderStatus): void {
    this.selectedNext = s;
    this.pendingConfirmation.set(true);
  }

  cancelStatusConfirmation(): void {
    this.pendingConfirmation.set(false);
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  confirmAndApplyStatus(): void {
    const o = this.order();
    const next = this.selectedNext;
    if (!o || !next || !this.pendingConfirmation()) return;
    if (next !== 'CANCELLED') return;

    this.saving.set(true);
    this.api.cancelMine(o.id).subscribe({
      next: (updated) => {
        this.order.set(updated);
        const opts = nextStatusesForUser(updated.status);
        this.nextOptions.set(opts);
        this.selectedNext = opts[0] ?? null;
        this.pendingConfirmation.set(false);
        this.saving.set(false);
        this.toast.show('Order cancelled.', 'success');
      },
      error: (e: Error) => {
        this.saving.set(false);
        this.toast.show(e.message || 'Cancel failed.', 'error');
      },
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getMine(id).subscribe({
      next: (data) => {
        this.order.set(data);
        const opts = nextStatusesForUser(data.status);
        this.nextOptions.set(opts);
        this.selectedNext = opts[0] ?? null;
        this.pendingConfirmation.set(false);
        this.loading.set(false);
      },
      error: (e: Error) => {
        this.error.set(e.message || 'Failed to load order.');
        this.loading.set(false);
      },
    });
  }
}
