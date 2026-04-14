import { Component } from '@angular/core';

@Component({
  selector: 'app-home-loading-skeleton',
  standalone: true,
  template: `
    <div class="animate-pulse space-y-10">
      <div class="h-[500px] rounded-3xl bg-gray-200"></div>
      <div class="space-y-4">
        <div class="h-7 w-56 rounded bg-gray-200"></div>
        <div class="h-4 w-80 rounded bg-gray-100"></div>
      </div>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-4">
        <div class="h-[420px] rounded-2xl bg-gray-200 md:col-span-2 md:row-span-2"></div>
        <div class="h-64 rounded-2xl bg-gray-200"></div>
        <div class="h-64 rounded-2xl bg-gray-200"></div>
        <div class="h-64 rounded-2xl bg-gray-200"></div>
      </div>
    </div>
  `,
})
export class HomeLoadingSkeletonComponent {}
