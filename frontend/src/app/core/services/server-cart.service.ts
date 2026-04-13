import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';

type CartViewData = { items: Array<{ productId: number; quantity: number; name: string }> };

@Injectable({ providedIn: 'root' })
export class ServerCartService {
  private readonly http = inject(HttpClient);

  private readonly itemCountSignal = signal(0);
  readonly itemCount = this.itemCountSignal.asReadonly();

  readonly hasItems = computed(() => this.itemCountSignal() > 0);

  refresh() {
    return this.http.get<ApiSuccess<CartViewData>>(`${environment.apiUrl}/api/cart`).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      tap((d) => this.itemCountSignal.set(d.items.length)),
      catchError(() => {
        // If not authenticated or API fails, avoid breaking the header.
        this.itemCountSignal.set(0);
        return of(null);
      })
    );
  }
}

