import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UserApiService } from '../../core/services/user-api.service';
import { environment } from '../../../environments/environment';
import type { User } from '../../shared/models/user.model';
import type { ApiSuccess } from '../../shared/models/api-response.model';

interface LocationItem {
  code: number;
  name: string;
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
              class="rounded-sm bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" aria-hidden="true"></div>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="space-y-6">

          <!-- Basic Info -->
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
                    placeholder="E.g. Nguyen Van A"
                    class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                    [class.ring-red-300]="form.controls.name.invalid && form.controls.name.touched"
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
                    placeholder="+84 123 456 789"
                    class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                    [class.ring-red-300]="form.controls.phone.invalid && form.controls.phone.touched"
                  />
                  @if (form.controls.phone.touched && form.controls.phone.errors?.['maxlength']) {
                    <p class="mt-1 text-xs text-red-600">Phone number cannot exceed 30 characters.</p>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Delivery Details -->
          <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
              <h2 class="font-bold text-gray-900">Delivery Details</h2>
            </div>
            <div class="space-y-5 px-6 py-5">

              <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <!-- Province -->
                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Province / City <span class="text-red-500">*</span>
                  </label>
                  <select
                    formControlName="provinceId"
                    class="mt-1 block w-full rounded-sm border-0 bg-white px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 sm:text-sm"
                    [class.ring-red-300]="form.controls.provinceId.invalid && form.controls.provinceId.touched"
                  >
                    <option value="" disabled selected>Select Province</option>
                    @for (p of provinces(); track p.code) {
                      <option [value]="p.code">{{ p.name }}</option>
                    }
                  </select>
                  @if (form.controls.provinceId.touched && form.controls.provinceId.errors?.['required']) {
                    <p class="mt-1 text-xs text-red-600">Province is required.</p>
                  }
                </div>

                <!-- Ward -->
                <div>
                  <label class="block text-sm font-medium text-gray-700">
                    Ward / Commune <span class="text-red-500">*</span>
                  </label>
                  <select
                    formControlName="wardId"
                    class="mt-1 block w-full rounded-sm border-0 bg-white px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 sm:text-sm"
                    [class.ring-red-300]="form.controls.wardId.invalid && form.controls.wardId.touched"
                  >
                    <option value="" disabled selected>Select Ward</option>
                    @for (w of wards(); track w.code) {
                      <option [value]="w.code">{{ w.name }}</option>
                    }
                  </select>
                  @if (form.controls.wardId.touched && form.controls.wardId.errors?.['required']) {
                    <p class="mt-1 text-xs text-red-600">Ward is required.</p>
                  }
                </div>
              </div>

              <!-- Street -->
              <div>
                <label class="block text-sm font-medium text-gray-700">
                  Street Address <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  formControlName="streetAddress"
                  placeholder="E.g. 123 Le Loi Street"
                  class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                  [class.ring-red-300]="form.controls.streetAddress.invalid && form.controls.streetAddress.touched"
                />
                @if (form.controls.streetAddress.touched) {
                  @if (form.controls.streetAddress.errors?.['required']) {
                    <p class="mt-1 text-xs text-red-600">Street address is required.</p>
                  } @else if (form.controls.streetAddress.errors?.['maxlength']) {
                    <p class="mt-1 text-xs text-red-600">Street address cannot exceed 200 characters.</p>
                  }
                }
              </div>

              <!-- Preview -->
              @if (form.controls.provinceId.value || form.controls.streetAddress.value) {
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
  private readonly fb          = inject(FormBuilder);
  private readonly api         = inject(UserApiService);
  private readonly http        = inject(HttpClient);
  private readonly toast       = inject(ToastService);
  private readonly auth        = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly destroyRef  = inject(DestroyRef);

  private readonly locationApiUrl = `${environment.apiUrl}/api/locations`;

  readonly loading   = signal(true);
  readonly saving    = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly me        = signal<User | null>(null);

  readonly provinces = signal<LocationItem[]>([]);
  readonly wards     = signal<LocationItem[]>([]);

  readonly form = this.fb.nonNullable.group({
    name:          ['', [Validators.maxLength(100)]],
    phone:         ['', [Validators.maxLength(30)]],
    provinceId:    ['', [Validators.required]],
    wardId:        [{ value: '', disabled: true }, [Validators.required]],
    streetAddress: ['', [Validators.required, Validators.maxLength(200)]],
  });

  ngOnInit(): void {
    this.setupCascade();
    this.loadInitialData();
  }

  private setupCascade(): void {
    this.form.controls.provinceId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.wards.set([]);
        this.form.controls.wardId.setValue('', { emitEvent: false });
        this.form.controls.wardId.disable({ emitEvent: false });
        if (id) {
          this.http
            .get<ApiSuccess<LocationItem[]>>(`${this.locationApiUrl}/wards/${encodeURIComponent(id)}`)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((res) => {
              if (res.success) {
                this.wards.set(Array.isArray(res.data) ? res.data : []);
                // Chỉ enable sau khi đã có danh sách wards để tránh dropdown trống
                this.enableClean(this.form.controls.wardId);
              }
            });
        }
      });
  }

