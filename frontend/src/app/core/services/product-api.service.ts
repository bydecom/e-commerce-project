import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess, PaginationMeta } from '../../shared/models/api-response.model';
import type { Product, ProductStatus } from '../../shared/models/product.model';

export interface CategoryDto {
  id: number;
  name: string;
}

function mapHttpError(err: HttpErrorResponse) {
  const body = err.error as { message?: string } | undefined;
  const msg = typeof body?.message === 'string' ? body.message : err.message;
  return throwError(() => new Error(msg));
}

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest';
  status?: ProductStatus;
}

@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private readonly http = inject(HttpClient);
  private readonly productsUrl = `${environment.apiUrl}/api/products`;
  private readonly categoriesUrl = `${environment.apiUrl}/api/categories`;

  getCategories(): Observable<CategoryDto[]> {
    return this.http.get<ApiSuccess<CategoryDto[]>>(this.categoriesUrl).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(mapHttpError)
    );
  }

  list(params: ProductListParams = {}): Observable<{ data: Product[]; meta: PaginationMeta }> {
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', String(params.page));
    if (params.limit !== undefined) httpParams = httpParams.set('limit', String(params.limit));
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.categoryId !== undefined) httpParams = httpParams.set('categoryId', String(params.categoryId));
    if (params.minPrice !== undefined) httpParams = httpParams.set('minPrice', String(params.minPrice));
    if (params.maxPrice !== undefined) httpParams = httpParams.set('maxPrice', String(params.maxPrice));
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http.get<ApiSuccess<Product[]>>(this.productsUrl, { params: httpParams }).pipe(
      map((r) => {
        if (!r.success || !r.meta) throw new Error(r.message);
        return { data: r.data, meta: r.meta };
      }),
      catchError(mapHttpError)
    );
  }

  getById(id: number): Observable<Product> {
    return this.http.get<ApiSuccess<Product>>(`${this.productsUrl}/${id}`).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(mapHttpError)
    );
  }

  create(body: {
    name: string;
    description?: string | null;
    price: number;
    stock: number;
    imageUrl?: string | null;
    categoryId: number;
    status: ProductStatus;
  }): Observable<Product> {
    return this.http.post<ApiSuccess<Product>>(this.productsUrl, body).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(mapHttpError)
    );
  }

  update(
    id: number,
    body: Partial<{
      name: string;
      description: string | null;
      price: number;
      stock: number;
      imageUrl: string | null;
      categoryId: number;
      status: ProductStatus;
    }>
  ): Observable<Product> {
    return this.http.put<ApiSuccess<Product>>(`${this.productsUrl}/${id}`, body).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(mapHttpError)
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<ApiSuccess<null>>(`${this.productsUrl}/${id}`).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
      }),
      catchError(mapHttpError)
    );
  }
}
