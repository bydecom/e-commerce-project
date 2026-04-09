import { Component } from '@angular/core';

@Component({
  selector: 'app-profile',
  standalone: true,
  template: `
    <div class="mx-auto max-w-2xl px-4 py-8">
      <h1 class="text-2xl font-bold text-gray-900">Profile</h1>
      <p class="mt-2 text-gray-600">Edit profile — <code>GET/PUT /api/users/me</code>.</p>
    </div>
  `,
})
export class ProfileComponent {}
