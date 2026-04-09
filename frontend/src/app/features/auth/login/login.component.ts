import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="mx-auto max-w-md px-4 py-12">
      <h1 class="text-2xl font-bold text-gray-900">Login</h1>
      <p class="mt-2 text-sm text-gray-600">Wire to <code>AuthService.login()</code> when API is ready.</p>
      <form class="mt-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            [(ngModel)]="email"
            name="email"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            [(ngModel)]="password"
            name="password"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <button type="button" class="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700">
          Sign in
        </button>
      </form>
      <p class="mt-4 text-center text-sm text-gray-600">
        No account?
        <a routerLink="/register" class="text-blue-600 hover:underline">Register</a>
      </p>
    </div>
  `,
})
export class LoginComponent {
  email = '';
  password = '';
}
