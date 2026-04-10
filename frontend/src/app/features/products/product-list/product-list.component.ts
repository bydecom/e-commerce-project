import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import type { Product } from '../../../shared/models/product.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [ProductCardComponent, PaginationComponent],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-8">
      <h1 class="text-2xl font-bold text-gray-900">Products</h1>
      <p class="mt-2 text-gray-600">Browse our catalog. Use search and filters to find what you need.</p>

      <div
        #productListTop
        class="scroll-mt-24"
        aria-hidden="true"
      ></div>

      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        @for (p of products; track p.id) {
          <app-product-card [product]="p" />
        }
      </div>
      <app-pagination
        [page]="page"
        [totalPages]="totalPages"
        (pageChange)="onPageChange($event)"
      />
    </div>
  `,
})
export class ProductListComponent {
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('productListTop') private readonly listTop?: ElementRef<HTMLElement>;

  products: Product[] = [];

  page = 1;
  totalPages = 1;

  onPageChange(nextPage: number): void {
    this.page = nextPage;
    if (!isPlatformBrowser(this.platformId)) return;
    queueMicrotask(() => {
      this.listTop?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}
