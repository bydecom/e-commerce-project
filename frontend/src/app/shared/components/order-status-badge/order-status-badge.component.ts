import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-order-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="flex w-fit items-center border font-bold uppercase tracking-wide"
      [ngClass]="[statusColorClass, sizeClass]"
    >
      @switch (status) {
        @case ('PENDING') {
          <svg [class]="iconClass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        @case ('CONFIRMED') {
          <svg [class]="iconClass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        @case ('SHIPPING') {
          <svg [class]="iconClass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
            />
          </svg>
        }
        @case ('DONE') {
          <svg [class]="iconClass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        }
        @case ('CANCELLED') {
          <svg [class]="iconClass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        @default {
          <svg [class]="iconClass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
        }
      }
      <span>{{ statusLabel }}</span>
    </div>
  `,
})
export class OrderStatusBadgeComponent {
  @Input({ required: true }) status!: string;
  @Input() size: 'sm' | 'md' = 'md';

  get statusLabel(): string {
    switch (this.status) {
      case 'PENDING':
        return 'Pending';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'SHIPPING':
        return 'Shipping';
      case 'DONE':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return this.status;
    }
  }

  get statusColorClass(): string {
    switch (this.status) {
      case 'PENDING':
        return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'SHIPPING':
        return 'bg-indigo-100 text-indigo-600 border-indigo-200';
      case 'DONE':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'CANCELLED':
        return 'bg-gray-200 text-gray-600 border-gray-300';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  }

  get sizeClass(): string {
    if (this.size === 'sm') {
      return 'gap-1 rounded px-2 py-0.5 text-[10px]';
    }
    return 'gap-2 rounded-full px-3 py-1.5 text-xs';
  }

  get iconClass(): string {
    return this.size === 'sm' ? 'h-3 w-3 flex-shrink-0' : 'h-4 w-4 flex-shrink-0';
  }
}
