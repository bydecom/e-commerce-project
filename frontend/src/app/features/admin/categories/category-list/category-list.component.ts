import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductApiService, type CategoryDto } from '../../../../core/services/product-api.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-admin-category-list',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-4xl">
      <h1 class="text-2xl font-bold text-gray-900">Categories</h1>
      <p class="mt-1 text-sm text-gray-600">Manage product categories.</p>

      <div
        class="mt-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700">New Category Name</label>
          <input
            type="text"
            [(ngModel)]="newCategoryName"
            (keyup.enter)="createCategory()"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. Electronics, Clothing..."
            [disabled]="saving()"
          />
        </div>
        <button
          type="button"
          (click)="createCategory()"
          [disabled]="saving() || !newCategoryName.trim()"
          class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {{ saving() ? 'Saving...' : '+ Add Category' }}
        </button>
      </div>

      <div class="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 font-medium text-gray-700">Category Name</th>
              <th class="w-32 px-4 py-3 text-center font-medium text-gray-700">Products</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            @for (cat of categories(); track cat.id) {
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-900">{{ cat.name }}</td>
                <td class="px-4 py-3 text-center">
                  <span class="inline-flex items-center justify-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    {{ cat._count?.products ?? 0 }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="2" class="px-4 py-8 text-center text-gray-500">No categories found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminCategoryListComponent implements OnInit {
  private readonly api = inject(ProductApiService);
  private readonly toast = inject(ToastService);

  readonly categories = signal<CategoryDto[]>([]);
  readonly saving = signal(false);
  newCategoryName = '';

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.api.getCategories().subscribe({
      next: (data) => this.categories.set(data),
      error: () => this.toast.show('Failed to load categories', 'error'),
    });
  }

  createCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) return;

    this.saving.set(true);
    this.api.createCategory(name).subscribe({
      next: () => {
        this.toast.show('Category created successfully', 'success');
        this.newCategoryName = '';
        this.saving.set(false);
        this.loadCategories();
      },
      error: (e: Error) => {
        this.toast.show(e.message || 'Failed to create category', 'error');
        this.saving.set(false);
      },
    });
  }
}
