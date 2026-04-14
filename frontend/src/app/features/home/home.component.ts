import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductApiService } from '../../core/services/product-api.service';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { CurrencyVndPipe } from '../../shared/pipes/currency-vnd.pipe';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CurrencyVndPipe, ProductCardComponent],
  template: `
    <div class="mx-auto max-w-6xl space-y-20 px-4 pb-20 pt-8">
      @if (loading()) {
        <div class="animate-pulse space-y-10">
          <div class="h-[500px] rounded-3xl bg-gray-200"></div>
          <div class="space-y-4">
            <div class="h-7 w-56 rounded bg-gray-200"></div>
            <div class="h-4 w-80 rounded bg-gray-100"></div>
          </div>
          <div class="grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-4">
            <div class="md:col-span-2 md:row-span-2 h-[420px] rounded-2xl bg-gray-200"></div>
            <div class="h-64 rounded-2xl bg-gray-200"></div>
            <div class="h-64 rounded-2xl bg-gray-200"></div>
            <div class="h-64 rounded-2xl bg-gray-200"></div>
          </div>
        </div>
      } @else {
        <section class="relative h-[500px] overflow-hidden rounded-3xl bg-gray-900 text-white">
          <div
            class="absolute inset-0 bg-cover bg-center opacity-50"
            style="background-image: url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1600&q=80');"
          ></div>
          <div class="relative z-10 flex h-full flex-col justify-center px-10">
            <h1 class="max-w-2xl text-5xl font-extrabold leading-tight md:text-6xl">
              Future Tech, <br /><span class="text-indigo-400">Today.</span>
            </h1>
            <p class="mt-4 max-w-lg text-lg text-gray-300">
              Experience the next generation of devices curated just for you.
            </p>
            <a
              routerLink="/products"
              class="mt-8 w-fit rounded-full bg-white px-8 py-3 font-bold text-gray-900 transition-transform hover:scale-105 hover:bg-gray-100"
            >
              Shop Collection
            </a>
          </div>
        </section>

        @if (recentFeedbacks().length > 0) {
          <section class="rounded-3xl bg-gray-50/80 p-8 md:p-12">
            <div class="mb-10 flex flex-col items-center text-center">
              <h2 class="text-3xl font-bold text-gray-900">What Our Customers Say</h2>
              <p class="mt-2 max-w-2xl text-gray-500">
                Don't just take our word for it. Hear from the people who use our products every day.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
              @for (fb of recentFeedbacks(); track fb.id) {
                <div
                  class="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div>
                    <div class="flex items-center gap-1 text-amber-400">
                      @for (s of ratingStars(fb.rating); track i; let i = $index) {
                        <svg
                          class="h-5 w-5"
                          [class.text-gray-200]="!s"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                          />
                        </svg>
                      }
                    </div>
                    <p class="mt-4 text-sm italic leading-relaxed text-gray-700">"{{ fb.comment }}"</p>
                  </div>

                  <div class="mt-6 border-t border-gray-50 pt-4">
                    <p class="font-bold text-gray-900">{{ fb.user?.name || 'Anonymous Buyer' }}</p>
                    <p class="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                      Reviewed: <span class="text-indigo-600">{{ fb.product?.name }}</span>
                    </p>
                  </div>
                </div>
              }
            </div>
          </section>
        }

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
                class="group relative block cursor-pointer overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-shadow duration-500 hover:shadow-xl md:col-span-2 md:row-span-2"
              >
                <img
                  [src]="topSellers()[0].imageUrl"
                  class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  alt=""
                />

                <div class="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/20 to-transparent"></div>

                <div
                  class="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/40 opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:opacity-100"
                >
                  <span
                    class="translate-y-4 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-gray-900 shadow-2xl transition-all duration-500 group-hover:translate-y-0"
                  >
                    View details
                  </span>
                </div>

                <div
                  class="absolute bottom-0 left-0 z-20 flex w-full flex-col justify-end p-8 transition-transform duration-500 group-hover:-translate-y-2"
                >
                  <span
                    class="mb-4 w-fit rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-sm"
                  >
                    Top #1 Best Seller
                  </span>
                  <h3 class="text-3xl font-bold text-white drop-shadow-md">{{ topSellers()[0].name }}</h3>
                  <p class="mt-2 text-xl font-semibold text-white/90 drop-shadow-md">
                    {{ topSellers()[0].price | currencyVnd }}
                  </p>
                </div>
              </a>

              @for (p of topSellers().slice(1); track p.id) {
                <app-product-card [product]="p" />
              }
            }
          </div>
        </section>

        @for (cat of categoriesData(); track cat.id) {
          <section>
            <div class="mb-8 flex items-center justify-between">
              <h2 class="text-2xl font-bold text-gray-900">{{ cat.name }}</h2>
              <a
                [routerLink]="['/products']"
                [queryParams]="{ categoryId: cat.id }"
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
              @for (p of cat.products; track p.id) {
                <app-product-card [product]="p" />
              }
            </div>
          </section>
        }
      }
    </div>
  `,
})
export class HomeComponent implements OnInit {
  private readonly productApi = inject(ProductApiService);

  readonly loading = signal(true);
  readonly topSellers = signal<any[]>([]);
  readonly categoriesData = signal<any[]>([]);
  readonly recentFeedbacks = signal<any[]>([]);

  ngOnInit(): void {
    this.fetchHomeData();
  }

  fetchHomeData(): void {
    this.loading.set(true);
    this.productApi.getLandingPage().subscribe({
      next: (data) => {
        this.topSellers.set(data.topSellers ?? []);
        this.categoriesData.set(data.categoriesWithProducts ?? []);
        this.recentFeedbacks.set(data.recentFeedbacks ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  ratingStars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < rating);
  }
}
