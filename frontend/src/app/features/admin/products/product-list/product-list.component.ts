import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-product-list',
  standalone: true,
  template: `
    <h1 class="text-2xl font-bold text-gray-900">Admin — Products</h1>
    <p class="mt-2 text-gray-600">CRUD products — link to product form for create/edit.</p>
  `,
})
export class AdminProductListComponent {}
