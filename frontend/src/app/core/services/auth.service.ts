import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User } from '../../shared/models/user.model';
import type { ApiSuccess } from '../../shared/models/api-response.model';

const USER_KEY = 'current_user';

/** Matches `POST /api/auth/register` response `data` after email verification flow. */
export interface RegisterInitResult {
  email: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // Access token lives only in memory — never written to localStorage or any
  // DOM-accessible storage, so XSS cannot read it.
  private accessToken: string | null = null;
  private readonly userSignal = signal<User | null>(this.readStoredUser());

  // Interceptor refresh state must NOT be module-global in SSR.
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  readonly currentUser = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');

  getToken(): string | null {
    return this.accessToken;
  }

  get isRefreshingToken(): boolean {
    return this.isRefreshing;
  }

  setRefreshingState(state: boolean): void {
    this.isRefreshing = state;
  }

  get refreshToken$(): Observable<string | null> {
    return this.refreshTokenSubject.asObservable();
  }

  broadcastNewToken(token: string | null): void {
    this.refreshTokenSubject.next(token);
  }

  clearLocalSessionQuietly(): void {
    this.accessToken = null;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(USER_KEY);
    }
    this.userSignal.set(null);
  }

  register(name: string, email: string, password: string): Observable<RegisterInitResult> {
    return this.http
      .post<ApiSuccess<RegisterInitResult>>(`${environment.apiUrl}/api/auth/register`, {
        name,
        email,
        password,
      })
      .pipe(
        map((res) => {
          if (!res.success || !res.data) {
            throw new Error('Register failed');
          }
          return res.data;
        })
      );
  }

  resendVerification(email: string): Observable<{ email: string; message: string }> {
    return this.http
      .post<ApiSuccess<{ email: string; message: string }>>(
        `${environment.apiUrl}/api/auth/resend-verification`,
        { email }
      )
      .pipe(
        map((res) => {
          if (!res.success || !res.data) {
            throw new Error('Resend failed');
          }
          return res.data;
        })
      );
  }

  login(email: string, password: string): Observable<{ user: User; token: string }> {
    return this.http
      .post<ApiSuccess<{ user: User; token: string }>>(
        `${environment.apiUrl}/api/auth/login`,
        { email, password }
      )
      .pipe(
        map((res) => {
          if (!res.success || !res.data) {
            throw new Error('Login failed');
          }
          this.persistSession(res.data.token, res.data.user);
          return res.data;
        })
      );
  }

  refreshAccessToken(): Observable<string> {
    return this.http
      .post<ApiSuccess<{ token: string }>>(
        `${environment.apiUrl}/api/auth/refresh`,
        {},
        { withCredentials: true }
      )
      .pipe(
        map((res) => {
          if (!res.success || !res.data?.token) {
            throw new Error('Refresh failed');
          }
          this.accessToken = res.data.token;
          return res.data.token;
        })
      );
  }

  loginStub(user: User, token: string): void {
    this.persistSession(token, user);
  }

  /** Update snapshot user after profile update. */
  updateCurrentUser(next: User): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(USER_KEY, JSON.stringify(next));
    }
    this.userSignal.set(next);
  }

  /**
   * Full logout: if an access token is in memory, calls `POST /api/auth/logout` to
   * blacklist the JWT and clear the refresh cookie. If the token was lost (page reload
   * before re-authentication), calls `POST /api/auth/signout` instead, which revokes
   * only the refresh cookie without requiring a JWT.
   */
  logout(opts?: { returnUrl?: string; reason?: string }): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.userSignal.set(null);
      return;
    }
    if (this.accessToken) {
      this.http
        .post<ApiSuccess<null>>(`${environment.apiUrl}/api/auth/logout`, {}, { withCredentials: true })
        .subscribe({
          next: () => this.clearClientSession(opts),
          error: () => this.clearClientSession(opts),
        });
    } else if (this.userSignal()) {
      // Token not in memory (page was refreshed) but session cookie may still be alive.
      this.http
        .post<ApiSuccess<null>>(`${environment.apiUrl}/api/auth/signout`, {}, { withCredentials: true })
        .subscribe({
          next: () => this.clearClientSession(opts),
          error: () => this.clearClientSession(opts),
        });
    } else {
      this.clearClientSession(opts);
    }
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .post<ApiSuccess<null>>(`${environment.apiUrl}/api/auth/change-password`, {
        currentPassword,
        newPassword,
      })
      .pipe(
        map((res) => {
          if (!res.success) {
            throw new Error(res.message || 'Change password failed');
          }
          return;
        })
      );
  }

  private clearClientSession(opts?: { returnUrl?: string; reason?: string }): void {
    this.accessToken = null;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(USER_KEY);
    }
    this.userSignal.set(null);

    const current = this.router.url;
    const fallbackReturnUrl = typeof current === 'string' && current.startsWith('/') ? current : '/';
    const returnUrl = (opts?.returnUrl ?? fallbackReturnUrl).startsWith('/') ? (opts?.returnUrl ?? fallbackReturnUrl) : '/';

    if (current === '/login') {
      return;
    }
    if (returnUrl === '/login') {
      void this.router.navigate(['/login']);
      return;
    }
    void this.router.navigate(['/login'], {
      queryParams: {
        returnUrl,
        ...(opts?.reason ? { reason: opts.reason } : null),
      },
    });
  }

  private persistSession(token: string, user: User): void {
    this.accessToken = token;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    this.userSignal.set(user);
  }

  private readStoredUser(): User | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as User;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
