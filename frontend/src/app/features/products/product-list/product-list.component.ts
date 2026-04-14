import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { ProductApiService, type CategoryDto } from '../../../core/services/product-api.service';
import {
  ShopBrowseDraftService,
  normalizeDateSortParam,
  normalizePriceSortParam,
  parseCatsQueryParam,
  type ShopDateSort,
  type ShopPriceSort,
} from '../../../core/services/shop-browse-draft.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import type { Product } from '../../../shared/models/product.model';

interface BrowseRouteState {
  q: string;
  cats: number[];
  dateSort: ShopDateSort;
  priceSort: ShopPriceSort;
  page: number;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [ProductCardComponent, PaginationComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent implements OnInit, OnDestroy {
  private readonly api = inject(ProductApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browseDraft = inject(ShopBrowseDraftService);

  @ViewChild('productListTop') private readonly listTop?: ElementRef<HTMLElement>;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly products = signal<Product[]>([]);
  readonly categories = signal<CategoryDto[]>([]);
  readonly meta = signal<{ page: number; totalPages: number; total: number } | null>(null);

  /** Keyword from `?q=`. Empty = no name filter. */
  readonly searchQuery = signal('');

  /** Applied filters (API + pagination) — updated only from URL. */
  private appliedCategoryIds = new Set<number>();
  appliedDateSort: ShopDateSort = 'newest';
  appliedPriceSort: ShopPriceSort = 'any';

  /** Sidebar / sort UI — draft until header search applies via URL. */
  readonly draftCategoryIds = signal<Set<number>>(new Set());
  draftDateSort: ShopDateSort = 'newest';
  draftPriceSort: ShopPriceSort = 'any';

  readonly skeletonPlaceholders = Array.from({ length: 6 });

  page = 1;
  readonly limit = 12;

  private listSub?: Subscription;
  private routeSub?: Subscription;

  ngOnInit(): void {
    this.api.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => this.categories.set([]),
    });

    this.routeSub = this.route.queryParamMap
      .pipe(
        map((pm): BrowseRouteState => ({
          q: pm.get('q')?.trim() ?? '',
          cats: parseCatsQueryParam(pm.get('cats')),
          dateSort: normalizeDateSortParam(pm.get('dateSort')),
          priceSort: normalizePriceSortParam(pm.get('priceSort')),
          page: Math.max(1, parseInt(pm.get('page') || '1', 10) || 1),
        })),
        distinctUntilChanged(
          (a, b) =>
            a.q === b.q &&
            a.dateSort === b.dateSort &&
            a.priceSort === b.priceSort &&
            a.page === b.page &&
            a.cats.length === b.cats.length &&
            a.cats.every((id, i) => id === b.cats[i])
        )
      )
      .subscribe((state) => {
        this.searchQuery.set(state.q);
        this.appliedCategoryIds = new Set(state.cats);
        this.draftCategoryIds.set(new Set(state.cats));
        this.appliedDateSort = this.draftDateSort = state.dateSort;
        this.appliedPriceSort = this.draftPriceSort = state.priceSort;
        this.browseDraft.setFromRoute(state.cats, state.dateSort, state.priceSort);
        this.page = state.page;
        this.load();
      });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.listSub?.unsubscribe();
  }

  categoryDraftChecked(id: number): boolean {
    return this.draftCategoryIds().has(id);
  }

  toggleCategoryDraft(id: number, checked: boolean): void {
    const next = new Set(this.draftCategoryIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.draftCategoryIds.set(next);
    this.browseDraft.setCategoryIds([...next]);
  }

  onDraftDateSortChange(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    if (v === 'newest' || v === 'oldest') {
      this.draftDateSort = v;
      this.browseDraft.setDateSort(v);
    }
  }

  onDraftPriceSortChange(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    if (v === 'any' || v === 'asc' || v === 'desc') {
      this.draftPriceSort = v;
      this.browseDraft.setPriceSort(v);
    }
  }

  onPageChange(nextPage: number): void {
    // Navigate so router scroll restoration kicks in (configured in app.config.ts).
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: nextPage },
      queryParamsHandling: 'merge',
    });
  }

  retry(): void {
    this.load();
  }

  resetRefinements(): void {
    this.router.navigate(['/products'], {
      queryParams: {
        q: null,
        cats: null,
        dateSort: 'newest',
        priceSort: 'any',
        page: null,
      },
    });
  }

  applyFilters(): void {
    this.router.navigate(['/products'], {
      queryParams: {
        q: this.searchQuery() || null,
        cats: this.draftCategoryIds().size ? [...this.draftCategoryIds()].join(',') : null,
        dateSort: this.draftDateSort,
        priceSort: this.draftPriceSort,
        page: null,
      },
    });
  }

  private resolveApiSort(): 'newest' | 'oldest' | 'price_asc' | 'price_desc' {
    if (this.appliedPriceSort !== 'any') {
      return this.appliedPriceSort === 'asc' ? 'price_asc' : 'price_desc';
    }
    return this.appliedDateSort === 'oldest' ? 'oldest' : 'newest';
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.meta.set(null);
    this.listSub?.unsubscribe();

    const q = this.searchQuery().trim();
    const ids = [...this.appliedCategoryIds];

    this.listSub = this.api
      .list({
        page: this.page,
        limit: this.limit,
        search: q || undefined,
        categoryIds: ids.length ? ids : undefined,
        sort: this.resolveApiSort(),
        status: 'AVAILABLE',
      })
      .subscribe({
        next: ({ data, meta }) => {
          this.products.set(data);
          this.meta.set({ page: meta.page, totalPages: meta.totalPages, total: meta.total });
          this.loading.set(false);
        },
        error: (e: Error) => {
          this.error.set(e.message ?? 'Something went wrong');
          this.loading.set(false);
        },
      });
  }
}
