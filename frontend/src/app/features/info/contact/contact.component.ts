import { Component } from '@angular/core';
import { FOOTER_CONTACT } from '../../../shared/constants/footer-contact';

@Component({
  selector: 'app-contact',
  standalone: true,
  template: `
    <div class="mx-auto max-w-3xl px-4 py-12">
      <h1 class="text-3xl font-bold text-gray-900">Contact us</h1>
      <p class="mt-4 text-gray-600">
        Reach out for order questions, partnerships, or technical support.
      </p>
      <ul class="mt-8 space-y-3 text-gray-800">
        <li>
          <span class="font-medium text-gray-700">Email:</span>
          <a [href]="'mailto:' + contact.email" class="ml-2 text-blue-600 hover:underline">{{
            contact.email
          }}</a>
        </li>
        <li>
          <span class="font-medium text-gray-700">Phone:</span>
          <a [href]="'tel:' + contact.phoneDial" class="ml-2 text-blue-600 hover:underline">{{
            contact.phone
          }}</a>
        </li>
        <li>
          <span class="font-medium text-gray-700">Address:</span>
          <span class="ml-2">{{ contact.address }}</span>
        </li>
        <li>
          <span class="font-medium text-gray-700">Hours:</span>
          <span class="ml-2">{{ contact.hours }}</span>
        </li>
      </ul>
    </div>
  `,
})
export class ContactComponent {
  readonly contact = FOOTER_CONTACT;
}
