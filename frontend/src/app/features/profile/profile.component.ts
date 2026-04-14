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
    <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      @if (loadError()) {
        <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
          <div class="flex items-center gap-3">
            <svg class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p class="font-bold">{{ loadError() }}</p>
          </div>
        </div>
      } @else if (loading()) {
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="space-y-6 lg:col-span-1">
            <div class="h-64 animate-pulse rounded-3xl bg-gray-100"></div>
            <div class="h-24 animate-pulse rounded-3xl bg-gray-100"></div>
          </div>
          <div class="h-96 animate-pulse rounded-3xl bg-gray-100 lg:col-span-2"></div>
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="space-y-6 lg:col-span-1">
            <div class="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div class="h-24 bg-gradient-to-r from-gray-800 to-gray-900"></div>
              <div class="px-6 pb-6 text-center">
                <div
                  class="relative mx-auto -mt-12 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-white text-3xl font-bold shadow-md"
                >
                  <div class="flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-gray-800">
                    {{ (me()?.name?.trim() || me()?.email || '?').slice(0, 1).toUpperCase() }}
                  </div>

                  @if (me()?.role === 'ADMIN') {
                    <span
                      class="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-500"
                      title="Admin"
                    >
                      <svg class="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fill-rule="evenodd"
                          d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </span>
                  }
                </div>
                <h2 class="mt-4 text-xl font-extrabold text-gray-900">{{ me()?.name || 'BanDai member' }}</h2>
                <p class="text-sm font-medium text-gray-500">{{ me()?.email }}</p>
                <p class="mt-4 text-xs text-gray-400">Joined: {{ me()?.createdAt | date: 'MM/yyyy' }}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div
                class="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm transition hover:shadow-md"
              >
                <div class="flex items-center gap-2 text-emerald-600">
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  <p class="text-[10px] font-bold uppercase tracking-widest">Orders</p>
                </div>
                <div class="mt-3 flex items-baseline gap-2">
                  <p class="text-3xl font-black text-emerald-700">{{ stats().totalOrders }}</p>
                </div>
                @if (stats().processing > 0) {
                  <p class="mt-1 text-xs font-semibold text-emerald-600">{{ stats().processing }} processing</p>
                } @else {
                  <p class="mt-1 text-xs font-semibold text-emerald-600/70">No pending orders</p>
                }
              </div>

              <div
                class="rounded-3xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm transition hover:shadow-md"
              >
                <div class="flex items-center gap-2 text-indigo-600">
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p class="text-[10px] font-bold uppercase tracking-widest">Spent</p>
                </div>
                <p class="mt-3 text-xl font-black text-indigo-700">{{ stats().totalSpent | currencyVnd }}</p>
                <p class="mt-1 text-xs font-semibold text-indigo-600">Lifetime total</p>
              </div>
            </div>

            <div class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 class="text-sm font-bold uppercase tracking-wider text-gray-900">Quick actions</h3>
              <div class="mt-4 space-y-3">
                <a
                  routerLink="/orders"
                  class="group flex items-center justify-between rounded-xl bg-gray-50 p-4 transition hover:bg-gray-100"
                >
                  <div class="flex items-center gap-3">
                    <span class="font-bold text-gray-700 group-hover:text-gray-900">Order history</span>
                  </div>
                  <span class="font-bold text-gray-300 group-hover:text-gray-600">&rarr;</span>
                </a>

                <a
                  routerLink="/profile/edit"
                  class="group flex items-center justify-between rounded-xl bg-gray-50 p-4 transition hover:bg-gray-100"
                >
                  <div class="flex items-center gap-3">
                    <span class="font-bold text-gray-700 group-hover:text-gray-900">Edit profile</span>
                  </div>
                  <span class="font-bold text-gray-300 group-hover:text-gray-600">&rarr;</span>
                </a>
              </div>
            </div>
          </div>

          <div class="space-y-6 lg:col-span-2">
            <div class="rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div class="flex items-center justify-between border-b border-gray-100 p-6">
                <h3 class="text-lg font-bold text-gray-900">Personal information</h3>
                <a routerLink="/profile/edit" class="text-sm font-bold text-indigo-600 hover:text-indigo-800">Edit</a>
              </div>
              <div class="p-6">
                <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt class="text-xs font-bold uppercase tracking-wider text-gray-500">Full name</dt>
                    <dd class="mt-2 text-base font-semibold text-gray-900">{{ me()?.name || 'Not set' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-bold uppercase tracking-wider text-gray-500">Email (login)</dt>
                    <dd class="mt-2 text-base font-semibold text-gray-900">{{ me()?.email }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-bold uppercase tracking-wider text-gray-500">Phone</dt>
                    <dd class="mt-2 text-base font-semibold text-gray-900">{{ me()?.phone || 'Not set' }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-bold uppercase tracking-wider text-gray-500">Role</dt>
                    <dd class="mt-2">
                      <span
                        class="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-extrabold uppercase"
                        [class]="me()?.role === 'ADMIN' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'"
                      >
                        {{ me()?.role }}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div class="rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div class="flex items-center justify-between border-b border-gray-100 p-6">
                <h3 class="text-lg font-bold text-gray-900">Address book</h3>
                <a routerLink="/profile/edit" class="text-sm font-bold text-indigo-600 hover:text-indigo-800">Edit</a>
              </div>
              <div class="p-6">
                <div class="flex items-start gap-4 rounded-2xl bg-gray-50 p-5">
                  <div
                    class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200"
                  >
                    <svg
                      class="h-5 w-5 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 class="font-bold text-gray-900">Default shipping address</h4>
                    <p class="mt-2 text-sm leading-relaxed text-gray-600">
                      {{
                        me()?.address ||
                          'You have not set a shipping address yet. Please update it to make checkout faster.'
                      }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
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