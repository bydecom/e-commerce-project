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
              class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700"
            >
              A
            </div>
            <span class="text-sm font-medium text-gray-700">Administrator</span>
          </button>

          <div class="absolute right-0 top-full z-50 hidden w-48 pt-1 group-hover:block">
            <div class="rounded-lg border border-gray-200 bg-white py-2 shadow-xl">
              <a routerLink="/admin/settings" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >Shop Settings</a
              >
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
