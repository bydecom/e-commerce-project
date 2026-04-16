import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, map, throwError, type Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccess, PaginationMeta } from '../../../shared/models/api-response.model';
import type { Feedback, FeedbackType, SentimentLabel } from '../../../shared/models/feedback.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SentimentBadgeComponent } from '../../../shared/components/sentiment-badge/sentiment-badge.component';

interface CacheEntry {
  data: AdminFeedbackItem[];
  meta: { page: number; limit: number; total: number; totalPages: number } | null;
  ts: number;
}

@Component({
  selector: 'app-admin-feedback-list',
  standalone: true,
  imports: [FormsModule, PaginationComponent, SentimentBadgeComponent],
  template: `
    <div class="mx-auto max-w-6xl">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Feedbacks</h1>
        </div>
      </div>

      <div class="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div class="w-full sm:flex-1">
          <label class="block text-xs font-medium text-gray-600">Search</label>
          <input
            type="text"
            [(ngModel)]="searchInput"
            (ngModelChange)="onSearchChange($event)"
            (keyup.enter)="applyFilters()"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Search by customer/product/comment..."
          />
        </div>

        <div class="w-full sm:w-44">
          <label class="block text-xs font-medium text-gray-600">Sentiment</label>
          <select
            [(ngModel)]="sentimentFilter"
            (ngModelChange)="applyFilters()"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option [ngValue]="''">All</option>
            <option value="POSITIVE">Positive</option>
            <option value="NEUTRAL">Neutral</option>
            <option value="NEGATIVE">Negative</option>
          </select>
        </div>

        <div class="w-full sm:w-44">
          <label class="block text-xs font-medium text-gray-600">Type</label>
          <select
            [(ngModel)]="typeFilter"
            (ngModelChange)="applyFilters()"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option [ngValue]="''">All</option>
            @for (t of feedbackTypes(); track t.id) {
              <option [ngValue]="t.id">{{ t.name }}</option>
            }
          </select>
        </div>

        <div class="w-full sm:w-36">
          <label class="block text-xs font-medium text-gray-600">Rating</label>
          <select
            [(ngModel)]="ratingFilter"
            (ngModelChange)="applyFilters()"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option [ngValue]="''">All</option>
            @for (r of [5, 4, 3, 2, 1]; track r) {
              <option [ngValue]="r">{{ r }}★</option>
            }
          </select>
        </div>

        <button
          type="button"
          (click)="applyFilters()"
          class="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-600"
        >
          Apply
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
                <th class="px-4 py-3 font-medium text-gray-700">Order</th>
                <th class="px-4 py-3 font-medium text-gray-700">Customer</th>
                <th class="px-4 py-3 font-medium text-gray-700">Product</th>
                <th class="px-4 py-3 font-medium text-gray-700">Type</th>
                <th class="px-4 py-3 font-medium text-gray-700">Rating</th>
                <th class="px-4 py-3 font-medium text-gray-700">Sentiment</th>
                <th class="px-4 py-3 font-medium text-gray-700">Comment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (f of feedbacks(); track f.id) {
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">#{{ f.id }}</td>
                  <td class="px-4 py-3 text-gray-600">#{{ f.orderId }}</td>
                  <td class="px-4 py-3 text-gray-600">
                    @if (f.user?.email) {
                      {{ f.user!.email }}
                      @if (f.user?.name) {
                        <span class="text-gray-400"> — {{ f.user!.name }}</span>
                      }
                    } @else {
                      <span class="text-gray-400">—</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-gray-600">
                    @if (f.product?.name) {
                      {{ f.product!.name }}
                    } @else {
                      #{{ f.productId }}
                    }
                  </td>
                  <td class="px-4 py-3 text-gray-600">
                    @if (f.type?.name) {
                      {{ f.type!.name }}
                    } @else {
                      <span class="text-gray-400">—</span>
                    }
                  </td>
                  <td class="px-4 py-3">{{ f.rating }}★</td>
                  <td class="px-4 py-3">
                    <app-sentiment-badge [sentiment]="f.sentiment" />
                  </td>
                  <td class="px-4 py-3 text-gray-700">
                    @if (f.comment) {
                      <span class="line-clamp-2">{{ f.comment }}</span>
                    } @else {
                      <span class="text-gray-400">—</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="px-4 py-8 text-center text-gray-500">No feedbacks yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (meta()) {
          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-gray-500">
              Showing <span class="font-medium text-gray-800">{{ rangeStart() }}</span>–<span class="font-medium text-gray-800">{{ rangeEnd() }}</span>
              of <span class="font-medium text-gray-800">{{ meta()!.total }}</span> feedbacks
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
export class AdminFeedbackListComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedbacks = signal<AdminFeedbackItem[]>([]);
  readonly meta = signal<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  readonly feedbackTypes = signal<FeedbackType[]>([]);

  searchInput = '';
  sentimentFilter: '' | SentimentLabel = '';
  ratingFilter: '' | number = '';
  typeFilter: '' | number = '';

  private appliedSearch = '';
  private appliedSentiment: SentimentLabel | undefined;
  private appliedRating: number | undefined;
  private appliedType: number | undefined;

  page = 1;
  readonly limit = 5;

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

  // ── Subscription (Angular-way cancel) ────────────────────────────
  private pendingSub: Subscription | null = null;

  ngOnInit(): void {
    this.loadFeedbackTypes();
    this.load();
  }

  ngOnDestroy(): void {
    this.clearDebounce();
    this.clearThrottle();
    this.cancelPending();
  }

  onSearchChange(v: string): void {
    this.searchInput = v;
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => this.applyFilters(), this.DEBOUNCE_MS);
  }

  applyFilters(): void {
    this.appliedSearch = this.searchInput.trim();
    this.appliedSentiment = this.sentimentFilter || undefined;
    this.appliedRating = this.ratingFilter === '' ? undefined : Number(this.ratingFilter);
    this.appliedType = this.typeFilter === '' ? undefined : Number(this.typeFilter);
    this.page = 1;
    this.throttledLoad();
  }

  onPage(p: number): void {
    this.page = p;
    this.throttledLoad();
  }

  rangeStart(): number {
    const m = this.meta();
    if (!m) return 0;
    const len = this.feedbacks().length;
    if (len === 0) return 0;
    return (m.page - 1) * m.limit + 1;
  }

  rangeEnd(): number {
    const m = this.meta();
    if (!m) return 0;
    return (m.page - 1) * m.limit + this.feedbacks().length;
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
      this.feedbacks.set(hit.data);
      this.meta.set(hit.meta);
      return;
    }

    this.cancelPending();
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', String(this.page))
      .set('limit', String(this.limit));
    if (this.appliedSearch) params = params.set('search', this.appliedSearch);
    if (this.appliedSentiment) params = params.set('sentiment', this.appliedSentiment);
    if (this.appliedRating) params = params.set('rating', String(this.appliedRating));
    if (this.appliedType) params = params.set('typeId', String(this.appliedType));

    const url = `${environment.apiUrl}/api/feedbacks`;

    this.pendingSub = this.http
      .get<ApiSuccess<AdminFeedbackItem[]>>(url, { params })
      .pipe(
        map((r) => {
          if (!r.success) throw new Error(r.message);
          const meta: PaginationMeta | null | undefined = r.meta;
          return {
            data: Array.isArray(r.data) ? r.data : [],
            meta: meta
              ? {
                  page: meta.page,
                  limit: meta.limit,
                  total: meta.total,
                  totalPages: meta.totalPages,
                }
              : null,
          };
        }),
        catchError((err: HttpErrorResponse) => {
          const body = err.error as { message?: string } | undefined;
          const msg = typeof body?.message === 'string' ? body.message : err.message;
          return throwError(() => new Error(msg));
        })
      )
      .subscribe({
        next: ({ data, meta }) => {
          this.cache.set(cacheKey, { data, meta, ts: Date.now() });
          this.feedbacks.set(data);
          this.meta.set(meta);
          this.loading.set(false);
          this.pendingSub = null;
        },
        error: (e: Error) => {
          this.error.set(e.message || 'Failed to load the list.');
          this.loading.set(false);
          this.pendingSub = null;
        },
      });
  }

  private loadFeedbackTypes(): void {
    this.http
      .get<ApiSuccess<FeedbackType[]>>(`${environment.apiUrl}/api/feedback-types`)
      .pipe(
        map((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
        catchError(() => [])
      )
      .subscribe((types) => this.feedbackTypes.set(types));
  }

  private buildCacheKey(): string {
    return `${this.page}|${this.limit}|${this.appliedSearch}|${this.appliedSentiment ?? ''}|${this.appliedRating ?? ''}|${this.appliedType ?? ''}`;
  }

  private cancelPending(): void {
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

type AdminFeedbackItem = Feedback & {
  user?: { id: number; email: string; name?: string | null };
  product?: { id: number; name: string };
  type?: FeedbackType;
};
