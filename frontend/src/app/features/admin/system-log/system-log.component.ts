import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { catchError, map, of, interval, Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccess } from '../../../shared/models/api-response.model';

interface SystemLog {
  id: number;
  method: string;
  url: string;
  status: number;
  responseTime: number;
  createdAt: string;
}

@Component({
  selector: 'app-admin-system-log',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  template: `
    <div class="mx-auto max-w-6xl">
      <div class="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">System traffic logs</h1>

        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="toggleAutoRefresh()"
            [class]="autoRefresh()
              ? 'flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700'
              : 'flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300'"
          >
            <span
              [class]="autoRefresh() ? 'inline-block h-2 w-2 animate-pulse rounded-full bg-white' : 'inline-block h-2 w-2 rounded-full bg-gray-500'"
            ></span>
            {{ autoRefresh() ? 'Live (5s)' : 'Auto-refresh off' }}
          </button>
          <button
            type="button"
            (click)="load()"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div class="w-full sm:w-36">
          <label class="block text-xs font-medium text-gray-600">Method</label>
          <select
            [(ngModel)]="methodFilter"
            (ngModelChange)="load()"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            @for (m of methods; track m) {
              <option [value]="m">{{ m }}</option>
            }
          </select>
        </div>

        <div class="w-full sm:w-36">
          <label class="block text-xs font-medium text-gray-600">Status</label>
          <select
            [(ngModel)]="statusFilter"
            (ngModelChange)="load()"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="success">2xx / 3xx (OK)</option>
            <option value="client">4xx Client error</option>
            <option value="server">5xx Server error</option>
          </select>
        </div>

        <div class="w-full sm:flex-1">
          <label class="block text-xs font-medium text-gray-600">URL contains</label>
          <input
            type="text"
            [(ngModel)]="urlFilter"
            (keyup.enter)="load()"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="/api/products"
          />
        </div>

        <div class="w-full sm:w-28">
          <label class="block text-xs font-medium text-gray-600">Limit</label>
          <select
            [(ngModel)]="limitFilter"
            (ngModelChange)="load()"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option [ngValue]="50">50</option>
            <option [ngValue]="100">100</option>
            <option [ngValue]="200">200</option>
          </select>
        </div>
      </div>

      <!-- PDF export -->
      <div class="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div class="flex-1 space-y-3">
            <p class="text-sm font-semibold text-indigo-900">Export PDF report</p>
            <div class="flex flex-wrap gap-3">
              <div class="w-full min-w-[140px] sm:w-40">
                <label class="block text-xs font-medium text-gray-600">Time range</label>
                <select
                  [(ngModel)]="exportFilterType"
                  class="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="ALL">All time</option>
                  <option value="MONTH">By month</option>
                  <option value="QUARTER">By quarter</option>
                  <option value="YEAR">By year</option>
                  <option value="RANGE">Date range</option>
                </select>
              </div>
              @if (exportFilterType === 'MONTH') {
                <div class="w-24">
                  <label class="block text-xs font-medium text-gray-600">Month</label>
                  <select [(ngModel)]="exportMonth" class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm">
                    @for (m of monthOptions; track m) {
                      <option [ngValue]="m">{{ m }}</option>
                    }
                  </select>
                </div>
                <div class="w-28">
                  <label class="block text-xs font-medium text-gray-600">Year</label>
                  <input
                    type="number"
                    [(ngModel)]="exportYear"
                    min="2000"
                    max="2100"
                    class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm"
                  />
                </div>
              }
              @if (exportFilterType === 'QUARTER') {
                <div class="w-24">
                  <label class="block text-xs font-medium text-gray-600">Quarter</label>
                  <select [(ngModel)]="exportQuarter" class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm">
                    @for (q of quarterOptions; track q) {
                      <option [ngValue]="q">Q{{ q }}</option>
                    }
                  </select>
                </div>
                <div class="w-28">
                  <label class="block text-xs font-medium text-gray-600">Year</label>
                  <input
                    type="number"
                    [(ngModel)]="exportYear"
                    min="2000"
                    max="2100"
                    class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm"
                  />
                </div>
              }
              @if (exportFilterType === 'YEAR') {
                <div class="w-32">
                  <label class="block text-xs font-medium text-gray-600">Year</label>
                  <input
                    type="number"
                    [(ngModel)]="exportYear"
                    min="2000"
                    max="2100"
                    class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm"
                  />
                </div>
              }
              @if (exportFilterType === 'RANGE') {
                <div class="w-40">
                  <label class="block text-xs font-medium text-gray-600">From</label>
                  <input type="date" [(ngModel)]="exportStartDate" class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm" />
                </div>
                <div class="w-40">
                  <label class="block text-xs font-medium text-gray-600">To</label>
                  <input type="date" [(ngModel)]="exportEndDate" class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-2 text-sm" />
                </div>
              }
            </div>
            <p class="text-xs text-gray-500">
              Table filters (Method / Status / URL) above also apply to the exported PDF.
            </p>
          </div>
          <button
            type="button"
            (click)="exportPdf()"
            [disabled]="exporting()"
            class="shrink-0 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ exporting() ? 'Building PDF…' : 'Download PDF' }}
          </button>
        </div>
      </div>

      <!-- Stats nhanh -->
      @if (logs().length > 0) {
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p class="text-xs text-gray-500">Total requests</p>
            <p class="mt-1 text-2xl font-bold text-gray-900">{{ logs().length }}</p>
          </div>
          <div class="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p class="text-xs text-green-700">2xx / 3xx (OK)</p>
            <p class="mt-1 text-2xl font-bold text-green-700">{{ countByStatusRange(200, 399) }}</p>
          </div>
          <div class="rounded-xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
            <p class="text-xs text-yellow-700">4xx Client Error</p>
            <p class="mt-1 text-2xl font-bold text-yellow-700">{{ countByStatusRange(400, 499) }}</p>
          </div>
          <div class="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p class="text-xs text-red-700">5xx Server Error</p>
            <p class="mt-1 text-2xl font-bold text-red-700">{{ countByStatusRange(500, 599) }}</p>
          </div>
        </div>
      }

      @if (loading()) {
        <p class="mt-8 text-gray-500">Loading…</p>
      } @else if (error()) {
        <p class="mt-8 text-red-600">{{ error() }}</p>
      } @else {
        <div class="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 font-medium text-gray-700">ID</th>
                <th class="px-4 py-3 font-medium text-gray-700">Method</th>
                <th class="px-4 py-3 font-medium text-gray-700">URL</th>
                <th class="px-4 py-3 font-medium text-gray-700">Status</th>
                <th class="px-4 py-3 font-medium text-gray-700">Response Time</th>
                <th class="px-4 py-3 font-medium text-gray-700">Time</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (log of logs(); track log.id) {
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-2.5 text-xs text-gray-400">#{{ log.id }}</td>
                  <td class="px-4 py-2.5">
                    <span [class]="methodClass(log.method)">{{ log.method }}</span>
                  </td>
                  <td class="max-w-xs truncate px-4 py-2.5 font-mono text-xs text-gray-700">
                    {{ log.url }}
                  </td>
                  <td class="px-4 py-2.5">
                    <span [class]="statusClass(log.status)">{{ log.status }}</span>
                  </td>
                  <td class="px-4 py-2.5 text-gray-600">
                    <span [class]="responseTimeClass(log.responseTime)">
                      {{ log.responseTime | number : '1.2-2' }} ms
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-xs text-gray-500">
                    {{ log.createdAt | date : 'HH:mm:ss dd/MM' }}
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                    No log entries yet.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AdminSystemLogComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly logs = signal<SystemLog[]>([]);
  readonly autoRefresh = signal(false);
  readonly exporting = signal(false);

  readonly methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  readonly monthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  readonly quarterOptions = [1, 2, 3, 4];

  methodFilter = '';
  /** success | client | server | '' */
  statusFilter = '';
  urlFilter = '';
  limitFilter = 50;

  exportFilterType: 'ALL' | 'MONTH' | 'QUARTER' | 'YEAR' | 'RANGE' = 'ALL';
  exportMonth = new Date().getMonth() + 1;
  exportQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  exportYear = new Date().getFullYear();
  exportStartDate = '';
  exportEndDate = '';

  private refreshSub: Subscription | null = null;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    let params = `limit=${this.limitFilter}`;
    if (this.methodFilter) params += `&method=${this.methodFilter}`;
    if (this.urlFilter.trim()) params += `&url=${encodeURIComponent(this.urlFilter.trim())}`;
    if (this.statusFilter) {
      params += `&statusGroup=${encodeURIComponent(this.statusFilter)}`;
    }

    this.http
      .get<ApiSuccess<SystemLog[]>>(`${environment.apiUrl}/api/system-logs?${params}`)
      .pipe(
        map((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
        catchError(() => of([] as SystemLog[]))
      )
      .subscribe({
        next: (data) => {
          this.logs.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load system logs.');
          this.loading.set(false);
        },
      });
  }

  toggleAutoRefresh(): void {
    if (this.autoRefresh()) {
      this.stopAutoRefresh();
    } else {
      this.autoRefresh.set(true);
      this.refreshSub = interval(5000).subscribe(() => this.load());
    }
  }

  exportPdf(): void {
    if (this.exportFilterType === 'RANGE' && (!this.exportStartDate || !this.exportEndDate)) {
      alert('Please select both start and end dates.');
      return;
    }

    let params = new HttpParams().set('filterType', this.exportFilterType);
    if (this.exportFilterType === 'MONTH') {
      params = params.set('month', String(this.exportMonth)).set('year', String(this.exportYear));
    } else if (this.exportFilterType === 'QUARTER') {
      params = params.set('quarter', String(this.exportQuarter)).set('year', String(this.exportYear));
    } else if (this.exportFilterType === 'YEAR') {
      params = params.set('year', String(this.exportYear));
    } else if (this.exportFilterType === 'RANGE') {
      params = params.set('startDate', this.exportStartDate).set('endDate', this.exportEndDate);
    }

    if (this.methodFilter) params = params.set('method', this.methodFilter);
    if (this.statusFilter) params = params.set('statusGroup', this.statusFilter);
    if (this.urlFilter.trim()) params = params.set('url', this.urlFilter.trim());

    this.exporting.set(true);
    this.http
      .get(`${environment.apiUrl}/api/system-logs/export-pdf`, {
        params,
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `system-logs-${new Date().toISOString().slice(0, 10)}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.exporting.set(false);
        },
        error: async (err: HttpErrorResponse) => {
          this.exporting.set(false);
          let msg = err.message;
          if (err.error instanceof Blob) {
            try {
              const t = await err.error.text();
              const j = JSON.parse(t) as { message?: string };
              if (j.message) msg = j.message;
            } catch {
              msg = 'Could not generate PDF.';
            }
          }
          alert(msg);
        },
      });
  }

  countByStatusRange(min: number, max: number): number {
    return this.logs().filter((l) => l.status >= min && l.status <= max).length;
  }

  methodClass(method: string): string {
    const map: Record<string, string> = {
      GET: 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700',
      POST: 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700',
      PUT: 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-700',
      PATCH: 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700',
      DELETE: 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700',
    };
    return map[method] ?? 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700';
  }

  statusClass(status: number): string {
    if (status >= 100 && status < 400) {
      return 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700';
    }
    if (status >= 400 && status < 500) {
      return 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-700';
    }
    if (status >= 500) {
      return 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700';
    }
    return 'inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700';
  }

  responseTimeClass(ms: number): string {
    if (ms < 100) return 'text-green-600 font-medium';
    if (ms < 500) return 'text-yellow-600 font-medium';
    return 'text-red-600 font-bold';
  }

  private stopAutoRefresh(): void {
    this.autoRefresh.set(false);
    this.refreshSub?.unsubscribe();
    this.refreshSub = null;
  }
}
