import { Component } from '@angular/core';
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
      <p class="mt-2 text-gray-600">Search, filter, pagination — connect to API later.</p>
      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        @for (p of demo; track p.id) {
          <app-product-card [product]="p" />
        }
      </div>
      <app-pagination [page]="1" [totalPages]="1" />
    </div>
  `,
})
export class ProductListComponent {
  /** Placeholder until HTTP service exists */
  demo: Product[] = [];
}
