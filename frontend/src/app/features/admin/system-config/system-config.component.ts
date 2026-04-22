import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SystemConfigService } from '../../../core/services/system-config.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  CONFIG_GROUPS,
  CONFIG_META_FE,
  type ConfigGroup,
  type SystemConfigMeta,
  type SystemConfigRecord,
} from '../../../shared/models/system-config.model';

@Component({
  selector: 'app-admin-system-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mx-auto w-full max-w-6xl pb-12">
      <div class="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">System Configuration</h1>
          <p class="mt-2 text-sm text-gray-500">
            Manage runtime settings without restarting the server. Changes take effect within ~30 seconds.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="discardChanges()"
            [disabled]="saving() || !isDirty()"
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            (click)="saveAll()"
            [disabled]="saving() || !isDirty()"
            class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800 disabled:opacity-40"
          >
            @if (saving()) {
              <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              Saving...
            } @else {
              Save All Changes
            }
          </button>
        </div>
      </div>

      @if (loadError()) {
        <div class="rounded-md bg-red-50 p-4">
          <p class="text-sm font-medium text-red-800">{{ loadError() }}</p>
        </div>
      } @else if (loading()) {
        <div class="flex items-center justify-center py-20">
          <svg class="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
        </div>
      } @else {
        @if (isDirty()) {
          <div class="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <svg class="h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <p class="text-sm font-medium text-amber-800">
              You have unsaved changes. Click <strong>Save All Changes</strong> to apply them.
            </p>
          </div>
        }

        <div class="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
          @for (group of groups; track group.id) {
            <button
              type="button"
              (click)="activeGroup.set(group.id)"
              class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all"
              [ngClass]="activeGroup() === group.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'"
            >
              <span>{{ group.icon }}</span>
              <span class="hidden sm:inline">{{ group.label }}</span>
            </button>
          }
        </div>

        <div class="space-y-4">
          @for (meta of activeGroupConfigs(); track meta.key) {
            <div
              class="rounded-xl border bg-white p-6 shadow-sm transition-all"
              [ngClass]="isChanged(meta.key) ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'"
            >
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <label [for]="meta.key" class="text-sm font-semibold text-gray-900">{{ meta.label }}</label>
                    @if (isChanged(meta.key)) {
                      <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        Modified
                      </span>
                    }
                  </div>
                  <p class="mt-1 text-sm text-gray-500">{{ meta.description }}</p>
                  @if (meta.min !== undefined || meta.max !== undefined) {
                    <p class="mt-1 text-xs text-gray-400">
                      Range:
                      @if (meta.min !== undefined) { min {{ meta.min }} }
                      @if (meta.min !== undefined && meta.max !== undefined) { – }
                      @if (meta.max !== undefined) { max {{ meta.max }} }
                    </p>
                  }
                </div>

                <div class="w-full sm:w-72">
                  @if (meta.type === 'boolean') {
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        [id]="meta.key"
                        (click)="toggleBool(meta.key)"
                        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
                        [ngClass]="getDraftValue(meta.key) === 'true' ? 'bg-gray-900' : 'bg-gray-300'"
                      >
                        <span
                          class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
                          [ngClass]="getDraftValue(meta.key) === 'true' ? 'translate-x-6' : 'translate-x-1'"
                        ></span>
                      </button>
                      <span class="text-sm font-medium text-gray-700">
                        {{ getDraftValue(meta.key) === 'true' ? 'Enabled' : 'Disabled' }}
                      </span>
                    </div>
                  } @else if (meta.type === 'secret') {
                    <div class="relative">
                      <input
                        [id]="meta.key"
                        [type]="showSecret[meta.key] ? 'text' : 'password'"
                        [value]="getDraftValue(meta.key)"
                        (input)="onInput(meta.key, $event)"
                        autocomplete="off"
                        placeholder="Enter API key..."
                        class="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                      <button
                        type="button"
                        (click)="toggleShowSecret(meta.key)"
                        class="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      >
                        @if (showSecret[meta.key]) {
                          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21"/>
                          </svg>
                        } @else {
                          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                        }
                      </button>
                    </div>
                  } @else {
                    <input
                      [id]="meta.key"
                      type="text"
                      [value]="getDraftValue(meta.key)"
                      (input)="onInput(meta.key, $event)"
                      [placeholder]="getPlaceholder(meta)"
                      class="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
                      [ngClass]="validationErrors[meta.key] ? 'border-red-400 focus:ring-red-400' : ''"
                    />
                    @if (validationErrors[meta.key]) {
                      <p class="mt-1 text-xs text-red-600">{{ validationErrors[meta.key] }}</p>
                    }
                  }
                </div>
              </div>
            </div>
          }
        </div>

        <p class="mt-8 text-center text-xs text-gray-400">
          Changes take effect within ~30 seconds after saving.
        </p>
      }
    </div>
  `,
})
export class AdminSystemConfigComponent implements OnInit {
  private readonly configService = inject(SystemConfigService);
  private readonly toast = inject(ToastService);

  readonly groups = CONFIG_GROUPS;
  readonly activeGroup = signal<ConfigGroup>('auth');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);

  private original = new Map<string, string>();
  private draft = new Map<string, string>();

  showSecret: Record<string, boolean> = {};
  validationErrors: Record<string, string> = {};

  readonly activeGroupConfigs = computed(() => CONFIG_META_FE.filter((m) => m.group === this.activeGroup()));

  readonly isDirty = computed(() => {
    for (const [key, val] of this.draft) {
      if (this.original.get(key) !== val) return true;
    }
    return false;
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.configService.getAll().subscribe({
      next: (records) => {
        this.loading.set(false);
        this.loadError.set(null);
        this.original.clear();
        this.draft.clear();
        for (const r of records) {
          this.original.set(r.key, r.value);
          this.draft.set(r.key, r.value);
        }
      },
      error: (e: Error) => {
        this.loading.set(false);
        this.loadError.set(e.message || 'Failed to load system config');
      },
    });
  }

  getDraftValue(key: string): string {
    return this.draft.get(key) ?? '';
  }

  isChanged(key: string): boolean {
    return this.original.get(key) !== this.draft.get(key);
  }

  onInput(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.set(key, value);
    delete this.validationErrors[key];
  }

  toggleBool(key: string): void {
    const current = this.draft.get(key);
    this.draft.set(key, current === 'true' ? 'false' : 'true');
  }

  toggleShowSecret(key: string): void {
    this.showSecret[key] = !this.showSecret[key];
  }

  discardChanges(): void {
    this.draft.clear();
    for (const [key, val] of this.original) {
      this.draft.set(key, val);
    }
    this.validationErrors = {};
  }

  saveAll(): void {
    if (!this.isDirty()) return;

    const changed: Array<{ key: string; value: string }> = [];
    for (const [key, val] of this.draft) {
      if (this.original.get(key) !== val) changed.push({ key, value: val });
    }

    this.saving.set(true);
    this.configService.bulkUpdate(changed).subscribe({
      next: (updated) => {
        this.saving.set(false);
        for (const r of updated) {
          this.original.set(r.key, r.value);
          this.draft.set(r.key, r.value);
        }
        this.validationErrors = {};
        this.toast.show('System configuration saved successfully.', 'success');
      },
      error: (e: Error) => {
        this.saving.set(false);
        this.toast.show(e.message || 'Failed to save config', 'error');
      },
    });
  }

  getPlaceholder(meta: SystemConfigMeta): string {
    const map: Record<string, string> = {
      duration: 'e.g. 14m, 1h',
      number: 'Enter a number',
      url: 'https://...',
      text: 'Enter value',
      secret: 'Enter value',
      boolean: '',
    };
    return map[meta.type] ?? '';
  }
}

