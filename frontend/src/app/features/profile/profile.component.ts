import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { UserApiService } from '../../core/services/user-api.service';
import type { User } from '../../shared/models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-2xl px-4 py-8">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Profile</h1>
        <p class="mt-1 text-sm text-gray-500">Manage your personal information.</p>
      </div>

      @if (loading()) {
        <div class="mt-12 flex justify-center">
          <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" aria-hidden="true"></div>
        </div>
      } @else if (error()) {
        <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {{ error() }}
        </div>
      } @else {
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div class="grid gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700">Email</label>
              <input
                type="email"
                [value]="me()?.email || ''"
                disabled
                class="mt-1 block w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-gray-700 ring-1 ring-inset ring-gray-200"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700">Full name</label>
              <input
                type="text"
                [(ngModel)]="formName"
                name="name"
                class="mt-1 block w-full rounded-lg border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700">Phone number</label>
              <input
                type="tel"
                [(ngModel)]="formPhone"
                name="phone"
                class="mt-1 block w-full rounded-lg border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                placeholder="Enter your phone number"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700">Address</label>
              <textarea
                rows="3"
                [(ngModel)]="formAddress"
                name="address"
                class="mt-1 block w-full rounded-lg border-0 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                placeholder="Enter your address"
              ></textarea>
            </div>

            <div class="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <span></span>
              <button
                type="button"
                (click)="save()"
                [disabled]="saving() || !canSave()"
                class="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                @if (saving()) {
                  <span class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                }
                Save changes
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(UserApiService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly me = signal<User | null>(null);

  formName = '';
  formPhone = '';
  formAddress = '';

  readonly canSave = computed(() => {
    const u = this.me();
    if (!u) return false;
    const nextName = this.formName.trim();
    const nextPhone = this.formPhone.trim();
    const nextAddress = this.formAddress.trim();
    return (u.name ?? '') !== nextName || (u.phone ?? '') !== nextPhone || (u.address ?? '') !== nextAddress;
  });

  ngOnInit(): void {
    this.load();
  }

  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.api
      .updateMe({
        name: this.formName,
        phone: this.formPhone,
        address: this.formAddress,
      })
      .subscribe({
        next: (updated) => {
          this.me.set(updated);
          this.auth.updateCurrentUser(updated);
          this.saving.set(false);
          this.toast.show('Profile updated successfully', 'success');
        },
        error: (e: Error) => {
          this.saving.set(false);
          this.toast.show(e.message || 'Update failed', 'error');
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getMe().subscribe({
      next: (u) => {
        this.me.set(u);
        this.formName = u.name ?? '';
        this.formPhone = u.phone ?? '';
        this.formAddress = u.address ?? '';
        this.loading.set(false);
      },
      error: (e: Error) => {
        this.error.set(e.message || 'Failed to load profile');
        this.loading.set(false);
      },
    });
  }
}
