import { isPlatformBrowser, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <div class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-bold text-gray-900">Login</h1>
      <p class="mt-2 text-sm text-gray-600">Sign in to your account.</p>
      @if (bannerSuccess) {
        <div class="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {{ bannerSuccess }}
        </div>
      }
      @if (bannerError) {
        <div class="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {{ bannerError }}
        </div>
      }
      <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
        @if (serverError) {
          <div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {{ serverError }}
          </div>
        }
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
            autocomplete="current-password"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
          @if (form.controls.password.touched && form.controls.password.errors?.['required']) {
            <p class="mt-1 text-xs text-red-600">Password is required.</p>
          }
        </div>
        <button
          type="submit"
          [disabled]="loading"
          class="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sign in
        </button>
      </form>
      <p class="mt-2 text-center text-sm">
        <a routerLink="/forgot-password" class="text-blue-600 hover:underline">Forgot password?</a>
      </p>
      <p class="mt-4 text-center text-sm text-gray-600">
        No account?
        <a routerLink="/register" class="text-blue-600 hover:underline">Register</a>
      </p>
    </div>
  `,
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  loading = false;
  serverError = '';
  bannerSuccess = '';
  bannerError = '';
  private returnUrl: string | null = null;

  ngOnInit(): void {
    const verified = this.route.snapshot.queryParamMap.get('verified');
    const reason = this.route.snapshot.queryParamMap.get('reason');
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl = this.sanitizeReturnUrl(returnUrl);
    if (verified === '1') {
      this.bannerSuccess = 'Email verified. You can sign in now.';
    } else if (verified === '0') {
      this.bannerError =
        reason === 'invalid_or_expired'
          ? 'That verification link is invalid or has expired. Register again or resend from the register page.'
          : 'Email verification did not complete. Try again or request a new link.';
    }
    if (!this.bannerSuccess && !this.bannerError && reason === 'session_expired') {
      this.bannerError = 'Your session has expired. Please sign in again.';
    }
    if (verified !== null && isPlatformBrowser(this.platformId)) {
      const keepReturnUrl = this.returnUrl ? `?returnUrl=${encodeURIComponent(this.returnUrl)}` : '';
      this.location.replaceState(`/login${keepReturnUrl}`);
    }
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.serverError = '';
    const { email, password } = this.form.getRawValue();

    this.loading = true;
    this.auth.login(email.trim(), password).subscribe({
      next: () => {
        this.loading = false;
        this.form.controls.password.reset();
        const target = this.returnUrl || '/';
        void this.router.navigateByUrl(target);
      },
      error: (err: unknown) => {
        this.loading = false;
        this.form.controls.password.reset();
        if (this.isOtpRequired(err)) {
          void this.router.navigate(['/verify-otp'], {
            queryParams: {
              email: email.trim(),
              ...(this.returnUrl ? { returnUrl: this.returnUrl } : {}),
            },
          });
          return;
        }
        this.serverError = this.extractErrorMessage(err);
      },
    });
  }

  private sanitizeReturnUrl(raw: string | null): string | null {
    if (!raw) return null;
    const v = raw.trim();
    if (!v.startsWith('/')) return null;
    if (v.startsWith('//')) return null;
    if (v === '/login') return null;
    return v;
  }

  private isOtpRequired(err: unknown): boolean {
    if (err instanceof HttpErrorResponse) {
      const errors = (err.error as { errors?: { code?: string } | null } | null)?.errors;
      return errors?.code === 'AUTH_OTP_REQUIRED';
    }
    return false;
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
