import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  template: `
    <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
    <p class="mt-2 text-gray-600">KPIs, charts, AI advisor — wire to <code>/api/dashboard/*</code>.</p>
  `,
})
export class AdminDashboardComponent {}
