import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess, PaginationMeta } from '../../shared/models/api-response.model';
import type { OrderDetail, OrderStatus } from '../../shared/models/order.model';

function mapHttpError(err: HttpErrorResponse) {
  const body = err.error as { message?: string } | undefined;
  const msg = typeof body?.message === 'string' ? body.message : err.message;
  return throwError(() => new Error(msg));
}

export interface CreateOrderBody {
  userId: number;
  items: Array<{ productId: number; quantity: number }>;
  shippingAddress: string;
}

export interface AdminOrderListParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/orders`;

  /** POST /orders — không JWT: body phải có userId. */
  create(body: CreateOrderBody): Observable<OrderDetail> {
    return this.http.post<ApiSuccess<OrderDetail>>(this.baseUrl, body).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data as OrderDetail;
      }),
      catchError(mapHttpError)
    );
  }

  /** GET /orders/me?userId= — không JWT: bắt buộc userId. */
  listMine(userId: number, params: { page?: number; limit?: number; status?: OrderStatus } = {}): Observable<{
    data: OrderDetail[];
    meta: PaginationMeta;
  }> {
    let httpParams = new HttpParams().set('userId', String(userId));
    if (params.page !== undefined) httpParams = httpParams.set('page', String(params.page));
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http.get<ApiSuccess<OrderDetail[]>>(`${this.baseUrl}/me`, { params: httpParams }).pipe(
      map((r) => {
        if (!r.success || !r.meta) throw new Error(r.message);
        return { data: r.data, meta: r.meta };
      }),
      catchError(mapHttpError)
    );
  }

  getMine(userId: number, orderId: number): Observable<OrderDetail> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http.get<ApiSuccess<OrderDetail>>(`${this.baseUrl}/me/${orderId}`, { params }).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(mapHttpError)
    );
  }

  cancelMine(userId: number, orderId: number): Observable<OrderDetail> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http
      .patch<ApiSuccess<OrderDetail>>(`${this.baseUrl}/me/${orderId}/cancel`, {}, { params })
      .pipe(
        map((r) => {
          if (!r.success) throw new Error(r.message);
          return r.data;
        }),
        catchError(mapHttpError)
      );
  }

  listAdmin(params: AdminOrderListParams = {}): Observable<{ data: OrderDetail[]; meta: PaginationMeta }> {
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', String(params.page));
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<ApiSuccess<OrderDetail[]>>(this.baseUrl, { params: httpParams }).pipe(
      map((r) => {
        if (!r.success || !r.meta) throw new Error(r.message);
        return { data: r.data, meta: r.meta };
      }),
      catchError(mapHttpError)
    );
  }

  getAdmin(orderId: number): Observable<OrderDetail> {
    return this.http.get<ApiSuccess<OrderDetail>>(`${this.baseUrl}/${orderId}`).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(mapHttpError)
    );
  }

  updateStatus(orderId: number, status: OrderStatus): Observable<OrderDetail> {
    return this.http
      .patch<ApiSuccess<OrderDetail>>(`${this.baseUrl}/${orderId}/status`, { status })
      .pipe(
        map((r) => {
          if (!r.success) throw new Error(r.message);
          return r.data;
        }),
        catchError(mapHttpError)
      );
  }
}
