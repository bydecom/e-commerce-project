import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-3xl px-4 py-12">
      <h1 class="text-3xl font-bold text-gray-900">Terms of service</h1>
      <p class="mt-2 text-sm text-gray-500">Last updated: {{ lastUpdated }}</p>

      <section class="mt-8 space-y-4 text-gray-700 leading-relaxed">
        <h2 class="text-lg font-semibold text-gray-900">Use of the service</h2>
        <p>
          By using this site you agree to follow applicable laws and not misuse the platform. We may
          suspend access for abuse, fraud, or security reasons.
        </p>

        <h2 class="text-lg font-semibold text-gray-900 pt-4">Orders and pricing</h2>
        <p>
          Prices and availability are subject to change. Orders are confirmed according to the
          checkout and order-status rules implemented in this project.
        </p>

        <h2 class="text-lg font-semibold text-gray-900 pt-4">Limitation of liability</h2>
        <p>
          To the extent permitted by law, we are not liable for indirect damages arising from use of
          the site.
        </p>

        <h2 class="text-lg font-semibold text-gray-900 pt-4">Questions</h2>
        <p>
          See our
          <a routerLink="/contact" class="text-blue-600 hover:underline">Contact us</a>
          page.
        </p>
      </section>
    </div>
  `,
})
export class TermsComponent {
  readonly lastUpdated = 'April 2026';
}
