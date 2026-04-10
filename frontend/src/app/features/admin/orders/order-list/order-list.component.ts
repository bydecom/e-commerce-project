import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { Subscription } from 'rxjs';
import { CurrencyVndPipe } from '../../../../shared/pipes/currency-vnd.pipe';
import { OrderApiService } from '../../../../core/services/order-api.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { OrderDetail, OrderStatus } from '../../../../shared/models/order.model';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';

interface CacheEntry {
  data: OrderDetail[];
  meta: { page: number; totalPages: number };
  ts: number;
}

@Component({
  selector: 'app-admin-order-list',
  standalone: true,
  imports: [NgClass, RouterLink, FormsModule, CurrencyVndPipe, PaginationComponent],
  template: `
    <div class="mx-auto max-w-6xl">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Orders</h1>
          <p class="mt-1 text-sm text-gray-600">
            List of all orders (admin API may not require JWT in dev).
          </p>
        </div>
      </div>

      <div class="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div class="w-full sm:flex-1">
          <label class="block text-xs font-medium text-gray-600">Search</label>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Search by customer name or email..."
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            (keyup.enter)="applyFilters()"
          />
        </div>
        <div class="w-full sm:w-48">
          <label class="block text-xs font-medium text-gray-600">Status</label>
          <select
            [(ngModel)]="statusFilter"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option [ngValue]="''">All</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="SHIPPING">Shipping</option>
            <option value="DONE">Done</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button
          type="button"
          (click)="applyFilters()"
          class="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          Filter
        </button>
      </div>

      @if (loading()) {
        <p class="mt-8 text-gray-600">Loading...</p>
      } @else if (error()) {
        <p class="mt-8 text-red-600">{{ error() }}</p>
      } @else {
        <div class="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 font-medium text-gray-700">ID</th>
                <th class="px-4 py-3 font-medium text-gray-700">Customer</th>
                <th class="px-4 py-3 font-medium text-gray-700">Total</th>
                <th class="px-4 py-3 font-medium text-gray-700">Status</th>
                <th class="px-4 py-3 font-medium text-gray-700">Created</th>
                <th class="px-4 py-3 font-medium text-gray-700"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (o of orders(); track o.id) {
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">#{{ o.id }}</td>
                  <td class="px-4 py-3 text-gray-600">
                    {{ o.user.email }}
                    @if (o.user.name) {
                      <span class="text-gray-400"> — {{ o.user.name }}</span>
                    }
                  </td>
                  <td class="px-4 py-3">{{ o.total | currencyVnd }}</td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                      [ngClass]="statusClass(o.status)"
                    >
                      {{ statusLabel(o.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-gray-600">{{ formatDate(o.createdAt) }}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    <a [routerLink]="['/admin/orders', o.id]" class="text-blue-600 hover:underline">
                      Details
                    </a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-4 py-8 text-center text-gray-500">No orders yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (meta()) {
          <app-pagination
            class="mt-6 block"
            [page]="meta()!.page"
            [totalPages]="meta()!.totalPages"
            (pageChange)="onPage($event)"
          />
        }
      }
    </div>
  `,
})
export class AdminOrderListComponent implements OnInit, OnDestroy {
  private readonly api = inject(OrderApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly orders = signal<OrderDetail[]>([]);
  readonly meta = signal<{ page: number; totalPages: number } | null>(null);

  statusFilter: '' | OrderStatus = '';
  searchQuery = '';

  private appliedStatus: OrderStatus | undefined;
  private appliedSearch: string | undefined;

  page = 1;
  readonly limit = 20;

  // ── In-memory cache ──────────────────────────────────────────────
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 30_000; // 30 giây

  // ── Debounce ─────────────────────────────────────────────────────
  private readonly DEBOUNCE_MS = 300;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Throttle ─────────────────────────────────────────────────────
  private readonly THROTTLE_MS = 500;
  private lastCallTs = 0;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Pending request ──────────────────────────────────────────────
  private pendingSub: Subscription | null = null;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.clearDebounce();
    this.clearThrottle();
    this.abortCurrent();
  }

  // ── Public helpers ────────────────────────────────────────────────

  applyFilters(): void {
    this.appliedStatus = this.statusFilter || undefined;
    this.appliedSearch = this.searchQuery.trim() || undefined;
    this.page = 1;
    this.throttledLoad();
  }

  onSearchChange(v: string): void {
    this.searchQuery = v;
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => this.applyFilters(), this.DEBOUNCE_MS);
  }

  onPage(p: number): void {
    this.page = p;
    this.throttledLoad();
  }

  statusLabel(s: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      PENDING: 'Pending',
      CONFIRMED: 'Confirmed',
      SHIPPING: 'Shipping',
      DONE: 'Done',
      CANCELLED: 'Cancelled',
    };
    return map[s] ?? s;
  }

  statusClass(s: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      PENDING: 'bg-amber-100 text-amber-900',
      CONFIRMED: 'bg-blue-100 text-blue-900',
      SHIPPING: 'bg-indigo-100 text-indigo-900',
      DONE: 'bg-green-100 text-green-900',
      CANCELLED: 'bg-gray-200 text-gray-800',
    };
    return map[s] ?? 'bg-gray-100 text-gray-800';
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  // ── Throttle wrapper ──────────────────────────────────────────────

  private throttledLoad(): void {
    const now = Date.now();
    const remaining = this.THROTTLE_MS - (now - this.lastCallTs);

    if (remaining <= 0) {
      // Đủ thời gian → gọi ngay
      this.lastCallTs = now;
      this.load();
    } else {
      // Còn trong cooldown → lên lịch gọi sau
      this.clearThrottle();
      this.throttleTimer = setTimeout(() => {
        this.lastCallTs = Date.now();
        this.load();
      }, remaining);
    }
  }

  // ── Core load ─────────────────────────────────────────────────────

  private load(): void {
    const cacheKey = this.buildCacheKey();

    // 1. Kiểm tra cache còn hạn không
    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.ts < this.CACHE_TTL_MS) {
      this.orders.set(hit.data);
      this.meta.set(hit.meta);
      return;
    }

    // 2. Huỷ request đang bay
    this.abortCurrent();

    this.loading.set(true);
    this.error.set(null);

    this.pendingSub = this.api
      .listAdmin({
        page: this.page,
        limit: this.limit,
        status: this.appliedStatus,
        search: this.appliedSearch,
      })
      .subscribe({
        next: (res) => {
          const meta = { page: res.meta.page, totalPages: res.meta.totalPages };

          // 3. Lưu cache
          this.cache.set(cacheKey, { data: res.data, meta, ts: Date.now() });

          this.orders.set(res.data);
          this.meta.set(meta);
          this.loading.set(false);
          this.pendingSub = null;
        },
        error: (e: Error) => {
          this.error.set(e.message || 'Failed to load the list.');
          this.loading.set(false);
          this.toast.show(this.error() ?? 'Error', 'error');
          this.pendingSub = null;
        },
      });
  }

  // ── Cleanup helpers ───────────────────────────────────────────────

  private buildCacheKey(): string {
    return `${this.page}|${this.limit}|${this.appliedStatus ?? ''}|${this.appliedSearch ?? ''}`;
  }

  private abortCurrent(): void {
    this.pendingSub?.unsubscribe();
    this.pendingSub = null;
  }

  private clearDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private clearThrottle(): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }
}
