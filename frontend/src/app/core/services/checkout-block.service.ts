import { Injectable, signal } from '@angular/core';

export type CheckoutBlockReason = 'OUT_OF_STOCK' | 'TEMPORARILY_HELD';

export type CheckoutBlockItem = {
  productId: number;
  requestedQuantity: number;
  availableStock: number;
  holdTtlSeconds?: number;
};

export type CheckoutBlock = {
  reason: CheckoutBlockReason;
  items: CheckoutBlockItem[];
  createdAtMs: number;
};

@Injectable({ providedIn: 'root' })
export class CheckoutBlockService {
  private readonly blockSignal = signal<CheckoutBlock | null>(null);
  readonly block = this.blockSignal.asReadonly();

  set(block: Omit<CheckoutBlock, 'createdAtMs'>): void {
    this.blockSignal.set({ ...block, createdAtMs: Date.now() });
  }

  clear(): void {
    this.blockSignal.set(null);
  }
}

