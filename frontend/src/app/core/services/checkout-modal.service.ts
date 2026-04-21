import { Injectable, signal } from '@angular/core';

export type CheckoutModalPhase = 'confirm' | 'loading' | 'blocked';

export type CheckoutModalState =
  | { isOpen: false; phase: null; message: null }
  | { isOpen: true; phase: 'confirm'; message: null }
  | { isOpen: true; phase: 'loading'; message: null }
  | { isOpen: true; phase: 'blocked'; message: string };

@Injectable({ providedIn: 'root' })
export class CheckoutModalService {
  private readonly stateSignal = signal<CheckoutModalState>({
    isOpen: false,
    phase: null,
    message: null,
  });

  readonly state = this.stateSignal.asReadonly();

  openConfirm(): void {
    this.stateSignal.set({ isOpen: true, phase: 'confirm', message: null });
  }

  setLoading(): void {
    this.stateSignal.set({ isOpen: true, phase: 'loading', message: null });
  }

  showBlocked(message?: string): void {
    this.stateSignal.set({
      isOpen: true,
      phase: 'blocked',
      message:
        message?.trim() ||
        'Out of stock. Some items are no longer available. Please review the highlighted lines in your cart.',
    });
  }

  close(): void {
    this.stateSignal.set({ isOpen: false, phase: null, message: null });
  }
}

