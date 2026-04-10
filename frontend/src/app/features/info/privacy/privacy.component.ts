import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-3xl px-4 py-12">
      <h1 class="text-3xl font-bold text-gray-900">Privacy policy</h1>
      <p class="mt-2 text-sm text-gray-500">Last updated: {{ lastUpdated }}</p>

      <section class="mt-8 space-y-4 text-gray-700 leading-relaxed">
        <h2 class="text-lg font-semibold text-gray-900">Information we collect</h2>
        <p>
          We may collect account details (name, email), order and shipping information, and basic
          usage data required to run the store and improve the service.
        </p>

        <h2 class="text-lg font-semibold text-gray-900 pt-4">How we use information</h2>
        <p>
          Data is used to process orders, communicate about purchases, prevent fraud, and comply
          with legal obligations. We do not sell your personal information to third parties.
        </p>

        <h2 class="text-lg font-semibold text-gray-900 pt-4">Cookies</h2>
        <p>
          The site may use essential cookies for authentication and cart functionality. You can
          control cookies through your browser settings.
        </p>

        <h2 class="text-lg font-semibold text-gray-900 pt-4">Contact</h2>
        <p>
          For privacy-related requests, contact us through the
          <a routerLink="/contact" class="text-blue-600 hover:underline">Contact us</a> page.
        </p>
      </section>
    </div>
  `,
})
export class PrivacyComponent {
  readonly lastUpdated = 'April 2026';
}
