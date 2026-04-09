import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-admin-product-form',
  standalone: true,
  template: `
    <h1 class="text-2xl font-bold text-gray-900">
      {{ isNew ? 'New product' : 'Edit product' }}
    </h1>
    <p class="mt-2 text-gray-600">
      @if (isNew) {
        Create a product — AI description helper here.
      } @else {
        Product ID: {{ id }} — update fields + AI description.
      }
    </p>
  `,
})
export class AdminProductFormComponent {
  readonly id: string | null;
  readonly isNew: boolean;

  constructor(route: ActivatedRoute) {
    const raw = route.snapshot.paramMap.get('id');
    this.isNew = raw === 'new';
    this.id = this.isNew ? null : raw;
  }
}
