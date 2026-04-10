import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  template: `
    <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
    <p class="mt-2 text-gray-600">
      Sales overview, charts, and operational metrics will appear here.
    </p>
  `,
})
export class AdminDashboardComponent {}
