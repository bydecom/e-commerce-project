import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ServerCartService } from '../../../core/services/server-cart.service';
import { StoreSettingService } from '../../../core/services/store-setting.service';
import {
  ProductApiService,
  type CategoryDto,
} from '../../../core/services/product-api.service';
import { ShopBrowseDraftService } from '../../../core/services/shop-browse-draft.service';
import { CurrencyVndPipe } from '../../pipes/currency-vnd.pipe';
import type { Product } from '../../models/product.model';

interface CacheEntry {
  data: Product[];
  ts: number;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, FormsModule, CurrencyVndPipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly serverCart = inject(ServerCartService);
  private readonly storeSetting = inject(StoreSettingService);
  private readonly productApi = inject(ProductApiService);
  private readonly router = inject(Router);
  private readonly browseDraft = inject(ShopBrowseDraftService);

  readonly auth = this.authService;
  readonly cart = this.serverCart;

  readonly shopName = computed(() => this.storeSetting.setting()?.name ?? 'E‑Commerce');
  readonly logoUrl = computed(() => this.storeSetting.setting()?.logoUrl ?? null);

  readonly searchSuggestions = signal<CategoryDto[]>([]);

  headerSearch = '';
  showDropdown = false;
  readonly productResults = signal<Product[]>([]);
  readonly isSearching = signal(false);

  private navSub?: Subscription;

  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 60_000;

  private readonly DEBOUNCE_MS = 300;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly THROTTLE_MS = 500;
  private lastCallTs = 0;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;

  private pendingSearchSub?: Subscription;

  ngOnInit(): void {
    this.productApi.getCategories().subscribe({
      next: (cats) => this.searchSuggestions.set(cats.slice(0, 5)),
      error: (err) => console.error('Failed to load search category suggestions', err),
    });

    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.syncHeaderSearchFromUrl();
        this.showDropdown = false;
        if (this.auth.isAuthenticated()) this.serverCart.refresh().subscribe();
      });

    this.syncHeaderSearchFromUrl();
    if (this.auth.isAuthenticated()) this.serverCart.refresh().subscribe();
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    this.clearDebounce();
    this.clearThrottle();
    this.cancelPendingSearch();
  }

  onSearchInput(value: string): void {
    this.headerSearch = value;
    this.showDropdown = true;

    if (!value.trim()) {
      this.productResults.set([]);
      this.cancelPendingSearch();
      this.isSearching.set(false);
      return;
    }

    this.clearDebounce();
    this.debounceTimer = setTimeout(() => this.throttledSearch(value.trim()), this.DEBOUNCE_MS);
  }

  onFocus(): void {
    if (this.headerSearch.trim()) this.showDropdown = true;
  }

  onBlur(): void {
    setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  submitHeaderSearch(): void {
    this.showDropdown = false;
    const q = this.headerSearch.trim();
    const cats = this.browseDraft.categoryIds();
    const dateSort = this.browseDraft.dateSort();
    const priceSort = this.browseDraft.priceSort();

    this.router.navigate(['/products'], {
      queryParams: {
        q: q || null,
        cats: cats.length ? cats.join(',') : null,
        dateSort,
        priceSort,
      },
    });
  }

  categoryShortcutParams(catId: number): Record<string, string | null> {
    return { q: null, cats: String(catId), dateSort: 'newest', priceSort: 'any' };
  }

  private throttledSearch(keyword: string): void {
    const now = Date.now();
    const remaining = this.THROTTLE_MS - (now - this.lastCallTs);

    if (remaining <= 0) {
      this.lastCallTs = now;
      this.executeSearch(keyword);
    } else {
      this.clearThrottle();
      this.throttleTimer = setTimeout(() => {
        this.lastCallTs = Date.now();
        this.executeSearch(keyword);
      }, remaining);
    }
  }

  private executeSearch(keyword: string): void {
    const cacheKey = keyword.toLowerCase();
    const hit = this.cache.get(cacheKey);

    if (hit && Date.now() - hit.ts < this.CACHE_TTL_MS) {
      this.productResults.set(hit.data);
      this.isSearching.set(false);
      return;
    }

    this.cancelPendingSearch();
    this.isSearching.set(true);

    this.pendingSearchSub = this.productApi.list({ search: keyword, limit: 5, status: 'AVAILABLE' }).subscribe({
      next: (res) => {
        this.cache.set(cacheKey, { data: res.data, ts: Date.now() });
        this.productResults.set(res.data);
        this.isSearching.set(false);
      },
      error: () => {
        this.isSearching.set(false);
        this.productResults.set([]);
      },
    });
  }

  private syncHeaderSearchFromUrl(): void {
    const tree = this.router.parseUrl(this.router.url);
    const primary = tree.root.children['primary'];
    const segments = primary?.segments ?? [];
    if (segments.length !== 1 || segments[0].path !== 'products') return;

    const rawQ = tree.queryParams['q'];
    this.headerSearch =
      typeof rawQ === 'string' ? rawQ : Array.isArray(rawQ) && typeof rawQ[0] === 'string' ? rawQ[0] : '';
  }

  private cancelPendingSearch(): void {
    this.pendingSearchSub?.unsubscribe();
    this.pendingSearchSub = undefined;
  }

  private clearDebounce(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  private clearThrottle(): void {
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
    this.throttleTimer = null;
  }
}
