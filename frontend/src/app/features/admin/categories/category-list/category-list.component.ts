import { Component, OnInit, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductApiService, type CategoryDto } from '../../../../core/services/product-api.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-admin-category-list',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto w-full max-w-6xl pb-10">
      <div class="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Categories</h1>
        </div>
        <button
          type="button"
          (click)="openModal('CREATE')"
          class="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Add category
        </button>
      </div>

      @if (loading()) {
        <div class="mt-12 flex justify-center">
          <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" aria-hidden="true"></div>
        </div>
      } @else if (error()) {
        <div class="mt-8 rounded-xl border border-red-100 bg-red-50 p-4 text-red-600">{{ error() }}</div>
      } @else {
        <div class="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead class="bg-gray-50/80">
              <tr>
                <th class="px-6 py-4 font-semibold text-gray-700">Category Name</th>
                <th class="px-6 py-4 text-center font-semibold text-gray-700">Total Products</th>
                <th class="w-[200px] px-6 py-4 text-right font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (cat of categories(); track cat.id) {
                <tr class="transition-colors hover:bg-gray-50/50">
                  <td class="px-6 py-4 font-medium text-gray-900">{{ cat.name }}</td>
                  <td class="px-6 py-4 text-center">
                    <span
                      class="inline-flex items-center justify-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-600/20"
                    >
                      {{ cat._count?.products ?? 0 }} items
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        (click)="openModal('EDIT', cat)"
                        class="text-sm font-semibold text-blue-600 hover:text-blue-900 hover:underline"
                      >
                        Edit
                      </button>

                      @if (productCount(cat) === 0) {
                        <button
                          type="button"
                          (click)="openModal('DELETE', cat)"
                          class="text-sm font-semibold text-red-600 hover:text-red-900 hover:underline"
                        >
                          Delete
                        </button>
                      } @else {
                        <span class="group relative inline-block">
                          <button
                            type="button"
                            disabled
                            class="cursor-not-allowed text-sm font-semibold text-red-600 opacity-40"
                          >
                            Delete
                          </button>
                          <div
                            class="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden w-max rounded bg-gray-800 px-2 py-1 text-center text-xs text-white shadow-lg group-hover:block"
                          >
                            Remove products before deleting
                          </div>
                        </span>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="px-6 py-12 text-center text-gray-500">
                    No categories found. Click &quot;+ Add category&quot; to start organizing.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (modalState() !== 'CLOSED') {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'category-modal-title'"
        >
          <div
            class="mx-4 w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all duration-200 motion-reduce:transition-none"
            (click)="$event.stopPropagation()"
          >
            <h3 id="category-modal-title" class="text-lg font-bold leading-6 text-gray-900">
              @switch (modalState()) {
                @case ('CREATE') {
                  Add New Category
                }
                @case ('EDIT') {
                  Rename Category
                }
                @case ('DELETE') {
                  Delete Category
                }
              }
            </h3>

            @if (modalState() === 'DELETE') {
              <div class="mt-2">
                <p class="text-sm text-gray-600">
                  Are you sure you want to permanently delete the category
                  <span class="font-bold text-gray-900">"{{ activeCategory()?.name }}"</span>? This action cannot be
                  undone.
                </p>
              </div>
            } @else {
              <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700">
                  Category Name <span class="text-red-500">*</span>
                </label>
                <input
                  #modalInput
                  type="text"
                  [(ngModel)]="draftName"
                  (keyup.enter)="submitModal()"
                  class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Electronics, Clothing..."
                  [disabled]="isWorking()"
                />
              </div>
            }

            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                (click)="closeModal()"
                [disabled]="isWorking()"
                class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                (click)="submitModal()"
                [disabled]="isWorking() || (modalState() !== 'DELETE' && !draftName.trim())"
                class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                [class]="modalState() === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-800'"
              >
                @if (isWorking()) {
                  <svg
                    class="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
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
                @switch (modalState()) {
                  @case ('CREATE') {
                    Create
                  }
                  @case ('EDIT') {
                    Save Changes
                  }
                  @case ('DELETE') {
                    Yes, Delete
                  }
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminCategoryListComponent implements OnInit {
  @ViewChild('modalInput') private modalInput?: ElementRef<HTMLInputElement>;

  private readonly api = inject(ProductApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly categories = signal<CategoryDto[]>([]);

  readonly modalState = signal<'CLOSED' | 'CREATE' | 'EDIT' | 'DELETE'>('CLOSED');
  readonly isWorking = signal(false);

  readonly activeCategory = signal<CategoryDto | null>(null);
  draftName = '';

  ngOnInit(): void {
    this.loadCategories();
  }

  productCount(cat: CategoryDto): number {
    return cat._count?.products ?? 0;
  }

  loadCategories(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getCategories().subscribe({
      next: (data) => {
        this.categories.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load categories');
        this.loading.set(false);
        this.toast.show('Failed to load categories', 'error');
      },
    });
  }

  openModal(state: 'CREATE' | 'EDIT' | 'DELETE', cat?: CategoryDto): void {
    this.modalState.set(state);
    this.activeCategory.set(cat ?? null);
    this.draftName = cat ? cat.name : '';

    if (state !== 'DELETE') {
      setTimeout(() => this.modalInput?.nativeElement?.focus(), 50);
    }
  }

  closeModal(): void {
    if (this.isWorking()) return;
    this.modalState.set('CLOSED');
    this.activeCategory.set(null);
    this.draftName = '';
  }

  submitModal(): void {
    if (this.isWorking()) return;

    const state = this.modalState();
    if (state === 'CREATE') this.executeCreate();
    else if (state === 'EDIT') this.executeEdit();
    else if (state === 'DELETE') this.executeDelete();
  }

  private executeCreate(): void {
    const name = this.draftName.trim();
    if (!name) return;

    this.isWorking.set(true);
    this.api.createCategory(name).subscribe({
      next: (newCat) => {
        const withCount: CategoryDto = {
          ...newCat,
          _count: newCat._count ?? { products: 0 },
        };
        this.categories.update((list) =>
          [withCount, ...list.filter((c) => c.id !== withCount.id)].sort((a, b) => a.name.localeCompare(b.name))
        );
        this.toast.show('Category created', 'success');
        this.isWorking.set(false);
        this.closeModal();
      },
      error: (e: Error) => {
        this.toast.show(e.message || 'Failed to create', 'error');
        this.isWorking.set(false);
      },
    });
  }

  private executeEdit(): void {
    const cat = this.activeCategory();
    const name = this.draftName.trim();
    if (!cat || !name) return;

    this.isWorking.set(true);
    this.api.updateCategory(cat.id, name).subscribe({
      next: (updated) => {
        this.categories.update((list) =>
          list.map((c) => (c.id === cat.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
        );
        this.toast.show('Category renamed', 'success');
        this.isWorking.set(false);
        this.closeModal();
      },
      error: (e: Error) => {
        this.toast.show(e.message || 'Failed to rename', 'error');
        this.isWorking.set(false);
      },
    });
  }

  private executeDelete(): void {
    const cat = this.activeCategory();
    if (!cat || this.productCount(cat) > 0) return;

    this.isWorking.set(true);
    this.api.deleteCategory(cat.id).subscribe({
      next: () => {
        this.categories.update((list) => list.filter((c) => c.id !== cat.id));
        this.toast.show('Category deleted', 'success');
        this.isWorking.set(false);
        this.closeModal();
      },
      error: (e: Error) => {
        this.toast.show(e.message || 'Failed to delete', 'error');
        this.isWorking.set(false);
      },
    });
  }
}
