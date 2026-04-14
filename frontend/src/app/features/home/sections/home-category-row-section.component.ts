import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LandingCategoryDto } from '../../../core/services/product-api.service';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import type { Product } from '../../../shared/models/product.model';

@Component({
  selector: 'app-home-category-row-section',
  standalone: true,
  imports: [RouterLink, ProductCardComponent],
  template: `
    <section>
      <div class="py-8 flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900">{{ category().name }}</h2>
        <a
          [routerLink]="['/products']"
          [queryParams]="{ q: null, cats: category().id, priceSort: 'any', page: null }"
          class="group flex items-center gap-1 text-sm font-bold text-indigo-600"
        >
          Explore More
          <svg
            class="h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
      <div class="grid grid-cols-2 gap-6 md:grid-cols-4">
        @for (p of category().products; track p.id) {
          <app-product-card [product]="asProduct(p)" />
        }
      </div>
    </section>
  `,
})
export class HomeCategoryRowSectionComponent {
  readonly category = input.required<LandingCategoryDto>();

  asProduct(p: LandingCategoryDto['products'][number]): Product {
    return p as unknown as Product;
  }
}
