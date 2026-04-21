import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User } from '../../shared/models/user.model';
import type { ApiSuccess } from '../../shared/models/api-response.model';

const TOKEN_KEY = 'access_token';
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

  private readonly userSignal = signal<User | null>(this.readStoredSession());

  readonly currentUser = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem(TOKEN_KEY);
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
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem(TOKEN_KEY, res.data.token);
          }
          return res.data.token;
        })
      );
  }

  loginStub(user: User, token: string): void {
    this.persistSession(token, user);
  }

  /** Update snapshot user after profile update. */
  updateCurrentUser(next: User): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.userSignal.set(next);
      return;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      this.userSignal.set(next);
      return;
    }
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    this.userSignal.set(next);
  }

  /**
   * Calls `POST /api/auth/logout` to blacklist the JWT server-side, then clears client session.
   * If there is no token (or outside browser), only clears local state.
   */
  logout(opts?: { returnUrl?: string; reason?: string }): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.userSignal.set(null);
      return;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      this.clearClientSession({ returnUrl: opts?.returnUrl, reason: opts?.reason });
      return;
    }
    this.http.post<ApiSuccess<null>>(`${environment.apiUrl}/api/auth/logout`, {}, { withCredentials: true }).subscribe({
      next: () => this.clearClientSession({ returnUrl: opts?.returnUrl, reason: opts?.reason }),
      error: () => this.clearClientSession({ returnUrl: opts?.returnUrl, reason: opts?.reason }),
    });
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
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(TOKEN_KEY);
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
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.userSignal.set(user);
  }

  /**
   * Restores session only when both token and user snapshot exist (avoids stale user after token removal).
   */
  private readStoredSession(): User | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      localStorage.removeItem(USER_KEY);
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
