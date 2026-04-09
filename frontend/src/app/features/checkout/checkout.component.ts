import { Component } from '@angular/core';

@Component({
  selector: 'app-checkout',
  standalone: true,
  template: `
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="text-2xl font-bold text-gray-900">Checkout</h1>
      <p class="mt-2 text-gray-600">Shipping address + place order — implement with Order API.</p>
    </div>
  `,
})
export class CheckoutComponent {}
