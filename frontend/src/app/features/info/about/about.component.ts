import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  template: `
    <div class="mx-auto max-w-3xl px-4 py-12">
      <h1 class="text-3xl font-bold text-gray-900">About us</h1>
      <p class="mt-4 text-gray-600 leading-relaxed">
        We focus on a clear shopping experience, reliable checkout, and tools for your team to
        manage products, categories, and orders from one place.
      </p>
      <p class="mt-4 text-gray-600 leading-relaxed">
        Product availability and pricing may change. For the latest information, refer to the
        product pages and your order confirmations.
      </p>
    </div>
  `,
})
export class AboutComponent {}
