import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { StoreSettingService } from '../../../core/services/store-setting.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-shop-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-bold text-gray-900">Store settings</h1>
      <p class="mt-1 text-sm text-gray-600">
        Store name, logo, and contact details shown in the storefront header and footer.
      </p>

      @if (loadError()) {
        <p class="mt-4 text-red-600">{{ loadError() }}</p>
      } @else {
        <form
          [formGroup]="form"
          (ngSubmit)="save()"
          class="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label class="block text-sm font-medium text-gray-700">Store name *</label>
            <input
              type="text"
              formControlName="name"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Short description</label>
            <textarea
              formControlName="description"
              rows="3"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            ></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Logo URL</label>
            <input
              type="url"
              formControlName="logoUrl"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              formControlName="email"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Phone</label>
            <input type="text" formControlName="phone" class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Address</label>
            <textarea
              formControlName="address"
              rows="2"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            ></textarea>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              [disabled]="form.invalid || saving()"
              class="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {{ saving() ? 'Saving…' : 'Save' }}
            </button>
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
    logoUrl: [''],
    email: [''],
    phone: [''],
    address: [''],
  });

  ngOnInit(): void {
    this.store.refresh().subscribe({
      next: (s) => {
        this.loadError.set(null);
        this.form.patchValue({
          name: s.name,
          description: s.description ?? '',
          logoUrl: s.logoUrl ?? '',
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
        logoUrl: v.logoUrl || null,
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
