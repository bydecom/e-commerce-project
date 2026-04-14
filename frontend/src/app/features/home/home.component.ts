import { Component, OnInit, inject, signal } from '@angular/core';
import type {
  LandingCategoryDto,
  LandingPageData,
  LandingProductDto,
} from '../../core/services/product-api.service';
import { ProductApiService } from '../../core/services/product-api.service';
import { HomeBestSellersSectionComponent } from './sections/home-best-sellers-section.component';
import { HomeCategoryRowSectionComponent } from './sections/home-category-row-section.component';
import { HomeHeroSectionComponent } from './sections/home-hero-section.component';
import { HomeLoadingSkeletonComponent } from './sections/home-loading-skeleton.component';
import { HomeReviewsSectionComponent } from './sections/home-reviews-section.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    HomeLoadingSkeletonComponent,
    HomeHeroSectionComponent,
    HomeReviewsSectionComponent,
    HomeBestSellersSectionComponent,
    HomeCategoryRowSectionComponent,
  ],
  template: `
    <div class="mx-auto max-w-6xl space-y-20 px-4 pb-20 pt-8">
      @if (loading()) {
        <app-home-loading-skeleton />
      } @else {
        <app-home-hero-section />

        @if (recentFeedbacks().length > 0) {
          <app-home-reviews-section [feedbacks]="recentFeedbacks()" />
        }

        <app-home-best-sellers-section [topSellers]="topSellers()" />

        @for (cat of categoriesData(); track cat.id) {
          <app-home-category-row-section [category]="cat" />
        }
      }
    </div>
  `,
})
export class HomeComponent implements OnInit {
  private readonly productApi = inject(ProductApiService);

  readonly loading = signal(true);
  readonly topSellers = signal<LandingProductDto[]>([]);
  readonly categoriesData = signal<LandingCategoryDto[]>([]);
  readonly recentFeedbacks = signal<LandingPageData['recentFeedbacks']>([]);

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
}
