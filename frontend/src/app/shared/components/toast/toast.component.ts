import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, type ToastMessage } from '../../../core/services/toast.service';

interface ActiveToast extends ToastMessage {
  id: number;
}

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      @for (toast of toasts(); track toast.id) {
        <div
          class="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all"
          [class]="variantClass(toast.variant)"
        >
          <span>{{ toast.text }}</span>
          <button type="button" (click)="dismiss(toast.id)" class="ml-2 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastComponent implements OnInit, OnDestroy {
  private readonly toastService = inject(ToastService);
  private sub: Subscription | null = null;
  private counter = 0;

  toasts = signal<ActiveToast[]>([]);

  ngOnInit(): void {
    this.sub = this.toastService.messages$.subscribe((msg) => {
      const id = ++this.counter;
      this.toasts.update((list) => [...list, { ...msg, id }]);
      setTimeout(() => this.dismiss(id), 4000);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  variantClass(variant: ToastMessage['variant']): string {
    switch (variant) {
      case 'success':
        return 'bg-green-600 text-white';
      case 'error':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-800 text-white';
    }
  }
}
