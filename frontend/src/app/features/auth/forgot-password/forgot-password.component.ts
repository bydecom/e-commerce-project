import { Component, inject, signal, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
  FormGroup,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';

type Step = 'email' | 'otp' | 'reset';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-bold text-gray-900">
        @if (step() === 'email') {
          Forgot Password
        }
        @if (step() === 'otp') {
          Verify OTP
        }
        @if (step() === 'reset') {
          Create New Password
        }
      </h1>

      @if (errorMessage()) {
        <div class="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {{ errorMessage() }}
        </div>
      }

      @if (successMessage()) {
        <div class="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          {{ successMessage() }}
        </div>
      }

      @if (step() === 'email') {
        <p class="mt-2 text-sm text-gray-600">
          Enter your email address and we'll send you a code to reset your password.
        </p>
        <form [formGroup]="emailForm" (ngSubmit)="submitEmail()" class="mt-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              formControlName="email"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
            @if (emailForm.controls.email.touched && emailForm.controls.email.errors?.['required']) {
              <p class="mt-1 text-xs text-red-600">Email is required.</p>
            }
            @if (emailForm.controls.email.touched && emailForm.controls.email.errors?.['email']) {
              <p class="mt-1 text-xs text-red-600">Enter a valid email.</p>
            }
          </div>
          <button
            type="submit"
            [disabled]="emailForm.invalid || loading()"
            class="w-full rounded bg-gray-900 py-2 font-bold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {{ loading() ? 'Sending...' : 'Send OTP' }}
          </button>
        </form>
      }

      @if (step() === 'otp') {
        <p class="mt-2 text-sm text-gray-600">
          We sent a 6-digit code to <strong>{{ emailForm.getRawValue().email }}</strong>.
        </p>
        <form [formGroup]="otpForm" (ngSubmit)="submitOtp()" class="mt-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Verification code</label>
            <input
              type="text"
              formControlName="otp"
              maxlength="6"
              inputmode="numeric"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-3 text-center text-2xl font-mono tracking-widest focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="123456"
            />
          </div>
          <button
            type="submit"
            [disabled]="otpForm.invalid || loading()"
            class="w-full rounded bg-gray-900 py-2 font-bold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {{ loading() ? 'Verifying...' : 'Verify Code' }}
          </button>
        </form>

        <div class="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            (click)="resend()"
            [disabled]="resendLoading() || cooldownSeconds() > 0"
            class="text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{
              cooldownSeconds() > 0
                ? 'Resend in ' + cooldownSeconds() + 's'
                : resendLoading()
                  ? 'Sending...'
                  : 'Resend code'
            }}
          </button>
          <a routerLink="/login" class="text-gray-500 hover:underline">Use a different email</a>
        </div>
      }

      @if (step() === 'reset') {
        <p class="mt-2 text-sm text-gray-600">
          Your new password must be at least 6 characters (same as registration).
        </p>
        <form [formGroup]="resetForm" (ngSubmit)="submitReset()" class="mt-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">New password</label>
            <input
              type="password"
              formControlName="newPassword"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
            />
            @if (resetForm.controls.newPassword.touched && resetForm.controls.newPassword.errors?.['minlength']) {
              <p class="mt-1 text-xs text-red-600">Password must be at least 6 characters.</p>
            }
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Confirm new password</label>
            <input
              type="password"
              formControlName="confirmPassword"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
            />
            @if (resetForm.touched && resetForm.errors?.['passwordMismatch']) {
              <p class="mt-1 text-xs text-red-600">Passwords do not match.</p>
            }
          </div>
          <button
            type="submit"
            [disabled]="resetForm.invalid || loading()"
            class="w-full rounded bg-gray-900 py-2 font-bold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {{ loading() ? 'Resetting...' : 'Reset Password' }}
          </button>
        </form>
      }

      <div class="mt-6 text-center">
        <a routerLink="/login" class="text-sm font-medium text-indigo-600 hover:text-indigo-500">Back to Login</a>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  step = signal<Step>('email');
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  resendLoading = signal(false);
  cooldownSeconds = signal(0);
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  resetToken = '';

  emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  otpForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  resetForm = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [this.passwordsMatchValidator] }
  );

  ngOnDestroy(): void {
    if (this.countdownTimer !== null) clearInterval(this.countdownTimer);
  }

  submitEmail(): void {
    if (this.emailForm.invalid) return;
    this.loading.set(true);
    this.clearMessages();

    const email = this.emailForm.getRawValue().email;
    this.auth.requestForgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.step.set('otp');
        this.successMessage.set('If your email is registered, a code has been sent.');
        this.startCountdown(60);
      },
      error: (err) => this.handleError(err),
    });
  }

  resend(): void {
    this.resendLoading.set(true);
    this.clearMessages();
    const email = this.emailForm.getRawValue().email;

    this.auth.requestForgotPassword(email).subscribe({
      next: () => {
        this.resendLoading.set(false);
        this.successMessage.set('A new code has been sent.');
        this.startCountdown(60);
      },
      error: (err: unknown) => {
        this.resendLoading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 429) {
          const msg = (err.error as { message?: string } | null)?.message ?? '';
          const match = msg.match(/(\d+)\s+seconds/);
          this.startCountdown(match ? parseInt(match[1], 10) : 60);
        } else {
          this.handleError(err);
        }
      },
    });
  }

  private startCountdown(seconds: number): void {
    if (this.countdownTimer !== null) clearInterval(this.countdownTimer);
    this.cooldownSeconds.set(seconds);
    this.countdownTimer = setInterval(() => {
      this.cooldownSeconds.update((s) => {
        if (s <= 1) {
          if (this.countdownTimer !== null) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  submitOtp(): void {
    if (this.otpForm.invalid) return;
    this.loading.set(true);
    this.clearMessages();

    const email = this.emailForm.getRawValue().email;
    const otp = this.otpForm.getRawValue().otp;

    this.auth.verifyForgotPasswordOtp(email, otp).subscribe({
      next: (token) => {
        this.loading.set(false);
        this.resetToken = token;
        this.step.set('reset');
        this.successMessage.set('OTP verified. Create your new password.');
        if (this.countdownTimer !== null) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.cooldownSeconds.set(0);
      },
      error: (err) => this.handleError(err),
    });
  }

  submitReset(): void {
    if (this.resetForm.invalid) return;
    this.loading.set(true);
    this.clearMessages();

    const email = this.emailForm.getRawValue().email;
    const newPassword = this.resetForm.getRawValue().newPassword;

    this.auth.resetPassword(email, this.resetToken, newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.resetToken = '';
        this.resetForm.reset({
          newPassword: '',
          confirmPassword: '',
        });
        this.successMessage.set('Password successfully reset! Redirecting to login...');
        setTimeout(() => void this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.resetForm.patchValue({ newPassword: '', confirmPassword: '' });
        this.handleError(err);
      },
    });
  }

  private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const g = control as FormGroup;
    const newPassword = g.get('newPassword')?.value ?? '';
    const confirmPassword = g.get('confirmPassword')?.value ?? '';
    if (!newPassword || !confirmPassword) return null;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  private clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  private handleError(err: unknown): void {
    this.loading.set(false);
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | null;
      const msg = typeof body?.message === 'string' ? body.message : err.message;
      this.errorMessage.set(msg);
      return;
    }
    this.errorMessage.set(err instanceof Error ? err.message : 'An unexpected error occurred');
  }
}
