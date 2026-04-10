import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductApiService } from '../../../../core/services/product-api.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { ProductStatus } from '../../../../shared/models/product.model';

@Component({
  selector: 'app-admin-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-xl">
      <div class="mb-6 flex items-center justify-between gap-4">
        <h1 class="text-2xl font-bold text-gray-900">
          {{ isNew() ? 'New product' : 'Edit product' }}
        </h1>
        <a routerLink="/admin/products" class="text-sm text-blue-600 hover:underline">← Back to list</a>
      </div>

      @if (loadError()) {
        <p class="text-red-600">{{ loadError() }}</p>
      } @else if (loading() && !isNew()) {
        <p class="text-gray-600">Loading...</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <label class="block text-sm font-medium text-gray-700">Name *</label>
            <input
              type="text"
              formControlName="name"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            @if (form.controls.name.touched && form.controls.name.errors?.['required']) {
              <p class="mt-1 text-xs text-red-600">Required</p>
            }
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              formControlName="description"
              rows="4"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            ></textarea>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-700">Price (VND) *</label>
              <input
                type="number"
                formControlName="price"
                min="0"
                step="1000"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Stock *</label>
              <input
                type="number"
                formControlName="stock"
                min="0"
                step="1"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Image (URL)</label>
            <input
              type="text"
              formControlName="imageUrl"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Category *</label>
            <select formControlName="categoryId" class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option [ngValue]="null">— Select —</option>
              @for (c of categories(); track c.id) {
                <option [ngValue]="c.id">{{ c.name }}</option>
              }
            </select>
            @if (categories().length === 0) {
              <p class="mt-1 text-xs text-amber-700">
                No categories yet. Add rows in the Category table (PostgreSQL) or run the seed script first.
              </p>
            }
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Display status *</label>
            <select formControlName="status" class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="DRAFT">Draft (not for sale)</option>
              <option value="AVAILABLE">On sale</option>
              <option value="UNAVAILABLE">Hidden / discontinued</option>
            </select>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="submit"
              [disabled]="form.invalid || saving()"
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {{ saving() ? 'Saving...' : 'Save' }}
            </button>
            <a
              routerLink="/admin/products"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </a>
          </div>
        </form>
      }
    </div>
  `,
})
export class AdminProductFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProductApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly isNew = signal(true);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly categories = signal<{ id: number; name: string }[]>([]);

  private productId: number | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    imageUrl: [''],
    categoryId: this.fb.control<number | null>(null, [Validators.required]),
    status: this.fb.nonNullable.control<ProductStatus>('DRAFT', [Validators.required]),
  });

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    this.isNew.set(raw === 'new');
    if (raw && raw !== 'new') {
      this.productId = parseInt(raw, 10);
      if (Number.isNaN(this.productId)) {
        this.loadError.set('Invalid product id.');
        return;
      }
    }

    this.api.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => this.categories.set([]),
    });

    if (!this.isNew() && this.productId !== null) {
      this.loading.set(true);
      this.api.getById(this.productId).subscribe({
        next: (p) => {
          this.form.patchValue({
            name: p.name,
            description: p.description ?? '',
            price: p.price,
            stock: p.stock,
            imageUrl: p.imageUrl ?? '',
            categoryId: p.categoryId,
            status: p.status,
          });
          this.loading.set(false);
        },
        error: (e: Error) => {
          this.loadError.set(e.message || 'Could not load product.');
          this.loading.set(false);
        },
      });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const categoryId = v.categoryId;
    if (categoryId === null) return;

    const imageUrl = v.imageUrl.trim() === '' ? null : v.imageUrl.trim();

    this.saving.set(true);

    if (this.isNew()) {
      this.api
        .create({
          name: v.name.trim(),
          description: v.description.trim() === '' ? null : v.description.trim(),
          price: v.price,
          stock: v.stock,
          imageUrl,
          categoryId,
          status: v.status,
        })
        .subscribe({
          next: () => {
            this.toast.show('Product created.', 'success');
            void this.router.navigate(['/admin/products']);
          },
          error: (e: Error) => {
            this.toast.show(e.message || 'Save failed.', 'error');
            this.saving.set(false);
          },
        });
    } else if (this.productId !== null) {
      this.api
        .update(this.productId, {
          name: v.name.trim(),
          description: v.description.trim() === '' ? null : v.description.trim(),
          price: v.price,
          stock: v.stock,
          imageUrl,
          categoryId,
          status: v.status,
        })
        .subscribe({
          next: () => {
            this.toast.show('Product updated.', 'success');
            void this.router.navigate(['/admin/products']);
          },
          error: (e: Error) => {
            this.toast.show(e.message || 'Save failed.', 'error');
            this.saving.set(false);
          },
        });
    }
  }
}
