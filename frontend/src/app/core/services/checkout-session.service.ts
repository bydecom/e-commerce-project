import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type CheckoutSession = {
  txnRef: string;
  ttlSeconds: number;
  createdAtMs: number;
};

const STORAGE_KEY = 'checkout_session_vnpay';

@Injectable({ providedIn: 'root' })
export class CheckoutSessionService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly sessionSignal = signal<CheckoutSession | null>(this.readStored());
  readonly session = this.sessionSignal.asReadonly();

  set(session: Omit<CheckoutSession, 'createdAtMs'>): void {
    const next: CheckoutSession = { ...session, createdAtMs: Date.now() };
    this.sessionSignal.set(next);
    this.persist(next);
  }

  clear(): void {
    this.sessionSignal.set(null);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private persist(session: CheckoutSession): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
  }

  private readStored(): CheckoutSession | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CheckoutSession;
      if (!parsed?.txnRef || typeof parsed.txnRef !== 'string') return null;
      if (!Number.isFinite(parsed.ttlSeconds) || parsed.ttlSeconds <= 0) return null;
      if (!Number.isFinite(parsed.createdAtMs) || parsed.createdAtMs <= 0) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

