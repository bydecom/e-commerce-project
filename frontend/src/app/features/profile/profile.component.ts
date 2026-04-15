import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { OrderApiService } from '../../core/services/order-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { CurrencyVndPipe } from '../../shared/pipes/currency-vnd.pipe';
import type { User } from '../../shared/models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, DatePipe, CurrencyVndPipe],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      @if (loadError()) {
        <div class="rounded-sm border-l-4 border-red-500 bg-red-50 p-4 text-red-800 shadow-sm">
          <p class="font-medium">{{ loadError() }}</p>
        </div>
      } @else if (loading()) {
        <div class="flex animate-pulse gap-8">
          <div class="hidden w-64 flex-shrink-0 flex-col gap-4 lg:flex">
            <div class="h-10 w-full bg-gray-100"></div>
            <div class="h-10 w-full bg-gray-100"></div>
          </div>
          <div class="flex-1 space-y-6">
            <div class="h-40 w-full bg-gray-100"></div>
            <div class="h-40 w-full bg-gray-100"></div>
          </div>
        </div>
      } @else {
        <div class="flex flex-col gap-8 lg:flex-row">
          <aside class="w-full lg:w-64 lg:flex-shrink-0">
            <nav class="flex flex-col space-y-1">
              <a class="flex items-center rounded-sm bg-gray-900 px-3 py-2.5 text-sm font-medium text-white">
                <svg
                  class="mr-3 h-5 w-5 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                General Profile
              </a>
              <a
                routerLink="/orders"
                class="flex items-center rounded-sm px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <svg class="mr-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                Order History
              </a>
              <a
                routerLink="/profile/change-password"
                class="flex items-center rounded-sm px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <svg class="mr-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Change Password
              </a>
            </nav>
          </aside>

          <main class="flex-1 space-y-8">
            <div class="flex items-center gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div
                class="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-sm bg-gray-900 text-2xl font-bold text-white shadow-inner"
              >
                {{ (me()?.name?.trim() || me()?.email || '?').slice(0, 1).toUpperCase() }}
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-3">
                  <h2 class="text-xl font-bold text-gray-900">{{ me()?.name || 'BanDai Member' }}</h2>
                  @if (me()?.role === 'ADMIN') {
                    <span
                      class="rounded-sm bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200"
                      >ADMIN</span
                    >
                  }
                </div>
                <p class="text-sm text-gray-500">{{ me()?.email }}</p>
                <p class="mt-1 text-xs text-gray-400">Joined on {{ me()?.createdAt | date: 'mediumDate' }}</p>
              </div>
              <div>
                <a
                  routerLink="/profile/edit"
                  class="rounded-sm border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  Edit Profile
                </a>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300">
                <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Total Orders</p>
                <div class="mt-2 flex items-baseline gap-2">
                  <span class="text-3xl font-black text-gray-900">{{ stats().totalOrders }}</span>
                  @if (stats().processing > 0) {
                    <span class="text-sm font-medium text-amber-600">({{ stats().processing }} pending)</span>
                  }
                </div>
              </div>
              <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300">
                <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Lifetime Spent</p>
                <p class="mt-2 text-3xl font-black text-gray-900">{{ stats().totalSpent | currencyVnd }}</p>
              </div>
            </div>

            <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                <h3 class="font-bold text-gray-900">Contact Details</h3>
              </div>
              <div class="px-6 py-5">
                <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt class="text-xs font-medium text-gray-500">Phone Number</dt>
                    <dd class="mt-1 text-sm font-semibold text-gray-900">{{ me()?.phone || 'Not provided' }}</dd>
                  </div>
                  <div class="sm:col-span-2">
                    <dt class="text-xs font-medium text-gray-500">Default Shipping Address</dt>
                    <dd class="mt-1 text-sm font-semibold leading-relaxed text-gray-900">
                      {{ me()?.address || 'No address saved. Add one to speed up checkout.' }}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </main>
        </div>
      }
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  private readonly userApi = inject(UserApiService);
  private readonly orderApi = inject(OrderApiService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly me = signal<User | null>(null);
  readonly stats = signal({ totalOrders: 0, totalSpent: 0, processing: 0 });

  ngOnInit(): void {
    const snap = this.auth.currentUser();
    if (snap) {
      this.me.set(snap);
    }
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);

    forkJoin({
      me: this.userApi.getMe(),
      orders: this.orderApi.getMyOrders(),
    }).subscribe({
      next: ({ me, orders }) => {
        this.me.set(me);

        const doneOrders = orders.filter((o) => o.status === 'DONE');
        const processingOrders = orders.filter((o) => o.status !== 'DONE' && o.status !== 'CANCELLED');
        const totalSpent = doneOrders.reduce((sum, o) => sum + o.total, 0);

        this.stats.set({
          totalOrders: orders.length,
          totalSpent,
          processing: processingOrders.length,
        });

        this.loading.set(false);
      },
      error: (e: Error) => {
        this.loadError.set(e.message || 'Unable to load combined data');
        this.loading.set(false);
      },
    });
  }
}