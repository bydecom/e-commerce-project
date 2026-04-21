import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, map, throwError, type Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccess, PaginationMeta } from '../../../shared/models/api-response.model';
import type { Feedback, FeedbackType, SentimentLabel } from '../../../shared/models/feedback.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { SentimentBadgeComponent } from '../../../shared/components/sentiment-badge/sentiment-badge.component';

type ActionPlanStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';

type ActionPlanItem = {
  id: number;
  feedbackId: number;
  title: string;
  description: string | null;
  status: ActionPlanStatus;
  resolution: string | null;
  assigneeId: number | null;
  assignee: { id: number; name: string | null } | null;
};

type AdminFeedbackItem = Feedback & {
  user?: { id: number; email: string; name?: string | null };
  product?: { id: number; name: string };
  type?: FeedbackType;
  actionPlans: ActionPlanItem[];
};

interface CacheEntry {
  data: AdminFeedbackItem[];
  meta: { page: number; limit: number; total: number; totalPages: number } | null;
  ts: number;
}

const STATUS_LABEL: Record<ActionPlanStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  REJECTED: 'Rejected',
};

const STATUS_BAR: Record<ActionPlanStatus, string> = {
  PENDING: 'bg-yellow-400',
  IN_PROGRESS: 'bg-blue-400',
  DONE: 'bg-green-400',
  REJECTED: 'bg-red-400',
};

const STATUS_SELECT: Record<ActionPlanStatus, string> = {
  PENDING:     'bg-amber-50  text-amber-700  border-amber-300',
  IN_PROGRESS: 'bg-blue-50   text-blue-700   border-blue-300',
  DONE:        'bg-green-50  text-green-700  border-green-300',
  REJECTED:    'bg-slate-100 text-slate-600  border-slate-300',
};

