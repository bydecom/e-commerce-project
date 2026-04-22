import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { StoreSettingService } from '../../../core/services/store-setting.service';

@Component({
  selector: 'app-admin-navbar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
      <div class="flex items-center justify-between">
        <a routerLink="/admin" class="flex items-center gap-2 text-xl font-bold text-gray-900">
          @if (logoUrl(); as src) {
            <img [src]="src" alt="" class="h-8 w-auto object-contain" />
          }
          <span
            >{{ shopName() }} <span class="ml-1 text-sm font-normal text-gray-500">| Admin</span></span
          >
        </a>

        <div class="group relative">
          <button type="button" class="flex items-center gap-2 hover:opacity-80">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700"
              aria-hidden="true"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <span class="text-sm font-medium text-gray-700">Administrator</span>
          </button>

          <div class="absolute right-0 top-full z-50 hidden w-48 pt-1 group-hover:block">
            <div class="rounded-lg border border-gray-200 bg-white py-2 shadow-xl">
              <a routerLink="/admin/settings" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >Shop Settings</a
              >
              <a
                routerLink="/admin/system-config"
                class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                System Config
              </a>
              <hr class="my-1 border-gray-100" />
              <button
                type="button"
                (click)="auth.logout()"
                class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `,
})
export class AdminNavbarComponent {
  readonly auth = inject(AuthService);
  private readonly storeSetting = inject(StoreSettingService);

  readonly shopName = computed(() => this.storeSetting.setting()?.name ?? 'E-Commerce');
  readonly logoUrl = computed(() => this.storeSetting.setting()?.logoUrl ?? null);
}