  private enableClean(control: AbstractControl): void {
    control.enable({ emitEvent: false });
    control.markAsUntouched();
    control.markAsPristine();
  }

  buildPreview(): string {
    const v = this.form.getRawValue();
    const parts: string[] = [];
    if (v.streetAddress.trim()) parts.push(v.streetAddress.trim());
    const wardName     = this.wards().find((w) => String(w.code) === v.wardId)?.name;
    const provinceName = this.provinces().find((p) => String(p.code) === v.provinceId)?.name;
    if (wardName) parts.push(wardName);
    if (provinceName) parts.push(provinceName);
    return parts.join(', ');
  }

  resetForm(): void {
    if (this.loading() || this.saving()) return;
    this.wards.set([]);
    this.form.controls.wardId.disable({ emitEvent: false });
    this.form.reset({}, { emitEvent: false });
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.loading.set(true);
    this.loadError.set(null);

    // Reset sạch trạng thái cascade trước khi patch để UI/validation không nhảy
    this.wards.set([]);
    this.form.controls.wardId.disable({ emitEvent: false });

    forkJoin({
      provincesRes: this.http.get<ApiSuccess<LocationItem[]>>(`${this.locationApiUrl}/provinces`),
      me: this.api.getMe(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ provincesRes, me }) => {
          if (provincesRes.success) {
            this.provinces.set(Array.isArray(provincesRes.data) ? provincesRes.data : []);
          }

          this.me.set(me);
          this.patchUserData(me);
        },
        error: (e: Error) => {
          this.loadError.set(e.message || 'Could not load profile');
          this.loading.set(false);
        },
      });
  }

  private patchUserData(me: User): void {
    // Backend có thể trả id dạng number; ép về string để match value trong <option>
    const provinceId    = me.provinceId != null ? String(me.provinceId) : '';
    const wardId        = me.wardId     != null ? String(me.wardId)     : '';
    const streetAddress = me.streetAddress ?? '';

    // Patch các field không phụ thuộc cascade trước
    this.form.patchValue(
      { name: me.name ?? '', phone: me.phone ?? '', streetAddress },
      { emitEvent: false }
    );

    if (!provinceId) {
      // Không có địa chỉ: chỉ patch province rỗng rồi xong
      this.form.patchValue({ provinceId: '' }, { emitEvent: false });
      this.form.markAsPristine();
      this.form.markAsUntouched();
      this.loading.set(false);
      return;
    }

    // Có province: patch province, fetch districts xong mới patch district
    this.form.patchValue({ provinceId }, { emitEvent: false });

    this.http
      .get<ApiSuccess<LocationItem[]>>(`${this.locationApiUrl}/wards/${encodeURIComponent(provinceId)}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.wards.set(Array.isArray(res.data) ? res.data : []);
            this.enableClean(this.form.controls.wardId);

            if (wardId) {
              this.form.patchValue({ wardId }, { emitEvent: false });
            }
          }

          this.form.markAsPristine();
          this.form.markAsUntouched();
          this.loading.set(false);
        },
        error: () => {
          this.form.markAsPristine();
          this.form.markAsUntouched();
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

    this.api
      .updateMe({
        name:          v.name.trim() || null,
        phone:         v.phone.trim() || null,
        provinceId:    v.provinceId    || null,
        districtId:    null,
        wardId:        v.wardId        || null,
        streetAddress: v.streetAddress.trim() || null,
        fullAddress:   this.buildPreview()     || null,
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
