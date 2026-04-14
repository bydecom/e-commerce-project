import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserApiService } from '../../core/services/user-api.service';
import { AuthService } from '../../core/services/auth.service';
import type { User } from '../../shared/models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-2xl px-4 py-8">
      <div class="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">Profile</h1>
          <p class="mt-2 text-sm text-gray-600">Update your contact information and delivery address.</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="reload()"
            [disabled]="loading()"
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
          <a
            routerLink="/profile/edit"
            class="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800"
          >
            Edit profile
          </a>
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
        <div class="space-y-6">
          <div class="rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-6 shadow-sm">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900">Signed in as</p>
                <p class="mt-1 truncate text-sm text-gray-600">
                  {{ me()?.email }}
                </p>
              </div>
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white ring-1 ring-black/10"
                aria-hidden="true"
              >
                {{ (me()?.name?.trim() || me()?.email || '?').slice(0, 1).toUpperCase() }}
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="text-base font-semibold text-gray-900">Account</h2>
            <p class="mt-1 text-sm text-gray-500">These details help us personalize your experience.</p>

            <div class="mt-6 grid grid-cols-1 gap-5">
              <div>
                <label class="block text-sm font-medium text-gray-700">Email</label>
                <div class="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800 ring-1 ring-inset ring-gray-200">
                  {{ me()?.email ?? '' }}
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Name</label>
                <div class="mt-2 rounded-md bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200">
                  {{ me()?.name ?? '—' }}
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700">Phone</label>
                <div class="mt-2 rounded-md bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200">
                  {{ me()?.phone ?? '—' }}
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="text-base font-semibold text-gray-900">Address</h2>
            <p class="mt-1 text-sm text-gray-500">Used as your default delivery address.</p>

            <div class="mt-6">
              <label class="block text-sm font-medium text-gray-700">Shipping address</label>
              <div
                class="mt-2 whitespace-pre-wrap rounded-md bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200"
              >
                {{ me()?.address ?? '—' }}
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(UserApiService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly me = signal<User | null>(null);

  ngOnInit(): void {
    // Use local snapshot immediately, then refresh from server.
    const snap = this.auth.currentUser();
    if (snap) {
      this.me.set(snap);
    }
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getMe().subscribe({
      next: (me) => {
        this.me.set(me);
        this.loading.set(false);
      },
      error: (e: Error) => {
        this.loadError.set(e.message || 'Could not load profile');
        this.loading.set(false);
      },
    });
  }
}
