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
  meta: { page: number; limit: number; total: number; totalPages: number };
  ts: number;
}

@Component({
  selector: 'app-admin-order-list',
  standalone: true,
  imports: [NgClass, RouterLink, FormsModule, CurrencyVndPipe, PaginationComponent],
  template: `
    <div class="mx-auto w-full max-w-6xl">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">Orders</h1>
      </div>

      <div class="mt-3 flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-end">
        <div class="w-full sm:flex-1">
          <label class="block text-[11px] font-medium text-gray-500 uppercase tracking-wider">Search</label>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Customer name or email..."
            class="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-900 focus:ring-gray-900"
            (keyup.enter)="applyFilters()"
          />
        </div>
        <div class="w-full sm:w-40">
          <label class="block text-[11px] font-medium text-gray-500 uppercase tracking-wider">Status</label>
          <select
            [(ngModel)]="statusFilter"
            class="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-900 focus:ring-gray-900"
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
          class="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-gray-800"
        >
          Filter
        </button>
      </div>

      @if (loading()) {
        <p class="mt-4 text-sm text-gray-500">Loading orders...</p>
      } @else if (error()) {
        <p class="mt-4 text-sm text-red-600">{{ error() }}</p>
      } @else {
        <div class="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table class="min-w-full table-fixed divide-y divide-gray-200 text-left text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="w-[10%] px-3 py-2.5 font-medium text-gray-700">ID</th>
                <th class="w-[30%] px-3 py-2.5 font-medium text-gray-700">Customer</th>
                <th class="w-[12%] px-3 py-2.5 font-medium text-gray-700">Total</th>
                <th class="w-[12%] px-3 py-2.5 font-medium text-gray-700">Status</th>
                <th class="w-[12%] px-3 py-2.5 font-medium text-gray-700">Payment</th>
                <th class="w-[18%] px-3 py-2.5 font-medium text-gray-700">Created</th>
                <th class="w-[6%] px-3 py-2.5 font-medium text-gray-700"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (o of orders(); track o.id) {
                <tr class="hover:bg-gray-50">
                  <td class="px-3 py-2 font-medium text-gray-900">#{{ o.id }}</td>
                  <td class="px-3 py-2 text-gray-600">
                    <div class="truncate" [title]="o.user.email">
                      {{ o.user.email }}
                      @if (o.user.name) {
                        <span class="text-gray-400 text-xs block truncate">{{ o.user.name }}</span>
                      }
                    </div>
                  </td>
                  <td class="px-3 py-2 font-medium">{{ o.total | currencyVnd }}</td>
                  <td class="px-3 py-2">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                      [ngClass]="statusClass(o.status)"
                    >
                      {{ statusLabel(o.status) }}
                    </span>
                  </td>
                  <td class="px-3 py-2">
                    <span
                      class="inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      [ngClass]="paymentStatusClass(o.paymentStatus)"
                    >
                      {{ o.paymentStatus || 'PENDING' }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-gray-500 text-xs">{{ formatDate(o.createdAt) }}</td>
                  <td class="px-3 py-2 text-right whitespace-nowrap">
                    <a [routerLink]="['/admin/orders', o.id]" class="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium">
                      Details
                    </a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-8 text-center text-sm text-gray-500">No orders found.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (meta()) {
          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-gray-500">
              Showing <span class="font-medium text-gray-800">{{ rangeStart() }}</span>–<span class="font-medium text-gray-800">{{ rangeEnd() }}</span>
              of <span class="font-medium text-gray-800">{{ meta()!.total }}</span> orders
            </p>
            <div class="flex justify-center sm:justify-end">
              <app-pagination
                class="block"
                [page]="meta()!.page"
                [totalPages]="meta()!.totalPages"
                (pageChange)="onPage($event)"
              />
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class AdminOrderListComponent implements OnInit, OnDestroy   {
  private readonly api = inject(OrderApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly orders = signal<OrderDetail[]>([]);
  readonly meta = signal<{ page: number; limit: number; total: number; totalPages: number } | null>(null);

  statusFilter: '' | OrderStatus = '';
  searchQuery = '';

  private appliedStatus: OrderStatus | undefined;
  private appliedSearch: string | undefined;

  page = 1;
  // CHỈNH SỬA: Giới hạn 7 đơn hàng để khớp 1 màn hình
  readonly limit = 7;

  // ── In-memory cache ──────────────────────────────────────────────
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 30_000;

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

  rangeStart(): number {
    const m = this.meta();
    if (!m) return 0;
    const len = this.orders().length;
    if (len === 0) return 0;
    return (m.page - 1) * m.limit + 1;
  }

  rangeEnd(): number {
    const m = this.meta();
    if (!m) return 0;
    return (m.page - 1) * m.limit + this.orders().length;
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
      PENDING: 'bg-amber-100 text-amber-800 border border-amber-200',
      CONFIRMED: 'bg-blue-100 text-blue-800 border border-blue-200',
      SHIPPING: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
      DONE: 'bg-green-100 text-green-800 border border-green-200',
      CANCELLED: 'bg-gray-100 text-gray-600 border border-gray-200',
    };
    return map[s] ?? 'bg-gray-100 text-gray-600';
  }

  paymentStatusClass(status: string): string {
    switch (status) {
      case 'PAID':
        return 'bg-green-50 text-green-700 border border-green-200';
      case 'FAILED':
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'PENDING':
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  private throttledLoad(): void {
    const now = Date.now();
    const remaining = this.THROTTLE_MS - (now - this.lastCallTs);

    if (remaining <= 0) {
      this.lastCallTs = now;
      this.load();
    } else {
      this.clearThrottle();
      this.throttleTimer = setTimeout(() => {
        this.lastCallTs = Date.now();
        this.load();
      }, remaining);
    }
  }

  private load(): void {
    const cacheKey = this.buildCacheKey();

    const hit = this.cache.get(cacheKey);
    if (hit && Date.now() - hit.ts < this.CACHE_TTL_MS) {
      this.orders.set(hit.data);
      this.meta.set(hit.meta);
      return;
    }

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
          const meta = {
            page: res.meta.page,
            limit: res.meta.limit,
            total: res.meta.total,
            totalPages: res.meta.totalPages,
          };
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