import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  template: `
    <div class="mx-auto max-w-4xl px-4 py-8">
      <h1 class="text-2xl font-bold text-gray-900">Product</h1>
      <p class="mt-2 text-gray-600">Product ID: {{ id }}</p>

      <p class="mt-6">
        <button
          type="button"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          (click)="scrollToReviews()"
        >
          View reviews
        </button>
      </p>

      <p class="mt-8 text-gray-600">
        Product images, price, description, and add to cart will appear here.
      </p>

      <section id="reviews" class="scroll-mt-24 border-t border-gray-200 pt-12">
        <h2 class="text-xl font-semibold text-gray-900">Reviews</h2>
        <p class="mt-2 text-gray-600">Customer reviews and ratings will be listed here.</p>
      </section>
    </div>
  `,
})
export class ProductDetailComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);

  readonly id = this.route.snapshot.paramMap.get('id');

  scrollToReviews(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
