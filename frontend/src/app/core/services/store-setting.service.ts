import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of, tap, throwError, type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess } from '../../shared/models/api-response.model';
import type { StoreSetting } from '../../shared/models/store-setting.model';

function mapLoadError(_err: HttpErrorResponse) {
  return of(null);
}

function mapHttpError(err: HttpErrorResponse) {
  const body = err.error as { message?: string } | undefined;
  const msg = typeof body?.message === 'string' ? body.message : err.message;
  return throwError(() => new Error(msg));
}

@Injectable({ providedIn: 'root' })
export class StoreSettingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/store-settings`;

  /** `null` if not loaded yet or request failed; UI may use fallbacks. */
  readonly setting = signal<StoreSetting | null>(null);

  load(): void {
    this.http.get<ApiSuccess<StoreSetting>>(this.baseUrl).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError(mapLoadError)
    ).subscribe((data) => this.setting.set(data));
  }

  /** Reload from API and update the signal (e.g. admin store settings page). */
  refresh(): Observable<StoreSetting> {
    return this.http.get<ApiSuccess<StoreSetting>>(this.baseUrl).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      tap((data) => this.setting.set(data)),
      catchError(mapHttpError)
    );
  }

  update(body: Partial<Pick<StoreSetting, 'name' | 'address' | 'phone' | 'email' | 'logoUrl' | 'description'>>): Observable<StoreSetting> {
    return this.http.put<ApiSuccess<StoreSetting>>(this.baseUrl, body).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      }),
      catchError((err: HttpErrorResponse) => {
        const body = err.error as { message?: string } | undefined;
        const msg = typeof body?.message === 'string' ? body.message : err.message;
        throw new Error(msg);
      })
    );
  }
}
