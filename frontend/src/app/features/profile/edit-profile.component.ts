import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UserApiService } from '../../core/services/user-api.service';
import type { User } from '../../shared/models/user.model';

interface LocationItem {
  id: string;
  full_name: string;
}

interface EsgooResponse {
  error: number;
  data: LocationItem[];
}

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div class="mb-8 border-b border-gray-200 pb-5">
        <a
          routerLink="/profile"
          class="mb-2 inline-flex items-center text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          <svg class="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Profile
        </a>
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold tracking-tight text-gray-900">Edit Profile</h1>
          <div class="flex gap-3">
            <button
              type="button"
              (click)="resetForm()"
              [disabled]="loading() || saving()"
              class="rounded-sm border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
            >
              Discard Changes
            </button>
            <button
              type="button"
              (click)="save()"
              [disabled]="loading() || saving()"
              class="rounded-sm bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50"
            >
              {{ saving() ? 'Saving...' : 'Save Profile' }}
            </button>
          </div>
        </div>
      </div>

      @if (loadError()) {
        <div class="mb-6 rounded-sm border-l-4 border-red-500 bg-red-50 p-4 text-red-800 shadow-sm">
          <p class="font-medium">{{ loadError() }}</p>
        </div>
      }

      @if (loading()) {
        <div class="flex justify-center py-12">
          <div
            class="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900"
            aria-hidden="true"
          ></div>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="space-y-6">

          <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
              <h2 class="font-bold text-gray-900">Basic Information</h2>
            </div>
            <div class="px-6 py-5">
              <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div class="sm:col-span-2">
                  <label class="block text-sm font-medium text-gray-700">
                    Email Address <span class="font-normal text-gray-400">(Non-editable)</span>
                  </label>
                  <input
                    type="email"
                    [value]="me()?.email ?? ''"
                    disabled
                    class="mt-1 block w-full cursor-not-allowed rounded-sm border-0 bg-gray-100 px-3 py-2 text-gray-500 shadow-inner ring-1 ring-inset ring-gray-200 sm:text-sm"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    formControlName="name"
                    class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                    placeholder="E.g. Nguyen Van A"
                  />
                  @if (form.controls.name.touched && form.controls.name.errors?.['maxlength']) {
                    <p class="mt-1 text-xs text-red-600">Name cannot exceed 100 characters.</p>
                  }
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Phone Number</label>
                  <input
                    type="text"
                    formControlName="phone"
                    class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                    placeholder="+84 123 456 789"
                  />
                  @if (form.controls.phone.touched && form.controls.phone.errors?.['maxlength']) {
                    <p class="mt-1 text-xs text-red-600">Phone number cannot exceed 30 characters.</p>
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
              <h2 class="font-bold text-gray-900">Delivery Details</h2>
            </div>
            <div class="px-6 py-5 space-y-5">

              <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Province / City <span class="text-red-500">*</span>
                  </label>
                  <select
                    formControlName="province"
                    class="mt-1 block w-full rounded-sm border-0 bg-white px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                    [class.ring-red-300]="form.controls.province.invalid && form.controls.province.touched"
                  >
                    <option value="" disabled>Select Province</option>
                    @for (p of provinces(); track p.id) {
                      <option [value]="p.id">{{ p.full_name }}</option>
                    }
                  </select>
                  @if (form.controls.province.touched && form.controls.province.errors?.['required']) {
                    <p class="mt-1 text-xs text-red-600">Province is required.</p>
                  }
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    District / Ward <span class="text-red-500">*</span>
                  </label>
                  <select
                    formControlName="ward"
                    class="mt-1 block w-full rounded-sm border-0 bg-white px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 sm:text-sm"
                    [class.ring-red-300]="form.controls.ward.invalid && form.controls.ward.touched"
                  >
                    <option value="" disabled>Select District/Ward</option>
                    @for (w of wards(); track w.id) {
                      <option [value]="w.id">{{ w.full_name }}</option>
                    }
                  </select>
                  @if (form.controls.ward.touched && form.controls.ward.errors?.['required']) {
                    <p class="mt-1 text-xs text-red-600">District/Ward is required.</p>
                  }
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">
                  Street Address <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  formControlName="street"
                  class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                  placeholder="E.g. 123 Le Loi Street"
                  [class.ring-red-300]="form.controls.street.invalid && form.controls.street.touched"
                />
                @if (form.controls.street.touched) {
                  @if (form.controls.street.errors?.['required']) {
                    <p class="mt-1 text-xs text-red-600">Street address is required.</p>
                  } @else if (form.controls.street.errors?.['maxlength']) {
                    <p class="mt-1 text-xs text-red-600">Street address cannot exceed 200 characters.</p>
                  }
                }
              </div>

              @if (form.controls.province.value || form.controls.street.value) {
                <div class="rounded-sm bg-gray-50 px-4 py-3 text-sm text-gray-700 ring-1 ring-inset ring-gray-200">
                  <span class="font-medium text-gray-500">Preview: </span>{{ buildPreview() }}
                </div>
              }

              <p class="text-xs text-gray-500">This address will be used as the default for future orders.</p>
            </div>
          </div>

        </form>
      }
    </div>
  `,
})
export class EditProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(UserApiService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly me = signal<User | null>(null);

  readonly provinces = signal<LocationItem[]>([]);
  readonly wards = signal<LocationItem[]>([]); // level-2: Phường/Xã theo Tỉnh đã chọn

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.maxLength(100)]],
    phone: ['', [Validators.maxLength(30)]],
    province: ['', [Validators.required]],
    ward: [{ value: '', disabled: true }, [Validators.required]],
    street: ['', [Validators.required, Validators.maxLength(200)]],
  });

  ngOnInit(): void {
    this.fetchProvinces();
    this.setupCascade();
    this.reload();
  }

  private setupCascade(): void {
    // Khi chọn Tỉnh → reset & load Phường/Xã
    this.form.controls.province.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.wards.set([]);
        this.form.controls.ward.setValue('', { emitEvent: false });
        this.form.controls.ward.disable({ emitEvent: false });
        if (id) {
          this.fetchWards(id);
          this.form.controls.ward.enable({ emitEvent: false });
        }
      });
  }

  private fetchProvinces(): void {
    this.http
      .get<EsgooResponse>('https://esgoo.net/api-tinhthanh-new/1/0.htm')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res.error === 0) this.provinces.set(res.data);
      });
  }

  private fetchWards(provinceId: string): void {
    this.http
      .get<EsgooResponse>(`https://esgoo.net/api-tinhthanh-new/2/${provinceId}.htm`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res.error === 0) this.wards.set(res.data);
      });
  }

  buildPreview(): string {
    const v = this.form.getRawValue();
    const parts: string[] = [];
    if (v.street.trim()) parts.push(v.street.trim());
    const wardName = this.wards().find((w) => w.id === v.ward)?.full_name;
    const provinceName = this.provinces().find((p) => p.id === v.province)?.full_name;
    if (wardName) parts.push(wardName);
    if (provinceName) parts.push(provinceName);
    return parts.join(', ');
  }

  resetForm(): void {
    if (this.loading() || this.saving()) return;
    this.wards.set([]);
    this.form.controls.ward.disable({ emitEvent: false });
    this.form.reset();
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getMe().subscribe({
      next: (me) => {
        this.me.set(me);
        // address cũ (free-form string) đưa vào ô street để tiện chỉnh sửa
        this.form.patchValue({
          name: me.name ?? '',
          phone: me.phone ?? '',
          province: '',
          ward: '',
          street: me.address ?? '',
        });
        this.loading.set(false);
      },
      error: (e: Error) => {
        this.loadError.set(e.message || 'Could not load profile');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();

    const fullAddress = this.buildPreview() || null;

    this.api
      .updateMe({
        name: v.name.trim() || null,
        phone: v.phone.trim() || null,
        address: fullAddress,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.me.set(updated);
          this.auth.updateCurrentUser(updated);
          this.toast.show('Profile updated successfully.', 'success');
          void this.router.navigate(['/profile']);
        },
        error: (e: Error) => {
          this.saving.set(false);
          this.toast.show(e.message || 'Could not update profile', 'error');
        },
      });
  }
}
