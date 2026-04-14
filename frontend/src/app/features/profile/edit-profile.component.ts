import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UserApiService } from '../../core/services/user-api.service';
import type { User } from '../../shared/models/user.model';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-2xl px-4 py-8">
      <div class="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a
            routerLink="/profile"
            class="mb-1 inline-block text-sm font-medium text-gray-500 hover:text-gray-700 hover:underline"
          >
            &larr; Back to profile
          </a>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">Edit profile</h1>
          <p class="mt-2 text-sm text-gray-600">Update your contact information and delivery address.</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="resetForm()"
            [disabled]="loading() || saving()"
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            (click)="save()"
            [disabled]="form.invalid || loading() || saving()"
            class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {{ saving() ? 'Saving...' : 'Save changes' }}
          </button>
        </div>
      </div>

      @if (loadError()) {
        <div class="rounded-md bg-red-50 p-4">
          <p class="text-sm font-medium text-red-800">{{ loadError() }}</p>
        </div>
      } @else if (loading()) {
        <div class="flex justify-center py-12">
          <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" aria-hidden="true"></div>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="space-y-6">
          <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="text-base font-semibold text-gray-900">Account</h2>
            <p class="mt-1 text-sm text-gray-500">Your email can’t be changed here.</p>

            <div class="mt-6 grid grid-cols-1 gap-5">
              <div>
                <label class="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  [value]="me()?.email ?? ''"
                  disabled
                  class="mt-2 block w-full cursor-not-allowed rounded-md border-0 bg-gray-50 px-3 py-1.5 text-gray-700 shadow-sm ring-1 ring-inset ring-gray-200 sm:text-sm sm:leading-6"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  formControlName="name"
                  class="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  placeholder="Your full name"
                />
                @if (form.controls.name.touched && form.controls.name.errors?.['maxlength']) {
                  <p class="mt-1 text-xs text-red-600">Name is too long.</p>
                }
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  formControlName="phone"
                  class="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  placeholder="+84..."
                />
                @if (form.controls.phone.touched && form.controls.phone.errors?.['maxlength']) {
                  <p class="mt-1 text-xs text-red-600">Phone is too long.</p>
                }
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="text-base font-semibold text-gray-900">Address</h2>
            <p class="mt-1 text-sm text-gray-500">Used as your default delivery address.</p>

            <div class="mt-6">
              <label class="block text-sm font-medium text-gray-700">Shipping address</label>
              <textarea
                formControlName="address"
                rows="3"
                class="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                placeholder="Street, ward, district, city..."
              ></textarea>
              @if (form.controls.address.touched && form.controls.address.errors?.['maxlength']) {
                <p class="mt-1 text-xs text-red-600">Address is too long.</p>
              }
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
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly me = signal<User | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.maxLength(100)]],
    phone: ['', [Validators.maxLength(30)]],
    address: ['', [Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.reload();
  }

  resetForm(): void {
    if (this.loading() || this.saving()) return;
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getMe().subscribe({
      next: (me) => {
        this.me.set(me);
        this.form.patchValue({
          name: me.name ?? '',
          phone: me.phone ?? '',
          address: me.address ?? '',
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
    this.api
      .updateMe({
        name: v.name.trim() === '' ? null : v.name.trim(),
        phone: v.phone.trim() === '' ? null : v.phone.trim(),
        address: v.address.trim() === '' ? null : v.address.trim(),
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.me.set(updated);
          
          this.auth.updateCurrentUser(updated); 
          
          this.toast.show('Profile updated.', 'success');
          void this.router.navigate(['/profile']);
        },
        error: (e: Error) => {
          this.saving.set(false);
          this.toast.show(e.message || 'Could not update profile', 'error');
        },
      });
  }
}