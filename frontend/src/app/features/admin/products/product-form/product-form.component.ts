import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, map, throwError } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ProductApiService } from '../../../../core/services/product-api.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { ApiSuccess } from '../../../../shared/models/api-response.model';
import type { ProductStatus } from '../../../../shared/models/product.model';

@Component({
  selector: 'app-admin-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="mx-auto w-full max-w-6xl pb-12">
      <div class="mb-8 flex items-center justify-between border-b border-gray-200 pb-5">
        <div>
          <a
            routerLink="/admin/products"
            class="mb-1 inline-block text-sm font-medium text-gray-500 hover:text-gray-700 hover:underline"
          >
            &larr; Back to products
          </a>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">
            {{ isNew() ? 'Add New Product' : 'Edit Product' }}
          </h1>
        </div>
        <div class="flex items-center gap-3">
          <a
            routerLink="/admin/products"
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Discard
          </a>
          <button
            type="button"
            (click)="submit()"
            [disabled]="form.invalid || saving()"
            class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {{ saving() ? 'Saving...' : 'Save Product' }}
          </button>
        </div>
      </div>

      @if (loadError()) {
        <div class="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{{ loadError() }}</div>
      } @else if (loading() && !isNew()) {
        <div class="flex justify-center py-12">
          <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" aria-hidden="true"></div>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <div class="flex flex-col gap-6 lg:col-span-2">
            <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                <h2 class="text-base font-semibold text-gray-900">Basic Information</h2>
              </div>
              <div class="space-y-6 p-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Product Name <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    formControlName="name"
                    class="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="Short sleeve t-shirt"
                  />
                  @if (form.controls.name.touched && form.controls.name.errors?.['required']) {
                    <p class="mt-1 text-xs text-red-600">Product name is required.</p>
                  }
                </div>

                <div>
                  <div class="mb-2 flex items-center justify-between">
                    <label class="block text-sm font-medium text-gray-700">Description</label>
                    <button
                      type="button"
                      (click)="enhanceDescription()"
                      [disabled]="enhancingDescription() || !form.controls.name.value?.trim()"
                      class="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                    >
                      @if (enhancingDescription()) {
                        <svg
                          class="h-3.5 w-3.5 animate-spin"
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
                        Enhancing...
                      } @else {
                        <svg
                          class="h-3.5 w-3.5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        Write with AI
                      }
                    </button>
                  </div>
                  <textarea
                    formControlName="description"
                    rows="5"
                    class="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    placeholder="Describe the product details, materials, and benefits..."
                  ></textarea>
                </div>
              </div>
            </div>

            <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                <h2 class="text-base font-semibold text-gray-900">Media</h2>
              </div>
              <div class="p-6">
                <label class="block text-sm font-medium text-gray-700">Image URL</label>
                <div class="mt-2 flex items-start gap-4">
                  <div
                    class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50"
                  >
                    @if (form.controls.imageUrl.value?.trim()) {
                      <img
                        [src]="form.controls.imageUrl.value!.trim()"
                        alt="Preview"
                        class="h-full w-full object-cover"
                      />
                    } @else {
                      <svg
                        class="h-8 w-8 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.5"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    }
                  </div>
                  <div class="flex-1">
                    <input
                      type="url"
                      formControlName="imageUrl"
                      class="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      placeholder="https://example.com/image.png"
                    />
                    <p class="mt-2 text-xs text-gray-500">Provide a direct link to the product image.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-6 lg:col-span-1">
            <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                <h2 class="text-base font-semibold text-gray-900">Pricing & Inventory</h2>
              </div>
              <div class="space-y-5 p-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Price (VND) <span class="text-red-500">*</span>
                  </label>
                  <div class="relative mt-2 rounded-md shadow-sm">
                    <input
                      type="number"
                      formControlName="price"
                      min="0"
                      step="1000"
                      class="block w-full rounded-md border-0 py-1.5 pl-3 pr-12 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    />
                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <span class="text-sm font-medium text-gray-500">VND</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Stock Quantity <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    formControlName="stock"
                    min="0"
                    step="1"
                    class="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            </div>

            <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                <h2 class="text-base font-semibold text-gray-900">Organization</h2>
              </div>
              <div class="space-y-5 p-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Category <span class="text-red-500">*</span>
                  </label>
                  <select
                    formControlName="categoryId"
                    class="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    <option [ngValue]="null" disabled>Select a category</option>
                    @for (c of categories(); track c.id) {
                      <option [ngValue]="c.id">{{ c.name }}</option>
                    }
                  </select>
                  @if (categories().length === 0) {
                    <p class="mt-2 text-xs text-amber-600">Please create categories in the Category menu first.</p>
                  }
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Display Status <span class="text-red-500">*</span>
                  </label>
                  <select
                    formControlName="status"
                    class="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    <option value="AVAILABLE">🟢 Available (On sale)</option>
                    <option value="DRAFT">⚪ Draft (Not for sale)</option>
                    <option value="UNAVAILABLE">🔴 Hidden / Discontinued</option>
                  </select>
                </div>
              </div>
            </div>
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
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  private readonly aiUrl = `${environment.apiUrl}/api/ai/enhance-product-description`;

  readonly isNew = signal(true);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly enhancingDescription = signal(false);
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

  enhanceDescription(): void {
    const name = this.form.controls.name.value?.trim();
    if (!name) {
      this.form.controls.name.markAsTouched();
      this.toast.show('Enter a product name first.', 'error');
      return;
    }
    const raw = this.form.controls.description.value ?? '';
    const description = raw.trim() === '' ? null : raw.trim();

    this.enhancingDescription.set(true);
    this.http
      .post<ApiSuccess<{ description: string }>>(this.aiUrl, { name, description })
      .pipe(
        map((r) => {
          if (!r.success || !r.data?.description) {
            throw new Error(r.message || 'Enhancement failed');
          }
          return r.data.description;
        }),
        catchError((err: HttpErrorResponse) =>
          throwError(() => new Error(err.error?.message ?? err.message ?? 'Request failed'))
        )
      )
      .subscribe({
        next: (text) => {
          this.form.patchValue({ description: text });
          this.enhancingDescription.set(false);
          this.toast.show('Description updated from AI.', 'success');
        },
        error: (e: Error) => {
          this.toast.show(e.message, 'error');
          this.enhancingDescription.set(false);
        },
      });
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
