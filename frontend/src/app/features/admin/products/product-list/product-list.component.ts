import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyVndPipe } from '../../../../shared/pipes/currency-vnd.pipe';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ProductApiService } from '../../../../core/services/product-api.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { Product, ProductStatus } from '../../../../shared/models/product.model';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-admin-product-list',
  standalone: true,
  imports: [RouterLink, FormsModule, CurrencyVndPipe, ConfirmDialogComponent, PaginationComponent],
  template: `
    <div class="mx-auto max-w-6xl">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Products</h1>
          <p class="mt-1 text-sm text-gray-600">Create, edit, and delete products (no login required in this dev setup).</p>
        </div>
        <a
          routerLink="/admin/products/new"
          class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add product
        </a>
      </div>

      <div class="mt-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div class="flex-1">
          <label class="block text-xs font-medium text-gray-600">Search</label>
          <input
            type="search"
            [(ngModel)]="searchInput"
            (ngModelChange)="searchInput = $event"
            (keyup.enter)="applyFilters()"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Product name..."
          />
        </div>
        <div class="w-full sm:w-44">
          <label class="block text-xs font-medium text-gray-600">Status</label>
          <select
            [(ngModel)]="statusFilter"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option [ngValue]="''">All</option>
            <option value="AVAILABLE">On sale</option>
            <option value="UNAVAILABLE">Hidden</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
        <button
          type="button"
          (click)="applyFilters()"
          class="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
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
                <th class="px-4 py-3 font-medium text-gray-700">Name</th>
                <th class="px-4 py-3 font-medium text-gray-700">Category</th>
                <th class="px-4 py-3 font-medium text-gray-700">Price</th>
                <th class="px-4 py-3 font-medium text-gray-700">Stock</th>
                <th class="px-4 py-3 font-medium text-gray-700">Status</th>
                <th class="px-4 py-3 font-medium text-gray-700"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (p of products(); track p.id) {
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 text-gray-600">{{ p.id }}</td>
                  <td class="px-4 py-3 font-medium text-gray-900">{{ p.name }}</td>
                  <td class="px-4 py-3 text-gray-600">{{ p.category?.name ?? '—' }}</td>
                  <td class="px-4 py-3">{{ p.price | currencyVnd }}</td>
                  <td class="px-4 py-3">{{ p.stock }}</td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                      [class.bg-green-100]="p.status === 'AVAILABLE'"
                      [class.text-green-800]="p.status === 'AVAILABLE'"
                      [class.bg-amber-100]="p.status === 'DRAFT'"
                      [class.text-amber-800]="p.status === 'DRAFT'"
                      [class.bg-gray-200]="p.status === 'UNAVAILABLE'"
                      [class.text-gray-800]="p.status === 'UNAVAILABLE'"
                    >
                      {{ statusLabel(p.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    <a
                      [routerLink]="['/admin/products', p.id]"
                      class="text-blue-600 hover:underline"
                    >
                      Edit
                    </a>
                    <button
                      type="button"
                      class="ml-3 text-red-600 hover:underline"
                      (click)="openDelete(p)"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                    No products yet. Add categories in the database and create a product.
                  </td>
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

      <app-confirm-dialog
        [open]="confirmOpen()"
        title="Delete product?"
        [message]="confirmMessage()"
        (confirm)="confirmDelete()"
        (cancel)="closeConfirm()"
      />
    </div>
  `,
})
export class AdminProductListComponent implements OnInit {
  private readonly api = inject(ProductApiService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly products = signal<Product[]>([]);
  readonly meta = signal<{ page: number; totalPages: number } | null>(null);

  readonly confirmOpen = signal(false);
  readonly confirmMessage = signal('');
  private pendingDelete: Product | null = null;

  searchInput = '';
  statusFilter: '' | ProductStatus = '';
  private appliedSearch = '';
  private appliedStatus: ProductStatus | undefined;

  page = 1;
  readonly limit = 12;

  ngOnInit(): void {
    this.load();
  }

  statusLabel(s: ProductStatus): string {
    switch (s) {
      case 'AVAILABLE':
        return 'On sale';
      case 'UNAVAILABLE':
        return 'Hidden';
      case 'DRAFT':
        return 'Draft';
      default:
        return s;
    }
  }

  applyFilters(): void {
    this.appliedSearch = this.searchInput.trim();
    this.appliedStatus = this.statusFilter || undefined;
    this.page = 1;
    this.load();
  }

  onPage(p: number): void {
    this.page = p;
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list({
        page: this.page,
        limit: this.limit,
        search: this.appliedSearch || undefined,
        status: this.appliedStatus,
        sort: 'newest',
      })
      .subscribe({
        next: (res) => {
          this.products.set(res.data);
          this.meta.set({
            page: res.meta.page,
            totalPages: res.meta.totalPages,
          });
          this.loading.set(false);
        },
        error: (e: Error) => {
          this.error.set(e.message || 'Could not load the list.');
          this.loading.set(false);
        },
      });
  }

  openDelete(p: Product): void {
    this.pendingDelete = p;
    this.confirmMessage.set(`Delete “${p.name}”? This cannot be undone.`);
    this.confirmOpen.set(true);
  }

  closeConfirm(): void {
    this.confirmOpen.set(false);
    this.pendingDelete = null;
  }

  confirmDelete(): void {
    const p = this.pendingDelete;
    if (!p) return;
    this.api.delete(p.id).subscribe({
      next: () => {
        this.toast.show('Product deleted.', 'success');
        this.closeConfirm();
        this.load();
      },
      error: (e: Error) => {
        this.toast.show(e.message || 'Delete failed.', 'error');
        this.closeConfirm();
      },
    });
  }
}
