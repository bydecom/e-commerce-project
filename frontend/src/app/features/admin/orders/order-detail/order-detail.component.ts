import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyVndPipe } from '../../../../shared/pipes/currency-vnd.pipe';
import { OrderApiService } from '../../../../core/services/order-api.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { OrderDetail, OrderStatus } from '../../../../shared/models/order.model';

function nextStatuses(current: OrderStatus): OrderStatus[] {
  switch (current) {
    case 'PENDING':
      return ['CONFIRMED', 'CANCELLED'];
    case 'CONFIRMED':
      return ['SHIPPING'];
    case 'SHIPPING':
      return ['DONE'];
    default:
      return [];
  }
}

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, CurrencyVndPipe],
  template: `
    <div class="mx-auto max-w-4xl">
      <a routerLink="/admin/orders" class="text-sm text-blue-600 hover:underline">← Back to orders</a>

      @if (loading()) {
        <p class="mt-6 text-gray-600">Loading...</p>
      } @else if (error()) {
        <p class="mt-6 text-red-600">{{ error() }}</p>
      } @else if (order()) {
        <h1 class="mt-4 text-2xl font-bold text-gray-900">Order #{{ order()!.id }}</h1>
        <p class="mt-1 text-sm text-gray-600">
          Customer: {{ order()!.user.email }}
          @if (order()!.user.name) {
            <span> — {{ order()!.user.name }}</span>
          }
        </p>

        <div class="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-xs font-medium text-gray-600">Current status</p>
              <p class="mt-1 text-lg font-semibold text-gray-900">{{ statusLabel(order()!.status) }}</p>
            </div>
            @if (nextOptions().length > 0) {
              <div class="flex flex-wrap items-end gap-2">
                <div>
                  <label class="block text-xs font-medium text-gray-600">Change status</label>
                  <select
                    [(ngModel)]="selectedNext"
                    class="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    @for (s of nextOptions(); track s) {
                      <option [ngValue]="s">{{ statusLabel(s) }}</option>
                    }
                  </select>
                </div>
                <button
                  type="button"
                  (click)="applyStatus()"
                  [disabled]="saving()"
                  class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {{ saving() ? 'Saving...' : 'Update' }}
                </button>
              </div>
            }
          </div>
        </div>

        <div class="mt-6">
          <h2 class="text-sm font-semibold text-gray-900">Shipping</h2>
          <p class="mt-1 text-gray-700">{{ order()!.shippingAddress }}</p>
        </div>

        <div class="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 font-medium text-gray-700">Product</th>
                <th class="px-4 py-3 font-medium text-gray-700">Qty</th>
                <th class="px-4 py-3 font-medium text-gray-700">Unit price</th>
                <th class="px-4 py-3 font-medium text-gray-700">Line total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (line of order()!.items; track line.productId) {
                <tr>
                  <td class="px-4 py-3">{{ line.name }}</td>
                  <td class="px-4 py-3">{{ line.quantity }}</td>
                  <td class="px-4 py-3">{{ line.unitPrice | currencyVnd }}</td>
                  <td class="px-4 py-3">{{ line.quantity * line.unitPrice | currencyVnd }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <p class="mt-4 text-right text-lg font-semibold text-gray-900">
          Total: {{ order()!.total | currencyVnd }}
        </p>
        <p class="mt-2 text-xs text-gray-500">
          Created: {{ formatDate(order()!.createdAt) }} — Updated: {{ formatDate(order()!.updatedAt) }}
        </p>
      }
    </div>
  `,
})
export class AdminOrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OrderApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly order = signal<OrderDetail | null>(null);
  readonly nextOptions = signal<OrderStatus[]>([]);

  selectedNext: OrderStatus | null = null;

  ngOnInit(): void {
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

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  applyStatus(): void {
    const o = this.order();
    const next = this.selectedNext;
    if (!o || !next) return;
    this.saving.set(true);
    this.api.updateStatus(o.id, next).subscribe({
      next: (updated) => {
        this.order.set(updated);
        const opts = nextStatuses(updated.status);
        this.nextOptions.set(opts);
        this.selectedNext = opts[0] ?? null;
        this.saving.set(false);
        this.toast.show('Status updated.', 'success');
      },
      error: (e: Error) => {
        this.saving.set(false);
        this.toast.show(e.message || 'Update failed.', 'error');
      },
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAdmin(id).subscribe({
      next: (data) => {
        this.order.set(data);
        const opts = nextStatuses(data.status);
        this.nextOptions.set(opts);
        this.selectedNext = opts[0] ?? null;
        this.loading.set(false);
      },
      error: (e: Error) => {
        this.error.set(e.message || 'Failed to load order.');
        this.loading.set(false);
      },
    });
  }
}
