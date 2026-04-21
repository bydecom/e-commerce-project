import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { CheckoutModalPhase } from '../../../core/services/checkout-modal.service';

@Component({
  selector: 'app-checkout-confirm-modal',
  standalone: true,
  imports: [NgClass],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" (click)="onBackdropClick()"></div>

        <div class="relative w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200">
          <div class="px-6 pt-6">
            <h2 class="text-lg font-bold text-gray-900">
              @if (phase === 'blocked') {
                Checkout unavailable
              } @else {
                Proceed to checkout?
              }
            </h2>

            <p class="mt-2 text-sm text-gray-600">
              @if (phase === 'confirm') {
                We'll check item availability before payment.
              } @else if (phase === 'loading') {
                Checking availability…
              } @else {
                {{ message || 'Out of stock.' }}
              }
            </p>

            @if (phase === 'loading') {
              <div class="mt-4 flex items-center gap-3 text-sm text-gray-700">
                <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900"></div>
                <span>Please wait…</span>
              </div>
            }
          </div>

          <div class="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
            @if (phase === 'confirm') {
              <button
                type="button"
                class="rounded-sm border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                (click)="cancel.emit()"
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-sm bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800"
                (click)="continue.emit()"
              >
                Continue
              </button>
            } @else if (phase === 'loading') {
              <button
                type="button"
                class="rounded-sm border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-400 shadow-sm cursor-not-allowed"
                disabled
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-sm bg-gray-300 px-4 py-2 text-sm font-bold text-gray-500 shadow-sm cursor-not-allowed"
                disabled
              >
                Continue
              </button>
            } @else {
              <button
                type="button"
                class="rounded-sm bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800"
                (click)="ok.emit()"
              >
                OK
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class CheckoutConfirmModalComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) phase: CheckoutModalPhase = 'confirm';
  @Input() message: string | null = null;

  @Output() cancel = new EventEmitter<void>();
  @Output() continue = new EventEmitter<void>();
  @Output() ok = new EventEmitter<void>();

  onBackdropClick(): void {
    if (this.phase === 'loading') return;
    if (this.phase === 'blocked') {
      this.ok.emit();
      return;
    }
    this.cancel.emit();
  }
}

