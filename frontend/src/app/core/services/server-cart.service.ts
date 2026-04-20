import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';

export interface ServerCartItem {
  productId: number;
  quantity: number;
  name: string;
}

type CartViewData = { items: ServerCartItem[] };

@Injectable({ providedIn: 'root' })
export class ServerCartService {
  private readonly http = inject(HttpClient);

  private readonly itemsSignal = signal<ServerCartItem[]>([]);
  readonly items = this.itemsSignal.asReadonly();

  readonly itemCount = computed(() => this.itemsSignal().length);
  readonly hasItems = computed(() => this.itemCount() > 0);

  /** Fires after `refresh()` updates cart from `/api/cart` (skipped when `refresh({ silent: true })`). */
  private readonly cartUpdatedSource = new Subject<void>();
  readonly cartUpdated$ = this.cartUpdatedSource.asObservable();

  /**
   * Loads cart lines from `/api/cart` into `items`.
   * @param options.silent — do not emit `cartUpdated$` (avoids loops when callers already sync pricing, e.g. CartComponent.applyPricing).
   */
  refresh(options?: { silent?: boolean }) {
    const silent = options?.silent === true;
    return this.http.get<ApiSuccess<CartViewData>>(`${environment.apiUrl}/api/cart`).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      tap((d) => {
        this.itemsSignal.set(d.items);
        if (!silent) this.cartUpdatedSource.next();
      }),
      catchError(() => {
        // If not authenticated or API fails, avoid breaking the header.
        this.itemsSignal.set([]);
        if (!silent) this.cartUpdatedSource.next();
        return of(null);
      })
    );
  }
}

