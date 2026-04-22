import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess, PaginationMeta } from '../../shared/models/api-response.model';
import type { Role, User } from '../../shared/models/user.model';

function mapHttpError(err: HttpErrorResponse) {
  const body = err.error as { message?: string } | undefined;
  const msg = typeof body?.message === 'string' ? body.message : err.message;
  return throwError(() => new Error(msg));
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/users`;

  getMe(): Observable<User> {
    return this.http.get<ApiSuccess<User>>(`${this.baseUrl}/me`).pipe(
      map((r) => {
        if (!r.success) {
          throw new Error(r.message);
        }
        return r.data;
      }),
      catchError(mapHttpError)
    );
  }

  updateMe(patch: {
    name?: string | null;
    phone?: string | null;
    provinceId?: string | null;
    districtId?: string | null;
    wardId?: string | null;
    streetAddress?: string | null;
    fullAddress?: string | null;
  }): Observable<User> {
    return this.http.patch<ApiSuccess<User>>(`${this.baseUrl}/me`, patch).pipe(
      map((r) => {
        if (!r.success) {
          throw new Error(r.message);
        }
        return r.data;
      }),
      catchError(mapHttpError)
    );
  }

  getUsers(
    page = 1,
    limit = 20,
    search?: string,
    role?: Role
  ): Observable<{ data: User[]; meta: PaginationMeta }> {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    const q = search?.trim();
    if (q) {
      params = params.set('search', q);
    }
    if (role) {
      params = params.set('role', role);
    }
    return this.http.get<ApiSuccess<User[]>>(this.baseUrl, { params }).pipe(
      map((r) => {
        if (!r.success || !r.meta) {
          throw new Error(r.message);
        }
        return { data: r.data, meta: r.meta };
      }),
      catchError(mapHttpError)
    );
  }
}
