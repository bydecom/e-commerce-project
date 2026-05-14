import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LandingProductDto } from '../../../core/services/product-api.service';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { CurrencyVndPipe } from '../../../shared/pipes/currency-vnd.pipe';
import type { Product } from '../../../shared/models/product.model';

@Component({
  selector: 'app-home-best-sellers-section',
  standalone: true,
  imports: [RouterLink, CurrencyVndPipe, ProductCardComponent],
  template: `
    <section>
      <div class="mb-10 flex items-end justify-between">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Best Sellers</h2>
          <p class="mt-2 text-gray-500">The most loved products by our community.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-4">
        @if (topSellers().length > 0) {
          <a
            [routerLink]="['/products', topSellers()[0].id]"
            class="group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-all duration-500 hover:shadow-xl md:col-span-2 md:row-span-2"
          >
            <div class="relative flex-1 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
              <img
                [src]="topSellers()[0].imageUrl"
                class="h-full w-full object-contain p-8 transition-transform duration-700 group-hover:scale-105"
                alt=""
              />

              <div class="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent"></div>

              <div
                class="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/20 opacity-0 backdrop-blur-[2px] transition-all duration-500 group-hover:opacity-100"
              >
                <span
                  class="translate-y-4 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-gray-900 shadow-2xl transition-all duration-500 group-hover:translate-y-0"
                >
                  View details
                </span>
              </div>
            </div>

            <div
              class="absolute bottom-0 left-0 z-20 flex w-full flex-col justify-end p-8 transition-transform duration-500 group-hover:-translate-y-1"
            >
              <span
                class="mb-4 w-fit rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-sm"
              >
                Top #1 Best Seller
              </span>
              <h3 class="text-3xl font-bold text-white drop-shadow-lg">{{ topSellers()[0].name }}</h3>
              <p class="mt-2 text-xl font-semibold text-white/90 drop-shadow-md">
                {{ topSellers()[0].price | currencyVnd }}
              </p>
            </div>
          </a>

          @for (p of topSellers().slice(1); track p.id) {
            <app-product-card [product]="asProduct(p)" />
          }
        }
      </div>
    </section>
  `,
})
export class HomeBestSellersSectionComponent {
  readonly topSellers = input.required<LandingProductDto[]>();

  /** Landing DTO is missing some Product fields — runtime is sufficient for the card. */
  asProduct(p: LandingProductDto): Product {
    return p as unknown as Product;
  }
}
