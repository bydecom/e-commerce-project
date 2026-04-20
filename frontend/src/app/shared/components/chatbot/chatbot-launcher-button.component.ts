import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-chatbot-launcher-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      (click)="toggle.emit()"
      class="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-xl transition-transform hover:scale-105 focus:outline-none ring-4 ring-indigo-50"
      [ngClass]="{ 'bg-indigo-600 ring-indigo-100': open }"
    >
      @if (open) {
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      } @else {
        <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      }
    </button>
  `,
})
export class ChatbotLauncherButtonComponent {
  @Input({ required: true }) open = false;
  @Output() toggle = new EventEmitter<void>();
}
