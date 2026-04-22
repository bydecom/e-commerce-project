import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';
import type { SystemConfigRecord } from '../../shared/models/system-config.model';

function handleError(err: HttpErrorResponse) {
  const body = err.error as { message?: string } | undefined;
  const msg = typeof body?.message === 'string' ? body.message : err.message;
  return throwError(() => new Error(msg));
}

@Injectable({ providedIn: 'root' })
export class SystemConfigService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/system-config`;

  getAll(): Observable<SystemConfigRecord[]> {
    return this.http.get<ApiSuccess<SystemConfigRecord[]>>(this.base).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(handleError)
    );
  }

  bulkUpdate(configs: Array<{ key: string; value: string }>): Observable<SystemConfigRecord[]> {
    return this.http.put<ApiSuccess<SystemConfigRecord[]>>(`${this.base}/bulk`, { configs }).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(handleError)
    );
  }

  updateOne(key: string, value: string): Observable<SystemConfigRecord> {
    return this.http.put<ApiSuccess<SystemConfigRecord>>(`${this.base}/${key}`, { value }).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(handleError)
    );
  }
}

