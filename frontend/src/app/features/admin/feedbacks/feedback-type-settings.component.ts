import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, firstValueFrom, map, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiSuccess } from '../../../shared/models/api-response.model';
import type { FeedbackType } from '../../../shared/models/feedback.model';
import { ToastService } from '../../../core/services/toast.service';

interface DemoAnalyzePayload {
  resolvedTypeId: number | null;
  sentiment: string;
  rawJson: string;
}

@Component({
  selector: 'app-feedback-type-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto w-full max-w-6xl">
      <div class="flex flex-col gap-3 border-b border-gray-200 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Feedback Types</h1>

        </div>
        <button
          type="button"
          (click)="toggleDemo()"
          [disabled]="demoSaving() || demoAnalyzing()"
          class="flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
          {{ demoOpen() ? 'Close playground' : 'Playground' }}
        </button>
      </div>

      @if (demoOpen()) {
        <div
          class="mt-6 rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm ring-1 ring-amber-100"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 class="text-sm font-semibold text-gray-900">AI playground</h2>
              <p class="mt-1 text-xs text-amber-900/80">
                Changes stay in memory until you <span class="font-semibold">Save</span>. Run analysis
                uses the playground list only. Close without saving discards playground changes.
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                (click)="resetDemo()"
                [disabled]="demoSaving() || demoAnalyzing()"
                class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="button"
                (click)="saveDemoToServer()"
                [disabled]="demoSaving() || demoAnalyzing()"
                class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {{ demoSaving() ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
          <div class="mt-4 grid gap-6 lg:grid-cols-2 lg:items-start">
            <!-- Chat / JSON -->
            <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 class="text-xs font-bold uppercase tracking-wide text-gray-500">Feedback Simulation</h3>
              <textarea
                [(ngModel)]="demoComment"
                rows="6"
                [disabled]="demoAnalyzing() || demoSaving()"
                class="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                placeholder="Enter a hypothetical customer review to evaluate the AI's classification accuracy. (e.g., 'The product quality exceeded expectations, but shipping took longer than promised.')"
              ></textarea>
              <button
                type="button"
                (click)="runDemoAnalyze()"
                [disabled]="demoAnalyzing() || demoSaving() || !demoComment.trim()"
                class="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {{ demoAnalyzing() ? 'Analyzing…' : 'Run analysis' }}
              </button>
              @if (demoError()) {
                <p class="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {{ demoError() }}
                </p>
              }
              @if (demoResult(); as res) {
                <div class="mt-4 space-y-3">
                  <div class="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <p>
                      <span class="font-semibold text-gray-900">Sentiment:</span>
                      {{ res.sentiment }}
                    </p>
                    <p class="mt-1">
                      <span class="font-semibold text-gray-900">Resolved type id:</span>
                      {{ res.resolvedTypeId ?? '—' }}
                    </p>
                  </div>
                  <div>
                    <span class="text-xs font-medium text-gray-500">Raw model JSON</span>
                    <pre
                      class="mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-900 p-3 text-xs text-green-200"
                    >{{ demoRawFormatted() }}</pre>
                  </div>
                </div>
              }
            </div>

            <!-- Mirror editor (no save) -->
            <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 class="text-xs font-bold uppercase tracking-wide text-gray-500">Types (playground)</h3>
              <div class="mt-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                <h4 class="text-xs font-semibold text-gray-700">Add (local)</h4>
                <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div class="min-w-0 flex-1">
                    <label class="block text-[10px] font-medium text-gray-500">Name *</label>
                    <input
                      type="text"
                      [(ngModel)]="demoNewName"
                      (keyup.enter)="demoCreate()"
                      [disabled]="demoSaving()"
                      class="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-50"
                      placeholder="e.g. Product Quality"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <label class="block text-[10px] font-medium text-gray-500">Description</label>
                    <input
                      type="text"
                      [(ngModel)]="demoNewDescription"
                      (keyup.enter)="demoCreate()"
                      [disabled]="demoSaving()"
                      class="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:opacity-50"
                      placeholder="Optional"
                    />
                  </div>
                  <button
                    type="button"
                    (click)="demoCreate()"
                    [disabled]="demoSaving() || !demoNewName.trim()"
                    class="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-600 disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>
              </div>
              <div class="mt-3 overflow-hidden rounded-lg border border-gray-200">
                <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 font-medium text-gray-700">Name</th>
                      <th class="px-3 py-2 font-medium text-gray-700">Description</th>
                      <th class="w-24 px-3 py-2 text-center font-medium text-gray-700">Active</th>
                      <th class="w-20 px-3 py-2 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (type of demoTypes(); track type.id) {
                      <tr class="hover:bg-gray-50" [class.opacity-50]="!type.isActive">
                        <td class="px-3 py-2">
                          @if (demoEditingId() === type.id) {
                            <input
                              type="text"
                              [(ngModel)]="demoEditName"
                              [disabled]="demoSaving()"
                              class="w-full rounded border border-blue-400 px-2 py-1 text-sm disabled:opacity-50"
                              (keyup.enter)="demoSaveEdit(type)"
                              (keyup.escape)="demoCancelEdit()"
                            />
                          } @else {
                            <span class="font-medium text-gray-900">{{ type.name }}</span>
                          }
                        </td>
                        <td class="px-3 py-2 text-gray-600">
                          @if (demoEditingId() === type.id) {
                            <input
                              type="text"
                              [(ngModel)]="demoEditDescription"
                              [disabled]="demoSaving()"
                              class="w-full rounded border border-blue-400 px-2 py-1 text-sm disabled:opacity-50"
                              (keyup.enter)="demoSaveEdit(type)"
                              (keyup.escape)="demoCancelEdit()"
                              placeholder="Optional"
                            />
                          } @else {
                            {{ type.description || '—' }}
                          }
                        </td>
                        <td class="px-3 py-2 text-center">
                          <div class="group relative inline-block">
                            <button
                              type="button"
                              (click)="demoToggleActive(type)"
                              [disabled]="
                                demoSaving() ||
                                (type.isActive && demoActiveCount() <= 1) ||
                                type.name === 'Unknown'
                              "
                              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                              [class.bg-blue-600]="type.isActive"
                              [class.bg-gray-300]="!type.isActive"
                              [attr.aria-label]="type.isActive ? 'Deactivate' : 'Activate'"
                            >
                              <span
                                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                                [class.translate-x-6]="type.isActive"
                                [class.translate-x-1]="!type.isActive"
                              ></span>
                            </button>
                            @if (type.name === 'Unknown') {
                              <div
                                class="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden w-44 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-center text-[10px] text-white group-hover:block"
                              >
                                System default — cannot deactivate
                              </div>
                            } @else if (type.isActive && demoActiveCount() <= 1) {
                              <div
                                class="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden w-40 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-center text-[10px] text-white group-hover:block"
                              >
                                Must keep at least 1 active
                              </div>
                            }
                          </div>
                        </td>
                        <td class="px-3 py-2">
                          @if (demoEditingId() === type.id) {
                            <div class="flex flex-col gap-1">
                              <button
                                type="button"
                                (click)="demoSaveEdit(type)"
                                [disabled]="demoSaving()"
                                class="text-left text-[10px] font-medium text-blue-600 hover:underline disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                (click)="demoCancelEdit()"
                                [disabled]="demoSaving()"
                                class="text-left text-[10px] font-medium text-gray-500 hover:underline disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          } @else {
                            <button
                              type="button"
                              (click)="demoStartEdit(type)"
                              [disabled]="demoSaving()"
                              class="text-[10px] font-medium text-gray-600 hover:text-gray-900 hover:underline disabled:opacity-50"
                            >
                              Edit
                            </button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      }

      @if (!demoOpen()) {
      <!-- Create form -->
      <div class="mt-6">
        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 class="text-sm font-semibold text-gray-700">Add New Type</h2>
          <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-600">Name <span class="text-red-500">*</span></label>
              <input
                type="text"
                [(ngModel)]="newName"
                (keyup.enter)="create()"
                [disabled]="saving()"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                placeholder="e.g. Product Quality"
              />
            </div>
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-600">Description</label>
              <input
                type="text"
                [(ngModel)]="newDescription"
                (keyup.enter)="create()"
                [disabled]="saving()"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                placeholder="Optional description..."
              />
            </div>
            <button
              type="button"
              (click)="create()"
              [disabled]="saving() || !newName.trim()"
              class="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {{ saving() ? 'Saving…' : '+ Add' }}
            </button>
          </div>
        </div>

        <!-- List -->
        @if (loading()) {
          <p class="mt-8 text-sm text-gray-500">Loading…</p>
        } @else {
          <div class="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 font-medium text-gray-700">Name</th>
                  <th class="px-4 py-3 font-medium text-gray-700">Description</th>
                  <th class="w-28 px-4 py-3 text-center font-medium text-gray-700">Active</th>
                  <th class="w-24 px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (type of types(); track type.id) {
                  <tr class="hover:bg-gray-50" [class.opacity-50]="!type.isActive">
                    <td class="px-4 py-3">
                      @if (editingId() === type.id) {
                        <input
                          type="text"
                          [(ngModel)]="editName"
                          class="w-full rounded border border-blue-400 px-2 py-1 text-sm"
                          (keyup.enter)="saveEdit(type)"
                          (keyup.escape)="cancelEdit()"
                        />
                      } @else {
                        <span class="font-medium text-gray-900">{{ type.name }}</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-gray-600">
                      @if (editingId() === type.id) {
                        <input
                          type="text"
                          [(ngModel)]="editDescription"
                          class="w-full rounded border border-blue-400 px-2 py-1 text-sm"
                          (keyup.enter)="saveEdit(type)"
                          (keyup.escape)="cancelEdit()"
                          placeholder="Optional description..."
                        />
                      } @else {
                        {{ type.description || '—' }}
                      }
                    </td>
                    <td class="px-4 py-3 text-center">
                      <div class="group relative inline-block">
                        <button
                          type="button"
                          (click)="toggleActive(type)"
                          [disabled]="updatingId() === type.id || (type.isActive && activeCount() <= 1) || type.name === 'Unknown'"
                          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          [class.bg-blue-600]="type.isActive"
                          [class.bg-gray-300]="!type.isActive"
                          [attr.aria-label]="type.isActive ? 'Deactivate' : 'Activate'"
                        >
                          <span
                            class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                            [class.translate-x-6]="type.isActive"
                            [class.translate-x-1]="!type.isActive"
                          ></span>
                        </button>
                        @if (type.name === 'Unknown') {
                          <div
                            class="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden w-48 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-center text-xs text-white group-hover:block"
                          >
                            System default — cannot deactivate
                          </div>
                        } @else if (type.isActive && activeCount() <= 1) {
                          <div
                            class="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden w-44 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-center text-xs text-white group-hover:block"
                          >
                            Must keep at least 1 active
                          </div>
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      @if (editingId() === type.id) {
                        <div class="flex gap-2">
                          <button
                            type="button"
                            (click)="saveEdit(type)"
                            [disabled]="updatingId() === type.id"
                            class="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            (click)="cancelEdit()"
                            class="text-xs font-medium text-gray-500 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      } @else {
                        <button
                          type="button"
                          (click)="startEdit(type)"
                          class="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline"
                        >
                          Edit
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-gray-500">No feedback types yet.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
      }
    </div>
  `,
})
export class FeedbackTypeSettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  private readonly apiUrl = `${environment.apiUrl}/api/feedback-types`;
  private demoTempId = 0;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly types = signal<FeedbackType[]>([]);
  readonly editingId = signal<number | null>(null);
  readonly updatingId = signal<number | null>(null);
  readonly activeCount = computed(() => this.types().filter((t) => t.isActive).length);

  readonly demoOpen = signal(false);
  readonly demoTypes = signal<FeedbackType[]>([]);
  readonly demoEditingId = signal<number | null>(null);
  readonly demoAnalyzing = signal(false);
  readonly demoSaving = signal(false);
  readonly demoResult = signal<DemoAnalyzePayload | null>(null);
  readonly demoError = signal<string | null>(null);
  readonly demoActiveCount = computed(() => this.demoTypes().filter((t) => t.isActive).length);

  newName = '';
  newDescription = '';
  editName = '';
  editDescription = '';

  demoComment = '';
  demoNewName = '';
  demoNewDescription = '';
  demoEditName = '';
  demoEditDescription = '';

  ngOnInit(): void {
    this.load();
  }

  demoRawFormatted(): string {
    const r = this.demoResult();
    if (!r?.rawJson) return '';
    try {
      return JSON.stringify(JSON.parse(r.rawJson), null, 2);
    } catch {
      return r.rawJson;
    }
  }

  toggleDemo(): void {
    const next = !this.demoOpen();
    this.demoOpen.set(next);
    if (next) {
      this.resetDemo();
    }
  }

  /** Restore playground types from the last loaded DB list (discard unsaved playground edits). */
  resetDemo(): void {
    if (this.demoSaving()) return;
    this.demoTypes.set(structuredClone(this.types()));
    this.demoEditingId.set(null);
    this.demoResult.set(null);
    this.demoError.set(null);
    this.demoNewName = '';
    this.demoNewDescription = '';
  }

  demoStartEdit(type: FeedbackType): void {
    this.demoEditingId.set(type.id);
    this.demoEditName = type.name;
    this.demoEditDescription = type.description ?? '';
  }

  demoCancelEdit(): void {
    this.demoEditingId.set(null);
  }

  demoSaveEdit(type: FeedbackType): void {
    const name = this.demoEditName.trim();
    if (!name) return;
    const description = this.demoEditDescription.trim() || null;
    this.demoTypes.update((list) =>
      list.map((t) => (t.id === type.id ? { ...t, name, description } : t))
    );
    this.demoEditingId.set(null);
  }

  demoToggleActive(type: FeedbackType): void {
    if (type.name === 'Unknown') return;
    if (type.isActive && this.demoActiveCount() <= 1) return;
    this.demoTypes.update((list) =>
      list.map((t) => (t.id === type.id ? { ...t, isActive: !t.isActive } : t))
    );
  }

  demoCreate(): void {
    if (this.demoSaving()) return;
    const name = this.demoNewName.trim();
    if (!name) return;
    this.demoTempId -= 1;
    const row: FeedbackType = {
      id: this.demoTempId,
      name,
      description: this.demoNewDescription.trim() || null,
      isActive: true,
    };
    this.demoTypes.update((list) => [...list, row]);
    this.demoNewName = '';
    this.demoNewDescription = '';
  }

  async saveDemoToServer(): Promise<void> {
    if (this.demoSaving()) return;
    this.demoSaving.set(true);
    this.demoError.set(null);
    try {
      const list = this.demoTypes();
      const existing = list.filter((t) => t.id >= 0);
      const created = list.filter((t) => t.id < 0);

      for (const t of existing) {
        await firstValueFrom(
          this.http
            .patch<ApiSuccess<FeedbackType>>(`${this.apiUrl}/${t.id}`, {
              name: t.name.trim(),
              description: t.description?.trim() || null,
              isActive: t.isActive,
            })
            .pipe(
              map((r) => {
                if (!r.data) throw new Error(r.message || 'Failed to update');
                return r.data;
              }),
              catchError((err: HttpErrorResponse) =>
                throwError(() => new Error(err.error?.message ?? 'Failed to update'))
              )
            )
        );
      }

      for (const t of created) {
        const row = await firstValueFrom(
          this.http
            .post<ApiSuccess<FeedbackType>>(this.apiUrl, {
              name: t.name.trim(),
              description: t.description?.trim() || null,
            })
            .pipe(
              map((r) => {
                if (!r.data) throw new Error(r.message || 'Failed to create');
                return r.data;
              }),
              catchError((err: HttpErrorResponse) =>
                throwError(() => new Error(err.error?.message ?? 'Failed to create'))
              )
            )
        );
        if (!t.isActive) {
          await firstValueFrom(
            this.http
              .patch<ApiSuccess<FeedbackType>>(`${this.apiUrl}/${row.id}`, { isActive: false })
              .pipe(
                map((r) => {
                  if (!r.data) throw new Error(r.message || 'Failed to update');
                  return r.data;
                }),
                catchError((err: HttpErrorResponse) =>
                  throwError(() => new Error(err.error?.message ?? 'Failed to update'))
                )
              )
          );
        }
      }

      this.toast.show('Playground saved to database', 'success');
      this.demoOpen.set(false);
      this.demoEditingId.set(null);
      this.load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      this.toast.show(msg, 'error');
    } finally {
      this.demoSaving.set(false);
    }
  }

  runDemoAnalyze(): void {
    const comment = this.demoComment.trim();
    if (!comment) return;
    this.demoAnalyzing.set(true);
    this.demoError.set(null);
    this.demoResult.set(null);
    this.http
      .post<ApiSuccess<DemoAnalyzePayload>>(`${this.apiUrl}/demo/analyze`, {
        comment,
        types: this.demoTypes(),
      })
      .pipe(
        map((r) => {
          if (!r.success || !r.data) throw new Error(r.message || 'Demo analysis failed');
          return r.data;
        }),
        catchError((err: HttpErrorResponse) =>
          throwError(() => new Error(err.error?.message ?? err.message ?? 'Request failed'))
        )
      )
      .subscribe({
        next: (data) => {
          this.demoResult.set(data);
          this.demoAnalyzing.set(false);
        },
        error: (e: Error) => {
          this.demoError.set(e.message);
          this.demoAnalyzing.set(false);
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.http
      .get<ApiSuccess<FeedbackType[]>>(this.apiUrl)
      .pipe(
        map((r) => (r.success && Array.isArray(r.data) ? r.data : [])),
        catchError((err: HttpErrorResponse) => {
          this.toast.show(err.error?.message ?? 'Failed to load feedback types', 'error');
          return of([] as FeedbackType[]);
        })
      )
      .subscribe((data) => {
        this.types.set(data);
        this.loading.set(false);
      });
  }

  create(): void {
    const name = this.newName.trim();
    if (!name) return;

    this.saving.set(true);
    this.http
      .post<ApiSuccess<FeedbackType>>(this.apiUrl, {
        name,
        description: this.newDescription.trim() || null,
      })
      .pipe(
        map((r) => r.data),
        catchError((err: HttpErrorResponse) =>
          throwError(() => new Error(err.error?.message ?? 'Failed to create'))
        )
      )
      .subscribe({
        next: (created) => {
          this.types.update((list) => [...list, created]);
          this.newName = '';
          this.newDescription = '';
          this.saving.set(false);
          this.toast.show('Feedback type created', 'success');
        },
        error: (e: Error) => {
          this.toast.show(e.message, 'error');
          this.saving.set(false);
        },
      });
  }

  startEdit(type: FeedbackType): void {
    this.editingId.set(type.id);
    this.editName = type.name;
    this.editDescription = type.description ?? '';
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(type: FeedbackType): void {
    const name = this.editName.trim();
    if (!name) return;
    this.patch(type.id, {
      name,
      description: this.editDescription.trim() || null,
    });
  }

  toggleActive(type: FeedbackType): void {
    this.patch(type.id, { isActive: !type.isActive });
  }

  private patch(
    id: number,
    body: Partial<{ name: string; description: string | null; isActive: boolean }>
  ): void {
    this.updatingId.set(id);
    this.http
      .patch<ApiSuccess<FeedbackType>>(`${this.apiUrl}/${id}`, body)
      .pipe(
        map((r) => r.data),
        catchError((err: HttpErrorResponse) =>
          throwError(() => new Error(err.error?.message ?? 'Failed to update'))
        )
      )
      .subscribe({
        next: (updated) => {
          this.types.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
          this.updatingId.set(null);
          this.editingId.set(null);
          this.toast.show('Feedback type updated', 'success');
        },
        error: (e: Error) => {
          this.toast.show(e.message, 'error');
          this.updatingId.set(null);
        },
      });
  }
}
