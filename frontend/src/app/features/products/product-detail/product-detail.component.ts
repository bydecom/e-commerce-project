import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  template: `
    <div class="mx-auto max-w-4xl px-4 py-8">
      <h1 class="text-2xl font-bold text-gray-900">Product detail</h1>
      <p class="mt-2 text-gray-600">ID: {{ id }} — load product + AI recommendations here.</p>
    </div>
  `,
})
export class ProductDetailComponent {
  id: string | null;

  constructor(route: ActivatedRoute) {
    this.id = route.snapshot.paramMap.get('id');
  }
}