@Component({
  selector: 'app-admin-feedback-list',
  standalone: true,
  imports: [FormsModule, PaginationComponent, SentimentBadgeComponent],
  template: `
    <div class="mx-auto max-w-full">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Feedbacks</h1>
        </div>
      </div>

      <!-- Filters -->
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
                <th class="w-10 px-3 py-3"></th>
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
                <!-- Main row -->
                <tr
                  class="cursor-pointer align-middle"
                  [class.hover:bg-gray-50]="!isExpanded(f.id)"
                  [class.bg-indigo-50]="isExpanded(f.id)"
                  [class.hover:bg-indigo-100]="isExpanded(f.id)"
                  (click)="toggleRow(f.id)"
                >
                  <td class="w-10 pl-2.5 py-3">
                    <div class="relative inline-flex">
                      <svg
                        class="h-4 w-4 text-gray-400 transition-transform duration-200"
                        [class.rotate-180]="isExpanded(f.id)"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                      @if (planDotClass(f.actionPlans); as dotCls) {
                        <span class="absolute -right-1 -top-1 h-2 w-2 rounded-full border-2 border-white" [class]="dotCls"></span>
                      }
                    </div>
                  </td>
                  <td class="px-4 py-3 font-medium text-gray-900">#{{ f.id }}</td>
                  <td class="px-4 py-3 text-gray-500">#{{ f.orderId }}</td>
                  <td class="px-4 py-3">
                    @if (f.user?.email) {
                      <div class="text-sm text-gray-700">{{ f.user!.email }}</div>
                      @if (f.user?.name) {
                        <div class="text-xs text-gray-400">{{ f.user!.name }}</div>
                      }
                    } @else {
                      <span class="text-gray-400">—</span>
                    }
                  </td>
                  <td class="max-w-[160px] truncate px-4 py-3 text-gray-600">
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
                  <td class="px-4 py-3 text-center">{{ f.rating }}★</td>
                  <td class="px-4 py-3">
                    <app-sentiment-badge [sentiment]="f.sentiment" />
                  </td>
                  <td class="max-w-[200px] px-4 py-3 text-sm text-gray-600">
                    @if (f.comment) {
                      <span class="line-clamp-2">{{ f.comment }}</span>
                    } @else {
                      <span class="text-gray-400">—</span>
                    }
                  </td>
                </tr>

                <!-- Expanded sub-row -->
                @if (isExpanded(f.id)) {
                  <tr class="bg-indigo-50">
                    <td colspan="9" class="px-0 py-0">
                      <div class="border-t border-indigo-100 pl-[54px] pr-6 py-4">
                        <div class="mb-3 flex items-center justify-between">
                          <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Action Plans
                            <span class="ml-1 font-normal text-gray-400">({{ f.actionPlans.length }})</span>
                          </span>
                          <button
                            type="button"
                            (click)="openModal(f.id)"
                            class="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                          >
                            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                            </svg>
                            Add Plan
                          </button>
                        </div>

                        @if (f.actionPlans.length === 0) {
                          <p class="text-xs text-gray-400">No action plans yet.</p>
                        } @else {
                          <div class="flex flex-col gap-2">
                            @for (plan of f.actionPlans; track plan.id) {
                              <div class="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                <!-- Status indicator bar -->
                                <div class="mt-0.5 h-full w-1 shrink-0 self-stretch rounded-full {{ statusBar(plan.status) }}"></div>

                                <!-- Content -->
                                <div class="min-w-0 flex-1">
                                  <p class="text-xs font-semibold text-gray-800">{{ plan.title }}</p>
                                  @if (plan.description) {
                                    <p class="mt-0.5 text-xs text-gray-500">{{ plan.description }}</p>
                                  }
                                  @if (plan.assignee?.name) {
                                    <p class="mt-1 text-xs text-gray-400">Assignee: {{ plan.assignee!.name }}</p>
                                  }
                                  @if (plan.status === 'DONE' || plan.status === 'REJECTED') {
                                    <div class="mt-2">
                                      <input
                                        type="text"
                                        [ngModel]="plan.resolution ?? ''"
                                        (blur)="updatePlanResolution(f.id, plan.id, $any($event.target).value)"
                                        (keyup.enter)="updatePlanResolution(f.id, plan.id, $any($event.target).value)"
                                        [placeholder]="plan.status === 'DONE' ? 'Outcome / result...' : 'Reason for rejection...'"
                                        class="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                      />
                                    </div>
                                  }
                                  @if (plan.resolution && plan.status !== 'DONE' && plan.status !== 'REJECTED') {
                                    <p class="mt-1 text-xs italic text-gray-400">"{{ plan.resolution }}"</p>
                                  }
                                </div>

                                <!-- Controls -->
                                <div class="flex shrink-0 items-center gap-2">
                                  <select
                                    [ngModel]="plan.status"
                                    (ngModelChange)="updatePlanStatus(f.id, plan.id, $event)"
                                    class="rounded border px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-300 {{ statusSelect(plan.status) }}"
                                  >
                                    <option value="PENDING">Pending</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="DONE">Done</option>
                                    <option value="REJECTED">Rejected</option>
                                  </select>
                                  <button
                                    type="button"
                                    (click)="confirmDeletePlan(f.id, plan.id)"
                                    class="rounded p-0.5 text-gray-300 hover:text-red-500"
                                    title="Delete plan"
                                  >
                                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            }
                          </div>
                        }
                      </div>
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td colspan="9" class="px-4 py-8 text-center text-gray-500">No feedbacks yet.</td>
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

    <!-- Create Action Plan Modal -->
    @if (modal().open) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="closeModal()"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

        <!-- Panel -->
        <div
          class="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 class="text-base font-semibold text-gray-900">New Action Plan</h2>
              <p class="mt-0.5 text-xs text-gray-500">Feedback #{{ modal().feedbackId }}</p>
            </div>
            <button
              type="button"
              (click)="closeModal()"
              class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 flex flex-col gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">
                Title <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                [(ngModel)]="modalTitle"
                (keyup.enter)="submitModal()"
                placeholder="e.g. Call customer to apologize"
                maxlength="120"
                class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                autofocus
              />
              @if (modalError()) {
                <p class="mt-1 text-xs text-red-500">{{ modalError() }}</p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Description <span class="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                [(ngModel)]="modalDescription"
                placeholder="Detailed steps or context..."
                rows="3"
                maxlength="500"
                class="mt-1.5 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              ></textarea>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <button
              type="button"
              (click)="closeModal()"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="submitModal()"
              [disabled]="savingPlan()"
              class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              @if (savingPlan()) {
                <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Saving...
              } @else {
                Create Plan
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirmation Modal -->
    @if (deleteModal().open) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="closeDeleteModal()"
      >
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
        <div
          class="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-start gap-4">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
              <svg class="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-base font-semibold text-gray-900">Delete Action Plan</h3>
              <p class="mt-1 text-sm text-gray-500">Are you sure you want to delete this action plan? This action cannot be undone.</p>
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="closeDeleteModal()"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              (click)="executePlanDelete()"
              class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminFeedbackListComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedbacks = signal<AdminFeedbackItem[]>([]);
  readonly meta = signal<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  readonly feedbackTypes = signal<FeedbackType[]>([]);
  readonly savingPlan = signal(false);
  readonly expandedRows = signal<Set<number>>(new Set());

  // Create Plan modal state
  readonly modal = signal<{ open: boolean; feedbackId: number | null }>({ open: false, feedbackId: null });
  readonly modalError = signal<string | null>(null);
  modalTitle = '';
  modalDescription = '';

  // Delete confirmation modal state
  readonly deleteModal = signal<{ open: boolean; feedbackId: number | null; planId: number | null }>({
    open: false,
    feedbackId: null,
    planId: null,
  });

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

  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 30_000;

  private readonly DEBOUNCE_MS = 300;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly THROTTLE_MS = 500;
  private lastCallTs = 0;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;

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

  statusBar(status: ActionPlanStatus): string {
    return STATUS_BAR[status] ?? '';
  }

  statusSelect(status: ActionPlanStatus): string {
    return STATUS_SELECT[status] ?? '';
  }

  planDotClass(plans: ActionPlanItem[]): string | null {
    if (!plans.length) return null;
    const statuses = plans.map((p) => p.status);
    if (statuses.includes('IN_PROGRESS')) return 'bg-indigo-500';
    if (statuses.every((s) => s === 'DONE' || s === 'REJECTED')) return 'bg-emerald-400';
    return 'bg-amber-400';
  }

  statusLabel(status: ActionPlanStatus): string {
    return STATUS_LABEL[status] ?? status;
  }

  toggleRow(id: number): void {
    this.expandedRows.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isExpanded(id: number): boolean {
    return this.expandedRows().has(id);
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
    if (this.feedbacks().length === 0) return 0;
    return (m.page - 1) * m.limit + 1;
  }

  rangeEnd(): number {
    const m = this.meta();
    if (!m) return 0;
    return (m.page - 1) * m.limit + this.feedbacks().length;
  }

  // ── Create Plan Modal ──────────────────────────────────────────────

  openModal(feedbackId: number): void {
    this.modalTitle = '';
    this.modalDescription = '';
    this.modalError.set(null);
    this.modal.set({ open: true, feedbackId });
  }

  closeModal(): void {
    if (this.savingPlan()) return;
    this.modal.set({ open: false, feedbackId: null });
  }

  submitModal(): void {
    const feedbackId = this.modal().feedbackId;
    if (!feedbackId) return;

    if (!this.modalTitle.trim()) {
      this.modalError.set('Title is required.');
      return;
    }

    this.modalError.set(null);
    this.savingPlan.set(true);

    this.http
      .post<ApiSuccess<ActionPlanItem>>(
        `${environment.apiUrl}/api/feedbacks/${feedbackId}/action-plans`,
        {
          title: this.modalTitle.trim(),
          description: this.modalDescription.trim() || undefined,
        }
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.invalidateCache();
            this.feedbacks.update((list) =>
              list.map((f) =>
                f.id === feedbackId ? { ...f, actionPlans: [res.data!, ...f.actionPlans] } : f
              )
            );
          }
          this.savingPlan.set(false);
          this.modal.set({ open: false, feedbackId: null });
        },
        error: (err: HttpErrorResponse) => {
          this.modalError.set(err.error?.message ?? err.message ?? 'Failed to create plan.');
          this.savingPlan.set(false);
        },
      });
  }

  // ── Update Plan ────────────────────────────────────────────────────

  updatePlanStatus(feedbackId: number, planId: number, newStatus: ActionPlanStatus): void {
    this.http
      .patch<ApiSuccess<ActionPlanItem>>(
        `${environment.apiUrl}/api/feedbacks/action-plans/${planId}`,
        { status: newStatus }
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.invalidateCache();
            this.updateLocalPlan(feedbackId, planId, res.data);
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to update status:', err.error?.message ?? err.message);
        },
      });
  }

  updatePlanResolution(feedbackId: number, planId: number, resolution: string): void {
    if (!resolution.trim()) return;
    this.http
      .patch<ApiSuccess<ActionPlanItem>>(
        `${environment.apiUrl}/api/feedbacks/action-plans/${planId}`,
        { resolution: resolution.trim() }
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.invalidateCache();
            this.updateLocalPlan(feedbackId, planId, res.data);
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to save resolution:', err.error?.message ?? err.message);
        },
      });
  }

  // ── Delete Plan Modal ──────────────────────────────────────────────

  confirmDeletePlan(feedbackId: number, planId: number): void {
    this.deleteModal.set({ open: true, feedbackId, planId });
  }

  closeDeleteModal(): void {
    this.deleteModal.set({ open: false, feedbackId: null, planId: null });
  }

  executePlanDelete(): void {
    const { feedbackId, planId } = this.deleteModal();
    if (!feedbackId || !planId) return;

    this.closeDeleteModal();

    this.http
      .delete<ApiSuccess<null>>(`${environment.apiUrl}/api/feedbacks/action-plans/${planId}`)
      .subscribe({
        next: () => {
          this.invalidateCache();
          this.feedbacks.update((list) =>
            list.map((f) =>
              f.id === feedbackId
                ? { ...f, actionPlans: f.actionPlans.filter((p) => p.id !== planId) }
                : f
            )
          );
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to delete plan:', err.error?.message ?? err.message);
        },
      });
  }

  // ── Internals ──────────────────────────────────────────────────────

  private updateLocalPlan(feedbackId: number, planId: number, updated: ActionPlanItem): void {
    this.feedbacks.update((list) =>
      list.map((f) => {
        if (f.id !== feedbackId) return f;
        return { ...f, actionPlans: f.actionPlans.map((p) => (p.id === planId ? updated : p)) };
      })
    );
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

    let params = new HttpParams().set('page', String(this.page)).set('limit', String(this.limit));
    if (this.appliedSearch) params = params.set('search', this.appliedSearch);
    if (this.appliedSentiment) params = params.set('sentiment', this.appliedSentiment);
    if (this.appliedRating) params = params.set('rating', String(this.appliedRating));
    if (this.appliedType) params = params.set('typeId', String(this.appliedType));

    this.pendingSub = this.http
      .get<ApiSuccess<AdminFeedbackItem[]>>(`${environment.apiUrl}/api/feedbacks`, { params })
      .pipe(
        map((r) => {
          if (!r.success) throw new Error(r.message);
          const meta: PaginationMeta | null | undefined = r.meta;
          return {
            data: (Array.isArray(r.data) ? r.data : []).map((item) => ({
              ...item,
              actionPlans: Array.isArray(item.actionPlans) ? item.actionPlans : [],
            })),
            meta: meta
              ? { page: meta.page, limit: meta.limit, total: meta.total, totalPages: meta.totalPages }
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
          this.error.set(e.message || 'Failed to load feedbacks.');
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

  private invalidateCache(): void {
    this.cache.clear();
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
