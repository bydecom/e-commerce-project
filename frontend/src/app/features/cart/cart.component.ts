import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyVndPipe } from '../../shared/pipes/currency-vnd.pipe';
import { CartService } from '../../core/services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [RouterLink, CurrencyVndPipe],
  template: `
    <div class="mx-auto max-w-3xl px-4 py-8">
      <h1 class="text-2xl font-bold text-gray-900">Cart</h1>
      @if (cart.lines().length === 0) {
        <p class="mt-4 text-gray-600">Your cart is empty.</p>
        <a routerLink="/products" class="mt-4 inline-block text-blue-600 hover:underline">Continue shopping</a>
      } @else {
        <ul class="mt-6 divide-y rounded-lg border border-gray-200">
          @for (line of cart.lines(); track line.productId) {
            <li class="flex justify-between py-4">
              <span>{{ line.name }} × {{ line.quantity }}</span>
              <span>{{ line.unitPrice * line.quantity | currencyVnd }}</span>
            </li>
          }
        </ul>
        <p class="mt-4 text-right text-lg font-semibold">
          Total: {{ cart.subtotal() | currencyVnd }}
        </p>
        <a
          routerLink="/checkout"
          class="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700"
        >
          Checkout
        </a>
      }
    </div>
  `,
})
export class CartComponent {
  readonly cart = inject(CartService);
}
