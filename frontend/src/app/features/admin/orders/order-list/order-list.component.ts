import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-order-list',
  standalone: true,
  template: `
    <h1 class="text-2xl font-bold text-gray-900">Admin — Orders</h1>
    <p class="mt-2 text-gray-600">All orders — filter by status.</p>
  `,
})
export class AdminOrderListComponent {}
