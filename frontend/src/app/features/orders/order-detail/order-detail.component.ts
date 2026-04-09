import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  template: `
    <div class="mx-auto max-w-4xl px-4 py-8">
      <h1 class="text-2xl font-bold text-gray-900">Order detail</h1>
      <p class="mt-2 text-gray-600">Order ID: {{ id }} — status tracking + cancel.</p>
    </div>
  `,
})
export class OrderDetailComponent {
  id: string | null;

  constructor(route: ActivatedRoute) {
    this.id = route.snapshot.paramMap.get('id');
  }
}
