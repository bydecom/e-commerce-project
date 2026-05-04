import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
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
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Profile
        </a>

        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold tracking-tight text-gray-900">Change Password</h1>
          <button
            type="button"
            (click)="submit()"
            [disabled]="form.invalid || saving()"
            class="rounded-sm bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50"
          >
            {{ saving() ? 'Updating...' : 'Update Password' }}
          </button>
        </div>
      </div>

      @if (errorMessage()) {
        <div class="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {{ errorMessage() }}
        </div>
      }

      @if (successMessage()) {
        <div class="mb-6 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {{ successMessage() }}
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-6">
        <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
            <h2 class="font-bold text-gray-900">Security</h2>
          </div>
          <div class="px-6 py-5">
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-gray-700">Current password</label>
                <input
                  type="password"
                  formControlName="currentPassword"
                  class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                  placeholder="Enter your current password"
                />
                @if (form.controls.currentPassword.touched && form.controls.currentPassword.errors?.['required']) {
                  <p class="mt-1 text-xs text-red-600">Current password is required.</p>
                }
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">New password</label>
                <input
                  type="password"
                  formControlName="newPassword"
                  class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                  placeholder="At least 6 characters"
                />
                @if (form.controls.newPassword.touched && form.controls.newPassword.errors?.['required']) {
                  <p class="mt-1 text-xs text-red-600">New password is required.</p>
                } @else if (form.controls.newPassword.touched && form.controls.newPassword.errors?.['minlength']) {
                  <p class="mt-1 text-xs text-red-600">Password must be at least 6 characters.</p>
                }
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Confirm new password</label>
                <input
                  type="password"
                  formControlName="confirmPassword"
                  class="mt-1 block w-full rounded-sm border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-900 sm:text-sm"
                  placeholder="Re-enter new password"
                />
                @if (form.controls.confirmPassword.touched && form.controls.confirmPassword.errors?.['required']) {
                  <p class="mt-1 text-xs text-red-600">Please confirm your new password.</p>
                }
                @if (form.touched && form.errors?.['passwordMismatch']) {
                  <p class="mt-1 text-xs text-red-600">Passwords do not match.</p>
                }
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatchValidator] }
  );

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    this.errorMessage.set('');
    this.successMessage.set('');
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.auth.changePassword(v.currentPassword, v.newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset();
        this.successMessage.set('Password updated successfully. Redirecting...');
        setTimeout(() => this.auth.logout(), 1500);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        if (e instanceof HttpErrorResponse) {
          const msg = (e.error as { message?: string } | null)?.message;
          this.errorMessage.set(msg || 'Could not change password');
        } else {
          this.errorMessage.set('Could not change password');
        }
      },
    });
  }
}

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const group = control as { value?: { newPassword?: string; confirmPassword?: string } };
  const newPassword = group.value?.newPassword ?? '';
  const confirmPassword = group.value?.confirmPassword ?? '';
  if (!newPassword || !confirmPassword) return null;
  return newPassword === confirmPassword ? null : { passwordMismatch: true };
}

