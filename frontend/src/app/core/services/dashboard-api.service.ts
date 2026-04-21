import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';
import type { DashboardSummary } from '../../shared/models/dashboard.model';

export type RevenueComparisonMode = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export type RevenueComparisonDto = {
  mode: RevenueComparisonMode;
  labels: string[];
  current: number[];
  previous: number[];
  summary: {
    currentTotal: number;
    prevTotal: number;
    changePercent: number | null;
  };
};

function mapHttpError(err: HttpErrorResponse) {
  const body = err.error as { message?: string } | undefined;
  const msg = typeof body?.message === 'string' ? body.message : err.message;
  return throwError(() => new Error(msg));
}

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/dashboard`;
  private readonly aiBaseUrl = `${environment.apiUrl}/api/ai`;

  getSummary(mode: RevenueComparisonMode = 'WEEK'): Observable<DashboardSummary> {
    const params = new HttpParams().set('mode', mode);
    return this.http.get<ApiSuccess<DashboardSummary>>(`${this.baseUrl}/summary`, { params }).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(mapHttpError)
    );
  }

  getRevenueComparison(mode: RevenueComparisonMode): Observable<RevenueComparisonDto> {
    const params = new HttpParams().set('mode', mode);
    return this.http.get<ApiSuccess<RevenueComparisonDto>>(`${this.baseUrl}/revenue-comparison`, { params }).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(mapHttpError)
    );
  }

  /** Short tips (1–3 bullets). Server caches one row per UTC day. `_cb` avoids stale browser HTTP cache. */
  getMiniAdvice(): Observable<string[]> {
    const params = new HttpParams().set('_cb', String(Date.now()));
    return this.http
      .get<ApiSuccess<{ bullets: string[] }>>(`${this.aiBaseUrl}/mini-advice`, { params })
      .pipe(
        map((r) => {
          if (!r.success) throw new Error(r.message);
          return r.data.bullets;
        }),
        catchError(mapHttpError)
      );
  }
}
