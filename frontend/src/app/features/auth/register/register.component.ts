import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormsModule],
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
          <p class="text-sm text-gray-700">Didn’t get the email?</p>
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
        <p class="mt-2 text-sm text-gray-600">Create your account. You’ll verify your email before signing in.</p>
        <form class="mt-6 space-y-4" (ngSubmit)="submit()">
          @if (errorMessage) {
            <div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {{ errorMessage }}
            </div>
          }
          <div>
            <label class="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              [(ngModel)]="name"
              name="name"
              autocomplete="name"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              [(ngModel)]="email"
              name="email"
              autocomplete="email"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              [(ngModel)]="password"
              name="password"
              autocomplete="new-password"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Confirm password</label>
            <input
              type="password"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              autocomplete="new-password"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
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

  name = '';
  email = '';
  password = '';
  confirmPassword = '';

  loading = false;
  errorMessage = '';

  verificationSent = false;
  pendingEmail = '';
  verificationInfo = '';

  resendLoading = false;
  resendMessage = '';
  resendError = '';

  submit(): void {
    this.errorMessage = '';

    if (!this.email.trim()) {
      this.errorMessage = 'Email is required';
      return;
    }
    if (!this.password) {
      this.errorMessage = 'Password is required';
      return;
    }
    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Confirm password does not match';
      return;
    }

    this.loading = true;
    this.auth.register(this.name, this.email, this.password).subscribe({
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
        this.errorMessage = this.extractErrorMessage(err);
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
