import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-shipping-policy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-3xl px-4 py-12">
      <h1 class="text-3xl font-bold text-gray-900">Shipping &amp; returns</h1>
      <p class="mt-2 text-sm text-gray-500">Summary</p>

      <section class="mt-8 space-y-4 text-gray-700 leading-relaxed">
        <h2 class="text-lg font-semibold text-gray-900">Shipping</h2>
        <p>
          Orders are prepared after confirmation. Delivery times depend on your region and carrier.
          You will receive updates by email when the order status changes in the system.
        </p>

        <h2 class="text-lg font-semibold text-gray-900 pt-4">Returns</h2>
        <p>
          Return eligibility follows the order status and rules in your account. Contact support
          with your order ID for assistance.
        </p>

        <h2 class="text-lg font-semibold text-gray-900 pt-4">Support</h2>
        <p>
          <a routerLink="/contact" class="text-blue-600 hover:underline">Contact us</a>
          with your order ID for help.
        </p>
      </section>
    </div>
  `,
})
export class ShippingPolicyComponent {}
