import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-email-verified',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div class="w-full max-w-md rounded-lg bg-white p-8 shadow text-center">
        @if (status() === 'success') {
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Email Verified!</h1>
          <p class="mt-2 text-sm text-gray-600">Your account has been verified. You can now log in.</p>
          <a
            routerLink="/login"
            class="mt-6 inline-block rounded-md bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            Go to Login
          </a>
        } @else {
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Verification Failed</h1>
          <p class="mt-2 text-sm text-gray-600">The link is invalid or has expired. Please register again.</p>
          <a
            routerLink="/register"
            class="mt-6 inline-block rounded-md bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            Back to Register
          </a>
        }
      </div>
    </div>
  `,
})
export class EmailVerifiedComponent implements OnInit {
  private route = inject(ActivatedRoute);
  status = signal<'success' | 'error'>('error');

  ngOnInit(): void {
    const s = this.route.snapshot.queryParamMap.get('status');
    this.status.set(s === 'success' ? 'success' : 'error');
  }
}
