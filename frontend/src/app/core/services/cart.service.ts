import { Injectable, PLATFORM_ID, afterNextRender, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface CartLine {
  productId: number;
  quantity: number;
  unitPrice: number;
  name: string;
}

const STORAGE_KEY = 'cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly linesSignal = signal<CartLine[]>([]);

  readonly lines = this.linesSignal.asReadonly();
  readonly itemCount = computed(() =>
    this.linesSignal().reduce((sum, l) => sum + l.quantity, 0)
  );
  readonly subtotal = computed(() =>
    this.linesSignal().reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  );

  constructor() {
    afterNextRender(() => {
      this.linesSignal.set(this.load());
    });
  }

  add(line: CartLine): void {
    const next = [...this.linesSignal()];
    const idx = next.findIndex((l) => l.productId === line.productId);
    if (idx >= 0) {
      next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity };
    } else {
      next.push(line);
    }
    this.linesSignal.set(next);
    this.save(next);
  }

  remove(productId: number): void {
    const next = this.linesSignal().filter((l) => l.productId !== productId);
    this.linesSignal.set(next);
    this.save(next);
  }

  clear(): void {
    this.linesSignal.set([]);
    this.save([]);
  }

  private load(): CartLine[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  }

  private save(lines: CartLine[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }
}
