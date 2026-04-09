import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-feedback-list',
  standalone: true,
  template: `
    <h1 class="text-2xl font-bold text-gray-900">Admin — Feedbacks</h1>
    <p class="mt-2 text-gray-600">List feedbacks with sentiment badges.</p>
  `,
})
export class AdminFeedbackListComponent {}
