import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { StoreSettingService } from '../../../core/services/store-setting.service';
import { ToastService } from '../../../core/services/toast.service';

function stripUrlSchemeForForm(url: string | null | undefined): string {
  if (!url) return '';
  return url.trim().replace(/^https:\/\//i, '').replace(/^http:\/\//i, '');
}

function optionalEmailValidator(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '').trim();
  if (!v) return null;
  return Validators.email(control);
}

function optionalLogoUrlValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) return null;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(normalized);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { url: true };
    return null;
  } catch {
    return { url: true };
  }
}

function normalizeLogoUrlForSave(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return 'https://' + t;
}

@Component({
  selector: 'app-admin-shop-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="mx-auto w-full max-w-6xl pb-12">
      <div class="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">Store Settings</h1>
        </div>
        @if (!loadError()) {
          <div class="flex items-center gap-3">
            <button
              type="button"
              (click)="resetForm()"
              [disabled]="saving()"
              class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              (click)="save()"
              [disabled]="form.invalid || saving()"
              class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {{ saving() ? 'Saving...' : 'Save Settings' }}
            </button>
          </div>
        }
      </div>

      @if (loadError()) {
        <div class="rounded-md bg-red-50 p-4">
          <p class="text-sm font-medium text-red-800">{{ loadError() }}</p>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="divide-y divide-gray-100">
          <div class="grid grid-cols-1 gap-x-8 gap-y-8 py-5 md:grid-cols-3">
            <div class="px-4 sm:px-0">
              <h2 class="text-base font-semibold leading-7 text-gray-900">Brand Identity</h2>
              <p class="mt-1 text-sm leading-6 text-gray-500">
                This information will be displayed publicly on your storefront header and customer emails.
              </p>
            </div>

            <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
              <div class="px-4 py-6 sm:p-8">
                <div class="mb-8 flex items-center gap-x-6">
                  @if (logoPreviewSrc()) {
                    <img
                      [src]="logoPreviewSrc()!"
                      alt="Store logo"
                      class="h-16 w-16 rounded-lg object-cover shadow-sm ring-1 ring-gray-900/10"
                    />
                  } @else {
                    <div
                      class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-gray-900/10"
                    >
                      <svg class="h-8 w-8 text-gray-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path
                          fill-rule="evenodd"
                          d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </div>
                  }
                  <div class="flex-1">
                    <label class="block text-sm font-medium leading-6 text-gray-900">Logo URL</label>
                    <div class="mt-2 flex rounded-md shadow-sm">
                      <span
                        class="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm"
                      >
                        https://
                      </span>
                      <input
                        type="text"
                        formControlName="logoUrl"
                        class="block w-full min-w-0 flex-1 rounded-none rounded-r-md border-0 px-3 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        placeholder="example.com/logo.png"
                      />
                    </div>
                  </div>
                </div>

                <div class="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
                  <div class="col-span-full">
                    <label class="block text-sm font-medium leading-6 text-gray-900">
                      Store name <span class="text-red-500">*</span>
                    </label>
                    <div class="mt-2">
                      <input
                        type="text"
                        formControlName="name"
                        class="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div class="col-span-full">
                    <label class="block text-sm font-medium leading-6 text-gray-900">Short description</label>
                    <div class="mt-2">
                      <textarea
                        formControlName="description"
                        rows="3"
                        class="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        placeholder="Your premium destination for cutting-edge technology..."
                      ></textarea>
                    </div>
                    <p class="mt-3 text-sm leading-6 text-gray-500">
                      Write a few sentences about your shop for SEO purposes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-x-8 gap-y-8 py-5 md:grid-cols-3">
            <div class="px-4 sm:px-0">
              <h2 class="text-base font-semibold leading-7 text-gray-900">Contact Information</h2>
              <p class="mt-1 text-sm leading-6 text-gray-500">
                Use a permanent address where you can receive mail and customer returns.
              </p>
            </div>

            <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
              <div class="px-4 py-6 sm:p-8">
                <div class="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
                  <div class="sm:col-span-3">
                    <label class="block text-sm font-medium leading-6 text-gray-900">Support Email</label>
                    <div class="mt-2">
                      <input
                        type="email"
                        formControlName="email"
                        class="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div class="sm:col-span-3">
                    <label class="block text-sm font-medium leading-6 text-gray-900">Phone number</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        formControlName="phone"
                        class="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      />
                    </div>
                  </div>

                  <div class="col-span-full">
                    <label class="block text-sm font-medium leading-6 text-gray-900">Physical Address</label>
                    <div class="mt-2">
                      <textarea
                        formControlName="address"
                        rows="2"
                        class="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      }
    </div>
  `,
})
export class AdminShopSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(StoreSettingService);
  private readonly toast = inject(ToastService);

  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    logoUrl: ['', [optionalLogoUrlValidator]],
    email: ['', [optionalEmailValidator]],
    phone: [''],
    address: [''],
  });

  ngOnInit(): void {
    this.reloadFromStore();
  }

  /** Absolute URL for logo preview (prefix https:// + field value when needed). */
  logoPreviewSrc(): string | null {
    const raw = this.form.get('logoUrl')?.value?.trim() ?? '';
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return 'https://' + raw;
  }

  resetForm(): void {
    if (this.saving()) return;
    this.reloadFromStore();
  }

  private reloadFromStore(): void {
    this.store.refresh().subscribe({
      next: (s) => {
        this.loadError.set(null);
        this.form.patchValue({
          name: s.name,
          description: s.description ?? '',
          logoUrl: stripUrlSchemeForForm(s.logoUrl),
          email: s.email ?? '',
          phone: s.phone ?? '',
          address: s.address ?? '',
        });
      },
      error: (e: Error) => this.loadError.set(e.message ?? 'Could not load store settings'),
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.store
      .update({
        name: v.name,
        description: v.description || null,
        logoUrl: normalizeLogoUrlForSave(v.logoUrl),
        email: v.email || null,
        phone: v.phone || null,
        address: v.address || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.show('Store settings saved.', 'success');
        },
        error: (e: Error) => {
          this.saving.set(false);
          this.toast.show(e.message || 'Could not save settings', 'error');
        },
      });
  }
}
