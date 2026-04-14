import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LandingPageData } from '../../../core/services/product-api.service';

type ReviewItem = LandingPageData['recentFeedbacks'][number];

@Component({
  selector: 'app-home-reviews-section',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="rounded-3xl bg-gray-50/80 p-8 md:p-12">
      <div class="mb-10 flex flex-col items-center text-center">
        <h2 class="text-3xl font-bold text-gray-900">What Our Customers Say</h2>
        <p class="mt-2 max-w-2xl text-gray-500">
          Don't just take our word for it. Hear from the people who use our products every day.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
        @for (fb of feedbacks(); track fb.id) {
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

            <div class="mt-6 flex items-end justify-between gap-3 border-t border-gray-50 pt-4">
              <div class="min-w-0">
                <p class="truncate font-bold text-gray-900">{{ fb.user?.name || 'Anonymous Buyer' }}</p>
                <p class="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Reviewed: <span class="text-indigo-600">{{ fb.product?.name }}</span>
                </p>
              </div>
              <a
                [routerLink]="['/products', fb.product?.id]"
                class="group flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                View
                <svg
                  class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class HomeReviewsSectionComponent {
  /** Reviews to display (non-empty — parent should use @if). */
  readonly feedbacks = input.required<ReviewItem[]>();

  ratingStars(rating: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < rating);
  }
}
