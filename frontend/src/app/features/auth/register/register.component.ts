import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { strongPasswordValidator, matchPasswordsValidator } from '../../../shared/validators/app.validators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <div class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-bold text-gray-900">Register</h1>
      @if (verificationSent) {
        <p class="mt-2 text-sm text-gray-600">
          We sent a verification link to
          <span class="font-medium text-gray-900">{{ pendingEmail }}</span>. Open it to finish creating your
          account, then sign in here.
        </p>
        @if (verificationInfo) {
          <p class="mt-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            {{ verificationInfo }}
          </p>
        }
        <div class="mt-6 space-y-3 rounded border border-gray-200 bg-gray-50 p-4">
          <p class="text-sm text-gray-700">Didn't get the email?</p>
          <button
            type="button"
            [disabled]="resendLoading"
            (click)="resend()"
            class="w-full rounded border border-gray-300 bg-white py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ resendLoading ? 'Sending…' : 'Resend verification email' }}
          </button>
          @if (resendMessage) {
            <p class="text-sm text-green-800">{{ resendMessage }}</p>
          }
          @if (resendError) {
            <p class="text-sm text-red-800">{{ resendError }}</p>
          }
        </div>
        <p class="mt-6 text-center text-sm text-gray-600">
          <a routerLink="/login" class="text-blue-600 hover:underline">Back to login</a>
        </p>
      } @else {
        <p class="mt-2 text-sm text-gray-600">Create your account. You'll verify your email before signing in.</p>
        <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
          @if (serverError) {
            <div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {{ serverError }}
            </div>
          }
          <div>
            <label class="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              formControlName="name"
              autocomplete="name"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
            @if (form.controls.name.touched && form.controls.name.errors?.['required']) {
              <p class="mt-1 text-xs text-red-600">Name is required.</p>
            }
            @if (form.controls.name.touched && form.controls.name.errors?.['maxlength']) {
              <p class="mt-1 text-xs text-red-600">Name must not exceed 100 characters.</p>
            }
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              formControlName="email"
              autocomplete="email"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
            @if (form.controls.email.touched && form.controls.email.errors?.['required']) {
              <p class="mt-1 text-xs text-red-600">Email is required.</p>
            }
            @if (form.controls.email.touched && form.controls.email.errors?.['email']) {
              <p class="mt-1 text-xs text-red-600">Enter a valid email address.</p>
            }
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              formControlName="password"
              autocomplete="new-password"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
            @if (form.controls.password.touched) {
              @if (form.controls.password.errors?.['required']) {
                <p class="mt-1 text-xs text-red-600">Password is required.</p>
              }
              @if (form.controls.password.errors?.['minlength']) {
                <p class="mt-1 text-xs text-red-600">Password must be at least 8 characters.</p>
              }
              @if (form.controls.password.errors?.['noUppercase']) {
                <p class="mt-1 text-xs text-red-600">Password must contain at least 1 uppercase letter.</p>
              }
              @if (form.controls.password.errors?.['noLowercase']) {
                <p class="mt-1 text-xs text-red-600">Password must contain at least 1 lowercase letter.</p>
              }
              @if (form.controls.password.errors?.['noNumber']) {
                <p class="mt-1 text-xs text-red-600">Password must contain at least 1 number.</p>
              }
            }
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Confirm password</label>
            <input
              type="password"
              formControlName="confirmPassword"
              autocomplete="new-password"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
            @if (form.controls.confirmPassword.touched && form.controls.confirmPassword.errors?.['required']) {
              <p class="mt-1 text-xs text-red-600">Please confirm your password.</p>
            }
            @if (form.controls.confirmPassword.touched && form.errors?.['passwordMismatch']) {
              <p class="mt-1 text-xs text-red-600">Passwords do not match.</p>
            }
          </div>
          <button
            type="submit"
            [disabled]="loading"
            class="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Create account
          </button>
        </form>
        <p class="mt-4 text-center text-sm text-gray-600">
          Already have an account?
          <a routerLink="/login" class="text-blue-600 hover:underline">Login</a>
        </p>
      }
    </div>
  `,
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [matchPasswordsValidator('password', 'confirmPassword')] }
  );

  loading = false;
  serverError = '';

  verificationSent = false;
  pendingEmail = '';
  verificationInfo = '';

  resendLoading = false;
  resendMessage = '';
  resendError = '';

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.serverError = '';
    const { name, email, password } = this.form.getRawValue();

    this.loading = true;
    this.auth.register(name, email.trim(), password).subscribe({
      next: (data) => {
        this.loading = false;
        this.pendingEmail = data.email;
        this.verificationInfo = data.message;
        this.verificationSent = true;
        this.resendMessage = '';
        this.resendError = '';
      },
      error: (err: unknown) => {
        this.loading = false;
        this.form.controls.password.reset();
        this.form.controls.confirmPassword.reset();
        this.serverError = this.extractErrorMessage(err);
      },
    });
  }

  resend(): void {
    this.resendMessage = '';
    this.resendError = '';
    if (!this.pendingEmail.trim()) {
      this.resendError = 'Missing email';
      return;
    }
    this.resendLoading = true;
    this.auth.resendVerification(this.pendingEmail.trim()).subscribe({
      next: (data) => {
        this.resendLoading = false;
        this.resendMessage = data.message;
      },
      error: (err: unknown) => {
        this.resendLoading = false;
        this.resendError = this.extractErrorMessage(err);
      },
    });
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const maybe = err.error as { message?: unknown } | null;
      if (maybe && typeof maybe.message === 'string' && maybe.message.trim()) {
        return maybe.message;
      }
      if (typeof err.message === 'string' && err.message.trim()) {
        return err.message;
      }
      return 'Request failed';
    }
    if (err instanceof Error && err.message) return err.message;
    return 'Request failed';
  }
}
