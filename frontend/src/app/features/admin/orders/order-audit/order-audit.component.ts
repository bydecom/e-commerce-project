import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { OrderApiService } from '../../../../core/services/order-api.service';
import type { OrderEvent } from '../../../../shared/models/order.model';

@Component({
  selector: 'app-admin-order-audit',
  standalone: true,
  template: `
    <div class="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div class="flex items-center gap-2 border-b border-gray-200 bg-gray-50/50 px-6 py-4">
        <svg class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="text-base font-bold text-gray-900">System Activity Log</h2>
      </div>

      <div class="p-6">
        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <svg class="h-6 w-6 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="ml-2 text-sm text-gray-500">Loading data...</span>
          </div>
        } @else if (error()) {
          <p class="text-center text-sm text-red-600 py-8">{{ error() }}</p>
        } @else if (events().length === 0) {
          <p class="text-center text-sm text-gray-400 py-8">No activity log found.</p>
        } @else {
          <ol class="relative border-l-2 border-gray-200 ml-4">
            @for (event of events(); track event.id) {
              <li class="mb-8 ml-6 last:mb-0">
                <span class="absolute flex items-center justify-center w-8 h-8 rounded-full -left-4 ring-4 ring-white"
                      [class]="eventIconBg(event)">
                  @switch (event.type) {
                    @case ('ORDER_STATUS_CHANGED') {
                      <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    }
                    @case ('PAYMENT_STATUS_CHANGED') {
                      <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                              d="M12 8c-3.314 0-6 1.567-6 3.5S8.686 15 12 15s6-1.567 6-3.5S15.314 8 12 8zm0 7v5" />
                      </svg>
                    }
                    @default {
                      <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  }
                </span>

                <div class="rounded-lg border border-gray-100 bg-gray-50/50 p-4 hover:bg-gray-50 transition-colors">
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 class="text-sm font-semibold text-gray-900">{{ eventTypeLabel(event.type) }}</h3>
                    <time class="text-xs text-gray-400 font-mono">{{ formatDate(event.createdAt) }}</time>
                  </div>

                  @if (event.oldValue || event.newValue) {
                    <div class="mt-2 flex items-center gap-2 text-sm">
                      @if (event.oldValue) {
                        <span class="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {{ event.oldValue }}
                        </span>
                      }
                      @if (event.oldValue && event.newValue) {
                        <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      }
                      @if (event.newValue) {
                        <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold"
                              [class]="statusBadgeClass(event.newValue)">
                          {{ event.newValue }}
                        </span>
                      }
                    </div>
                  }

                  @if (event.note) {
                    <p class="mt-2 text-sm text-gray-600 italic">{{ event.note }}</p>
                  }

                  @if (event.changedBy || event.changedByRole) {
                    <div class="mt-2 flex items-center gap-2 text-xs text-gray-400">
                      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      @if (event.changedBy) {
                        <span>{{ event.changedBy.name || event.changedBy.email }}</span>
                      }
                      @if (event.changedByRole) {
                        <span class="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {{ event.changedByRole }}
                        </span>
                      }
                    </div>
                  }
                </div>
              </li>
            }
          </ol>
        }
      </div>
    </div>
  `,
})
export class OrderAuditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OrderApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly events = signal<OrderEvent[]>([]);

  ngOnInit(): void {
    this.route.parent?.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = parseInt(params.get('id') ?? '', 10);
        if (Number.isNaN(id)) {
          this.error.set('Invalid order ID');
          this.loading.set(false);
          return;
        }
        this.api.getAdminOrderEvents(id).subscribe({
          next: (data) => {
            this.events.set(data);
            this.loading.set(false);
          },
          error: (e: Error) => {
            this.error.set(e.message || 'Failed to load activity log.');
            this.loading.set(false);
          },
        });
      });
  }

  eventTypeLabel(type: string): string {
    switch (type) {
      case 'ORDER_STATUS_CHANGED':
        return 'Order Status Changed';
      case 'PAYMENT_STATUS_CHANGED':
        return 'Payment Status Changed';
      case 'SYSTEM_LOG':
        return 'System Log';
      default:
        return type;
    }
  }

  eventIconBg(event: OrderEvent): string {
    switch (event.type) {
      case 'ORDER_STATUS_CHANGED':
        return event.newValue === 'CANCELLED' ? 'bg-red-500' : 'bg-blue-500';
      case 'PAYMENT_STATUS_CHANGED':
        return 'bg-emerald-500';
      default:
        return 'bg-gray-400';
    }
  }

  statusBadgeClass(value: string): string {
    switch (value) {
      case 'PENDING':
        return 'bg-orange-100 text-orange-700';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-700';
      case 'SHIPPING':
        return 'bg-indigo-100 text-indigo-700';
      case 'DONE':
        return 'bg-emerald-100 text-emerald-700';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      case 'PAID':
        return 'bg-emerald-100 text-emerald-700';
      case 'FAILED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  }
}
