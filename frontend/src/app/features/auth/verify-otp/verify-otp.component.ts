import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-bold text-gray-900">Verify Your Identity</h1>
      <p class="mt-2 text-sm text-gray-600">
        We sent a 6-digit code to <strong>{{ email }}</strong>.
        Enter it below to continue.
      </p>

      <form class="mt-6 space-y-4" (ngSubmit)="submit()">
        @if (errorMessage) {
          <div class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {{ errorMessage }}
          </div>
        }
        @if (successMessage) {
          <div class="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
            {{ successMessage }}
          </div>
        }

        <div>
          <label class="block text-sm font-medium text-gray-700">Verification code</label>
          <input
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            [(ngModel)]="otp"
            name="otp"
            maxlength="6"
            placeholder="123456"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-3 text-center text-2xl font-mono tracking-widest"
          />
        </div>

        <button
          type="submit"
          [disabled]="loading || otp.length < 6"
          class="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ loading ? 'Verifying…' : 'Verify &amp; Sign in' }}
        </button>
      </form>

      <div class="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          (click)="resend()"
          [disabled]="resendLoading || cooldownSeconds > 0"
          class="text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ cooldownSeconds > 0 ? 'Resend in ' + cooldownSeconds + 's' : (resendLoading ? 'Sending…' : 'Resend code') }}
        </button>

        <a routerLink="/login" class="text-gray-500 hover:underline">Use a different email</a>
      </div>
    </div>
  `,
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);

  email = '';
  otp = '';
  loading = false;
  resendLoading = false;
  errorMessage = '';
  successMessage = '';
  cooldownSeconds = 0;
  private returnUrl: string | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email') ?? '';
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    if (!email || !email.includes('@')) {
      void this.router.navigate(['/login']);
      return;
    }

    this.email = email.trim();
    this.returnUrl = this.sanitizeReturnUrl(returnUrl);

    if (isPlatformBrowser(this.platformId)) {
      this.sendOtp(true);
    }
  }

  ngOnDestroy(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
    }
  }

  submit(): void {
    this.errorMessage = '';
    const otp = this.otp.trim();
    if (!otp || otp.length < 6) {
      this.errorMessage = 'Please enter the 6-digit code';
      return;
    }

    this.loading = true;
    this.auth.verifyOtpAndLogin(this.email, otp).subscribe({
      next: () => {
        this.loading = false;
        void this.router.navigateByUrl(this.returnUrl ?? '/');
      },
      error: (err: unknown) => {
        this.loading = false;
        this.otp = '';
        this.errorMessage = this.extractErrorMessage(err);
      },
    });
  }

  resend(): void {
    this.sendOtp(false);
  }

  private sendOtp(isAutoSend: boolean): void {
    this.resendLoading = true;
    this.errorMessage = '';
    if (!isAutoSend) this.successMessage = '';

    this.auth.requestOtp(this.email).subscribe({
      next: () => {
        this.resendLoading = false;
        if (!isAutoSend) this.successMessage = 'A new code has been sent.';
        this.startCountdown(60);
      },
      error: (err: unknown) => {
        this.resendLoading = false;
        if (err instanceof HttpErrorResponse && err.status === 429) {
          const msg = (err.error as { message?: string } | null)?.message ?? '';
          const match = msg.match(/(\d+)\s+seconds/);
          const remaining = match ? parseInt(match[1], 10) : 60;
          this.startCountdown(remaining);
          // No error shown — cooldown timer communicates the state visually
        } else {
          this.errorMessage = this.extractErrorMessage(err);
        }
      },
    });
  }

  private startCountdown(seconds: number): void {
    if (this.countdownTimer !== null) clearInterval(this.countdownTimer);
    this.cooldownSeconds = seconds;
    if (seconds <= 0) return;
    this.countdownTimer = setInterval(() => {
      this.cooldownSeconds--;
      if (this.cooldownSeconds <= 0) {
        clearInterval(this.countdownTimer!);
        this.countdownTimer = null;
      }
    }, 1000);
  }

  private sanitizeReturnUrl(raw: string | null): string | null {
    if (!raw) return null;
    const v = raw.trim();
    if (!v.startsWith('/') || v.startsWith('//') || v === '/login') return null;
    return v;
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const maybe = err.error as { message?: unknown } | null;
      if (maybe && typeof maybe.message === 'string' && maybe.message.trim()) {
        return maybe.message;
      }
      return 'Verification failed. Please try again.';
    }
    if (err instanceof Error && err.message) return err.message;
    return 'Verification failed. Please try again.';
  }
}
