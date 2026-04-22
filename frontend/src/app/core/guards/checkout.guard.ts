import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';
import { ToastService } from '../services/toast.service';
import { CheckoutBlockService, type CheckoutBlockItem, type CheckoutBlockReason } from '../services/checkout-block.service';
import { CheckoutSessionService } from '../services/checkout-session.service';
import { CheckoutModalService } from '../services/checkout-modal.service';

function parseCheckoutBlock(err: unknown): { reason: CheckoutBlockReason; items: CheckoutBlockItem[] } | null {
  const e = err as Partial<HttpErrorResponse> & { error?: any };
  const reason = e?.error?.errors?.reason as CheckoutBlockReason | undefined;
  const items = e?.error?.errors?.items as CheckoutBlockItem[] | undefined;
  if ((reason === 'OUT_OF_STOCK' || reason === 'TEMPORARILY_HELD') && Array.isArray(items) && items.length > 0) {
    return { reason, items };
  }
  return null;
}

export const checkoutGuard: CanActivateFn = () => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const toast = inject(ToastService);
  const block = inject(CheckoutBlockService);
  const session = inject(CheckoutSessionService);
  const modal = inject(CheckoutModalService);

  // Clear previous checkout session on new entry attempt.
  session.clear();

  return http.post<ApiSuccess<{ txnRef: string; ttlSeconds: number }>>(`${environment.apiUrl}/api/payments/vnpay/reserve`, {}).pipe(
    map((r) => {
      if (!r.success) throw new Error(r.message);
      const txnRef = r.data?.txnRef;
      const ttlSeconds = r.data?.ttlSeconds;
      if (typeof txnRef !== 'string' || !txnRef.trim() || typeof ttlSeconds !== 'number' || ttlSeconds <= 0) {
        throw new Error('Invalid checkout session');
      }
      session.set({ txnRef: txnRef.trim(), ttlSeconds });
      block.clear();
      return true;
    }),
    catchError((err) => {
      const parsed = parseCheckoutBlock(err);
      if (parsed) {
        block.set(parsed);
        toast.show('Out of stock.', 'error');
        modal.showBlocked();
      } else {
        const msg = err instanceof Error ? err.message : 'Checkout is not available';
        toast.show(msg, 'error');
        modal.close();
      }
      return of(router.createUrlTree(['/cart']));
    })
  );
};

