import { Component } from '@angular/core';

@Component({
  selector: 'app-order-list',
  standalone: true,
  template: `
    <div class="mx-auto max-w-4xl px-4 py-8">
      <h1 class="text-2xl font-bold text-gray-900">My orders</h1>
      <p class="mt-2 text-gray-600">List user orders — connect to <code>GET /api/orders/me</code>.</p>
    </div>
  `,
})
export class OrderListComponent {}
