import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, of, tap } from 'rxjs';
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

  refresh() {
    return this.http.get<ApiSuccess<CartViewData>>(`${environment.apiUrl}/api/cart`).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      tap((d) => this.itemsSignal.set(d.items)),
      catchError(() => {
        // If not authenticated or API fails, avoid breaking the header.
        this.itemsSignal.set([]);
        return of(null);
      })
    );
  }
}

