import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserApiService } from '../../../core/services/user-api.service';
import { ToastService } from '../../../core/services/toast.service';
import type { Role, User } from '../../../shared/models/user.model';

@Component({
  selector: 'app-admin-user-list',
  standalone: true,
  imports: [FormsModule, DatePipe],
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
                <th class="px-6 py-4 font-semibold text-gray-700">Joined</th>
                <th class="px-6 py-4 text-right font-semibold text-gray-700">Actions</th>
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
                  <td class="px-6 py-4 text-gray-600">
                    @if (user.createdAt) {
                      {{ user.createdAt | date: 'mediumDate' }}
                    } @else {
                      —
                    }
                  </td>
                  <td class="px-6 py-4 text-right">
                    <select
                      class="inline-block rounded-md border-0 py-1.5 pl-2 pr-8 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 disabled:opacity-50"
                      [value]="user.role"
                      (change)="onRoleChange(user, $event)"
                      [disabled]="roleUpdatingId() === user.id"
                      [attr.aria-label]="'Change role for ' + user.email"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="px-6 py-12 text-center text-gray-500">No users found.</td>
                </tr>
              }
            </tbody>
          </table>
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
  readonly roleUpdatingId = signal<number | null>(null);

  searchQuery = '';

  ngOnInit(): void {
    this.loadUsers();
  }

  search(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.api.getUsers(1, 50, this.searchQuery || undefined).subscribe({
      next: ({ data }) => {
        this.users.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load users', 'error');
        this.loading.set(false);
      },
    });
  }

  onRoleChange(user: User, ev: Event): void {
    const sel = ev.target as HTMLSelectElement;
    const role = sel.value as Role;
    if (role === user.role) return;

    this.roleUpdatingId.set(user.id);
    this.api.updateRole(user.id, role).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
        this.roleUpdatingId.set(null);
        this.toast.show('Role updated', 'success');
      },
      error: (e: Error) => {
        sel.value = user.role;
        this.toast.show(e.message || 'Failed to update role', 'error');
        this.roleUpdatingId.set(null);
      },
    });
  }
}
