import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { ToastService } from '../../core/services/toast.service';
import { UserApiService } from '../../core/services/user-api.service';
import { environment } from '../../../environments/environment';
import { CurrencyVndPipe } from '../../shared/pipes/currency-vnd.pipe';
import type { ApiSuccess } from '../../shared/models/api-response.model';
import type { User } from '../../shared/models/user.model';

interface LocationItem {
  code: number;
  name: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyVndPipe, ReactiveFormsModule],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      @if (loadError()) {
        <div class="rounded-sm border-l-4 border-red-500 bg-red-50 p-4 text-red-800 shadow-sm">
          <p class="font-medium">{{ loadError() }}</p>
        </div>
      } @else if (loading()) {
        <div class="flex animate-pulse gap-8">
          <div class="hidden w-64 flex-shrink-0 flex-col gap-4 lg:flex">
            <div class="h-10 w-full bg-gray-100"></div>
            <div class="h-10 w-full bg-gray-100"></div>
          </div>
          <div class="flex-1 space-y-6">
            <div class="h-40 w-full bg-gray-100"></div>
            <div class="h-40 w-full bg-gray-100"></div>
          </div>
        </div>
      } @else {
        <div class="flex flex-col gap-8 lg:flex-row">
          <aside class="w-full lg:w-64 lg:flex-shrink-0">
            <nav class="flex flex-col space-y-1">
              <a class="flex items-center rounded-sm bg-gray-900 px-3 py-2.5 text-sm font-medium text-white">
                <svg
                  class="mr-3 h-5 w-5 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                General Profile
              </a>
              <a
                routerLink="/orders"
                class="flex items-center rounded-sm px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <svg class="mr-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                Order History
              </a>
              <a
                routerLink="/profile/change-password"
                class="flex items-center rounded-sm px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <svg class="mr-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Change Password
              </a>
            </nav>
          </aside>

          <main class="flex-1 space-y-8">
            <div class="flex items-center gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div
                class="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-sm bg-gray-900 text-2xl font-bold text-white shadow-inner"
              >
                {{ (me()?.name?.trim() || me()?.email || '?').slice(0, 1).toUpperCase() }}
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-3">
                  <h2 class="text-xl font-bold text-gray-900">{{ me()?.name || 'BanDai Member' }}</h2>
                  @if (me()?.role === 'ADMIN') {
                    <span
                      class="rounded-sm bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200"
                      >ADMIN</span
                    >
                  }
                </div>
                <p class="text-sm text-gray-500">{{ me()?.email }}</p>
                <p class="mt-1 text-xs text-gray-400">Joined on {{ me()?.createdAt | date: 'mediumDate' }}</p>
              </div>
              <div>
                <button
                  type="button"
                  (click)="openEditModal()"
                  class="rounded-sm border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  Edit Profile
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300">
                <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Total Orders</p>
                <div class="mt-2 flex items-baseline gap-2">
                  <span class="text-3xl font-black text-gray-900">{{ stats().totalOrders }}</span>
                  @if (stats().processing > 0) {
                    <span class="text-sm font-medium text-amber-600">({{ stats().processing }} pending)</span>
                  }
                </div>
              </div>
              <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300">
                <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Lifetime Spent</p>
                <p class="mt-2 text-3xl font-black text-gray-900">{{ stats().totalSpent | currencyVnd }}</p>
              </div>
            </div>

            <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                <h3 class="font-bold text-gray-900">Contact Details</h3>
              </div>
              <div class="px-6 py-5">
                <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt class="text-xs font-medium text-gray-500">Phone Number</dt>
                    <dd class="mt-1 text-sm font-semibold text-gray-900">{{ me()?.phone || 'Not provided' }}</dd>
                  </div>
                  <div class="sm:col-span-2">
                    <dt class="text-xs font-medium text-gray-500">Default Shipping Address</dt>
                    <dd class="mt-1 text-sm font-semibold leading-relaxed text-gray-900">
                      {{ me()?.fullAddress || me()?.streetAddress || 'No address saved. Add one to speed up checkout.' }}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </main>
        </div>
      }

      @if (isEditModalOpen()) {
        <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div class="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
            <div
              class="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity backdrop-blur-sm"
              (click)="closeEditModal()"
            ></div>

            <div
              class="relative w-full max-w-4xl transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8"
            >
              <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
                <h3 class="text-xl font-bold text-gray-900" id="modal-title">Edit Profile</h3>
                <button
                  type="button"
                  (click)="closeEditModal()"
                  class="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <span class="sr-only">Close</span>
                  <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form [formGroup]="form" (ngSubmit)="saveProfile()">
                <div class="px-6 py-6 sm:p-8">
                  @if (profileSaveError()) {
                    <div class="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      {{ profileSaveError() }}
                    </div>
                  }
                  <div class="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
                    <div class="space-y-5">
                      <h4 class="border-b border-gray-100 pb-2 font-bold text-gray-900">Basic Information</h4>
                      <div>
                        <label class="block text-sm font-medium text-gray-700"
                          >Email Address <span class="font-normal text-gray-400">(Read-only)</span></label
                        >
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
                          class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
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
                          class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                          [class.ring-red-300]="form.controls.phone.invalid && form.controls.phone.touched"
                        />
                        @if (form.controls.phone.touched && form.controls.phone.errors?.['maxlength']) {
                          <p class="mt-1 text-xs text-red-600">Phone number cannot exceed 30 characters.</p>
                        }
                      </div>
                    </div>

                    <div class="space-y-5">
                      <h4 class="border-b border-gray-100 pb-2 font-bold text-gray-900">Delivery Details</h4>
                      <div class="grid grid-cols-2 gap-4">
                        <div class="col-span-2 sm:col-span-1">
                          <label class="block text-sm font-medium text-gray-700"
                            >Province / City <span class="text-red-500">*</span></label
                          >
                          <select
                            formControlName="provinceId"
                            class="mt-1 block w-full rounded-sm border-0 bg-white px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                            [class.ring-red-300]="form.controls.provinceId.invalid && form.controls.provinceId.touched"
                          >
                            <option value="" disabled selected>Select Province</option>
                            @for (p of provinces(); track p.code) {
                              <option [value]="p.code">{{ p.name }}</option>
                            }
                          </select>
                        </div>
                        <div class="col-span-2 sm:col-span-1">
                          <label class="block text-sm font-medium text-gray-700"
                            >Ward / Commune <span class="text-red-500">*</span></label
                          >
                          <select
                            formControlName="wardId"
                            class="mt-1 block w-full rounded-sm border-0 bg-white px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 disabled:bg-gray-100 sm:text-sm"
                            [class.ring-red-300]="form.controls.wardId.invalid && form.controls.wardId.touched"
                          >
                            <option value="" disabled selected>Select Ward</option>
                            @for (w of wards(); track w.code) {
                              <option [value]="w.code">{{ w.name }}</option>
                            }
                          </select>
                        </div>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700"
                          >Street Address <span class="text-red-500">*</span></label
                        >
                        <input
                          type="text"
                          formControlName="streetAddress"
                          placeholder="123 Le Loi Street"
                          class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                          [class.ring-red-300]="form.controls.streetAddress.invalid && form.controls.streetAddress.touched"
                        />
                      </div>

                      @if (form.controls.provinceId.value || form.controls.streetAddress.value) {
                        <div class="rounded-sm bg-blue-50 px-4 py-3 text-sm text-blue-800 ring-1 ring-inset ring-blue-200">
                          <span class="font-semibold">Preview: </span>{{ buildPreview() }}
                        </div>
                      }
                    </div>
                  </div>
                </div>

                <div class="flex flex-row-reverse gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                  <button
                    type="submit"
                    [disabled]="savingProfile()"
                    class="rounded-sm bg-gray-900 px-6 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50"
                  >
                    {{ savingProfile() ? 'Saving...' : 'Save Changes' }}
                  </button>
                  <button
                    type="button"
                    (click)="closeEditModal()"
                    [disabled]="savingProfile()"
                    class="rounded-sm border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userApi = inject(UserApiService);
  private readonly orderApi = inject(OrderApiService);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly locationApiUrl = `${environment.apiUrl}/api/locations`;

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly me = signal<User | null>(null);
  readonly stats = signal({ totalOrders: 0, totalSpent: 0, processing: 0 });

  readonly isEditModalOpen = signal(false);
  readonly savingProfile = signal(false);
  readonly profileSaveError = signal('');
  readonly provinces = signal<LocationItem[]>([]);
  readonly wards = signal<LocationItem[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.maxLength(100)]],
    phone: ['', [Validators.maxLength(30)]],
    provinceId: ['', [Validators.required]],
    wardId: [{ value: '', disabled: true }, [Validators.required]],
    streetAddress: ['', [Validators.required, Validators.maxLength(200)]],
  });

  ngOnInit(): void {
    const snap = this.auth.currentUser();
    if (snap) {
      this.me.set(snap);
    }
    this.setupCascade();
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      me: this.userApi.getMe(),
      orders: this.orderApi.getMyOrders(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: ({ me, orders }) => {
        this.me.set(me);

        const doneOrders = orders.filter((o) => o.status === 'DONE');
        const processingOrders = orders.filter((o) => o.status !== 'DONE' && o.status !== 'CANCELLED');
        const totalSpent = doneOrders.reduce((sum, o) => sum + o.total, 0);

        this.stats.set({
          totalOrders: orders.length,
          totalSpent,
          processing: processingOrders.length,
        });

        this.loading.set(false);
      },
      error: (e: Error) => {
        this.loadError.set(e.message || 'Unable to load combined data');
        this.loading.set(false);
      },
    });
  }

  private setupCascade(): void {
    this.form.controls.provinceId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.wards.set([]);
        this.form.controls.wardId.setValue('', { emitEvent: false });
        this.form.controls.wardId.disable({ emitEvent: false });

        if (!id) return;

        this.http
          .get<ApiSuccess<LocationItem[]>>(
            `${this.locationApiUrl}/wards/${encodeURIComponent(String(id))}`
          )
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (res) => {
              if (res.success) {
                this.wards.set(Array.isArray(res.data) ? res.data : []);
                this.enableClean(this.form.controls.wardId);
              }
            },
            error: () => {
              // ignore: keep ward disabled
            },
          });
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
    const wardName = this.wards().find((w) => String(w.code) === v.wardId)?.name;
    const provinceName = this.provinces().find((p) => String(p.code) === v.provinceId)?.name;
    if (wardName) parts.push(wardName);
    if (provinceName) parts.push(provinceName);
    return parts.join(', ');
  }

  openEditModal(): void {
    const currentUser = this.me();
    if (!currentUser) return;

    this.profileSaveError.set('');
    this.isEditModalOpen.set(true);
    this.form.reset({}, { emitEvent: false });
    this.wards.set([]);
    this.form.controls.wardId.disable({ emitEvent: false });

    if (this.provinces().length === 0) {
      this.http
        .get<ApiSuccess<LocationItem[]>>(`${this.locationApiUrl}/provinces`)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            if (res.success) this.provinces.set(Array.isArray(res.data) ? res.data : []);
          },
          error: () => {
            // ignore
          },
        });
    }

    const provinceId = currentUser.provinceId != null ? String(currentUser.provinceId) : '';
    const wardId = currentUser.wardId != null ? String(currentUser.wardId) : '';
    const streetAddress = currentUser.streetAddress ?? '';

    this.form.patchValue(
      {
        name: currentUser.name ?? '',
        phone: currentUser.phone ?? '',
        streetAddress,
      },
      { emitEvent: false }
    );

    if (!provinceId) return;

    this.form.patchValue({ provinceId }, { emitEvent: false });
    this.http
      .get<ApiSuccess<LocationItem[]>>(
        `${this.locationApiUrl}/wards/${encodeURIComponent(String(provinceId))}`
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.wards.set(Array.isArray(res.data) ? res.data : []);
            this.enableClean(this.form.controls.wardId);
            if (wardId) this.form.patchValue({ wardId }, { emitEvent: false });
          }
        },
        error: () => {
          // ignore
        },
      });
  }

  closeEditModal(): void {
    if (this.savingProfile()) return;
    this.profileSaveError.set('');
    this.isEditModalOpen.set(false);
  }

  saveProfile(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.profileSaveError.set('');
    this.savingProfile.set(true);
    const v = this.form.getRawValue();

    this.userApi
      .updateMe({
        name: v.name.trim() || null,
        phone: v.phone.trim() || null,
        provinceId: v.provinceId || null,
        districtId: null,
        wardId: v.wardId || null,
        streetAddress: v.streetAddress.trim() || null,
        fullAddress: this.buildPreview() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedUser) => {
          this.savingProfile.set(false);
          this.me.set(updatedUser);
          this.auth.updateCurrentUser(updatedUser);
          this.toast.show('Profile updated successfully.', 'success');
          this.closeEditModal();
        },
        error: (e: unknown) => {
          this.savingProfile.set(false);
          if (e instanceof HttpErrorResponse) {
            const msg = (e.error as { message?: string } | null)?.message;
            this.profileSaveError.set(msg || 'Could not update profile');
          } else {
            this.profileSaveError.set('Could not update profile');
          }
        },
      });
  }
}