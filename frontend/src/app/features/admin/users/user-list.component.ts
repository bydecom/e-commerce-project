import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserApiService } from '../../../core/services/user-api.service';
import { ToastService } from '../../../core/services/toast.service';
import type { Role, User } from '../../../shared/models/user.model';

@Component({
  selector: 'app-admin-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="mx-auto w-full max-w-6xl pb-10">
      <div class="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Users</h1>
          <p class="mt-1 text-sm text-gray-500">Manage customers and administrator accounts.</p>
        </div>
      </div>

      <div class="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div class="relative min-w-0 flex-1">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (keyup.enter)="search()"
              class="block w-full rounded-lg border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              placeholder="Search by name or email..."
            />
          </div>
          <select
            [(ngModel)]="roleFilter"
            (change)="search()"
            class="rounded-lg border-0 py-2 pl-3 pr-8 text-sm ring-1 ring-gray-300"
          >
            <option value="">All roles</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button
            type="button"
            (click)="search()"
            class="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-600"
          >
            Search
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="mt-12 flex justify-center">
          <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" aria-hidden="true"></div>
        </div>
      } @else {
        <div class="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead class="bg-gray-50/80">
              <tr>
                <th class="px-6 py-4 font-semibold text-gray-700">Account</th>
                <th class="px-6 py-4 font-semibold text-gray-700">Role</th>
                <th class="px-6 py-4 font-semibold text-gray-700">Orders</th>
                <th class="px-6 py-4 font-semibold text-gray-700">Total Spent</th>
                <th class="px-6 py-4 font-semibold text-gray-700">Last Order</th>
                <th class="px-6 py-4 font-semibold text-gray-700">Joined</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (user of users(); track user.id) {
                <tr class="transition-colors hover:bg-gray-50/50">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold uppercase text-gray-500 ring-1 ring-gray-200"
                      >
                        {{ (user.name && user.name[0]) || user.email[0] }}
                      </div>
                      <div>
                        <div class="font-medium text-gray-900">{{ user.name || 'No name' }}</div>
                        <div class="text-xs text-gray-500">{{ user.email }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <span
                      class="inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset"
                      [class]="
                        user.role === 'ADMIN'
                          ? 'bg-red-50 text-red-700 ring-red-600/20'
                          : 'bg-blue-50 text-blue-700 ring-blue-600/20'
                      "
                    >
                      {{ user.role }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-gray-600">{{ user.orderCount }}</td>
                  <td class="px-6 py-4 text-gray-600">
                    {{ user.totalSpent | currency: 'VND':'symbol':'1.0-0' }}
                  </td>
                  <td class="px-6 py-4 text-gray-600">
                    {{ user.lastOrderAt ? (user.lastOrderAt | date: 'mediumDate') : '—' }}
                  </td>
                  <td class="px-6 py-4 text-gray-600">
                    @if (user.createdAt) {
                      {{ user.createdAt | date: 'mediumDate' }}
                    } @else {
                      —
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-6 py-12 text-center text-gray-500">No users found.</td>
                </tr>
              }
            </tbody>
          </table>
          @if (meta()) {
            <div class="flex items-center justify-between border-t border-gray-100 px-6 py-4">
              <p class="text-sm text-gray-500">{{ meta()!.total }} users total</p>
              <div class="flex gap-2">
                <button
                  (click)="goToPage(currentPage() - 1)"
                  [disabled]="currentPage() === 1"
                  class="rounded border px-3 py-1 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <span class="px-3 py-1 text-sm">Page {{ currentPage() }} / {{ meta()!.totalPages }}</span>
                <button
                  (click)="goToPage(currentPage() + 1)"
                  [disabled]="currentPage() >= meta()!.totalPages"
                  class="rounded border px-3 py-1 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AdminUserListComponent implements OnInit {
  private readonly api = inject(UserApiService);
  private readonly toast = inject(ToastService);

  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly meta = signal<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  readonly currentPage = signal(1);

  searchQuery = '';
  roleFilter: '' | Role = '';

  ngOnInit(): void {
    this.loadUsers();
  }

  search(): void {
    this.currentPage.set(1);
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.api
      .getUsers(this.currentPage(), 20, this.searchQuery || undefined, this.roleFilter || undefined)
      .subscribe({
      next: ({ data, meta }) => {
        this.users.set(data);
        this.meta.set(meta);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load users', 'error');
        this.loading.set(false);
      },
    });
  }

  goToPage(page: number): void {
    const m = this.meta();
    const totalPages = m?.totalPages ?? 1;
    const next = Math.max(1, Math.min(totalPages, page));
    if (next === this.currentPage()) return;
    this.currentPage.set(next);
    this.loadUsers();
  }
}
