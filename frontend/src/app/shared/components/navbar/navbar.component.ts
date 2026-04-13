import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ServerCartService } from '../../../core/services/server-cart.service';
import { StoreSettingService } from '../../../core/services/store-setting.service';
import { ProductApiService, type CategoryDto } from '../../../core/services/product-api.service';
import { ShopBrowseDraftService } from '../../../core/services/shop-browse-draft.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, FormsModule],
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

  /** Header keyword — synced from URL when on `/products` (not product detail). */
  headerSearch = '';

  private navSub?: Subscription;

  ngOnInit(): void {
    this.productApi.getCategories().subscribe({
      next: (cats) => {
        this.searchSuggestions.set(cats.slice(0, 5));
      },
      error: (err) => console.error('Failed to load search category suggestions', err),
    });

    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.syncHeaderSearchFromUrl();
        if (this.auth.isAuthenticated()) {
          this.serverCart.refresh().subscribe();
        }
      });
    this.syncHeaderSearchFromUrl();
    if (this.auth.isAuthenticated()) {
      this.serverCart.refresh().subscribe();
    }
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  /** Apply keyword + sidebar-aligned category + sort from `ShopBrowseDraftService`. */
  submitHeaderSearch(): void {
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

  /**
   * Category shortcuts under the search bar — same as sidebar checkboxes (`cats`), not a name search.
   */
  categoryShortcutParams(catId: number): Record<string, string | null> {
    return {
      q: null,
      cats: String(catId),
      dateSort: 'newest',
      priceSort: 'any',
    };
  }

  private syncHeaderSearchFromUrl(): void {
    const tree = this.router.parseUrl(this.router.url);
    const primary = tree.root.children['primary'];
    const segments = primary?.segments ?? [];
    if (segments.length !== 1 || segments[0].path !== 'products') {
      return;
    }
    const rawQ = tree.queryParams['q'];
    if (typeof rawQ === 'string') {
      this.headerSearch = rawQ;
    } else if (Array.isArray(rawQ) && typeof rawQ[0] === 'string') {
      this.headerSearch = rawQ[0];
    } else {
      this.headerSearch = '';
    }
  }
}
