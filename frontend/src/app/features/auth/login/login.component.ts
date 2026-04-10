import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-bold text-gray-900">Login</h1>
      <p class="mt-2 text-sm text-gray-600">Sign in to your account.</p>
      <form class="mt-6 space-y-4" (ngSubmit)="submit()">
        @if (errorMessage) {
          <div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {{ errorMessage }}
          </div>
        }
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
            autocomplete="current-password"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          [disabled]="loading"
          class="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sign in
        </button>
      </form>
      <p class="mt-4 text-center text-sm text-gray-600">
        No account?
        <a routerLink="/register" class="text-blue-600 hover:underline">Register</a>
      </p>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';

  loading = false;
  errorMessage = '';

  submit(): void {
    this.errorMessage = '';
    const email = this.email.trim();
    const password = this.password;

    if (!email) {
      this.errorMessage = 'Email is required';
      return;
    }
    if (!password) {
      this.errorMessage = 'Password is required';
      return;
    }

    this.loading = true;
    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/']);
      },
      error: (err: unknown) => {
        this.loading = false;
        this.errorMessage = this.extractErrorMessage(err);
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
      return 'Login failed';
    }
    if (err instanceof Error && err.message) return err.message;
    return 'Login failed';
  }
}
