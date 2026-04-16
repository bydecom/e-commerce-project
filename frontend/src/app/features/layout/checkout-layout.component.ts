import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { StoreSettingService } from '../../core/services/store-setting.service';

@Component({
  selector: 'app-checkout-layout',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="flex min-h-screen flex-col bg-gray-50">
      <header class="border-b border-slate-800 bg-slate-900 shadow-sm">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="flex h-16 items-center justify-between">
            <div class="flex-shrink-0">
              <a
                routerLink="/cart"
                class="inline-flex items-center gap-2 text-white transition-opacity hover:opacity-90"
              >
                @if (logoUrl()) {
                  <img
                    [src]="logoUrl()"
                    [alt]="shopName()"
                    class="h-9 w-9 rounded-md object-contain"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                  />
                }
                <span class="text-2xl font-black tracking-tighter">
                  {{ shopName() }}
                </span>
              </a>
            </div>
            <div class="flex items-center text-sm font-medium text-slate-300">
              <svg class="mr-1.5 h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Secure Checkout
            </div>
          </div>
        </div>
      </header>

      <main class="flex-grow">
        <router-outlet></router-outlet>
      </main>

      <footer class="mt-auto border-t border-slate-800 bg-slate-900 text-slate-400">
        <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p class="text-sm">&copy; 2026 {{ shopName() }}. All rights reserved.</p>
            <div class="flex gap-4 text-sm font-medium">
              <a routerLink="/shipping" class="transition-colors hover:text-slate-200">Refund Policy</a>
              <a routerLink="/privacy" class="transition-colors hover:text-slate-200">Privacy Policy</a>
              <a routerLink="/terms" class="transition-colors hover:text-slate-200">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class CheckoutLayoutComponent {
  private readonly storeSetting = inject(StoreSettingService);

  readonly shopName = () => this.storeSetting.setting()?.name?.trim() || 'Shop';
  readonly logoUrl = () => this.storeSetting.setting()?.logoUrl?.trim() || '';
  readonly supportEmail = () => this.storeSetting.setting()?.email?.trim() || '';
  readonly supportPhone = () => this.storeSetting.setting()?.phone?.trim() || '';

  constructor() {
    this.storeSetting.load();
  }
}

