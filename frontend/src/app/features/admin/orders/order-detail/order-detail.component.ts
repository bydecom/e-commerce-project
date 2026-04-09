import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  template: `
    <h1 class="text-2xl font-bold text-gray-900">Admin — Order detail</h1>
    <p class="mt-2 text-gray-600">Order ID: {{ id }} — update status transitions.</p>
  `,
})
export class AdminOrderDetailComponent {
  id: string | null;

  constructor(route: ActivatedRoute) {
    this.id = route.snapshot.paramMap.get('id');
  }
}
