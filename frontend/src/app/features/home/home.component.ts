import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-6xl px-4 py-12">
      <h1 class="text-3xl font-bold text-gray-900">Welcome</h1>
      <p class="mt-4 text-gray-600">Landing page — featured products and promotions go here.</p>
    </section>
  `,
})
export class HomeComponent {}
