import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User } from '../../shared/models/user.model';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'current_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly userSignal = signal<User | null>(this.readStoredUser());

  readonly currentUser = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    return localStorage.getItem(TOKEN_KEY);
  }

  register(name: string, email: string, password: string): Observable<User> {
    return this.http
      .post<{ success: boolean; data: User }>(`${environment.apiUrl}/api/auth/register`, {
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

  login(email: string, password: string): Observable<{ user: User; token: string }> {
    return this.http
      .post<{ success: boolean; data: { user: User; token: string } }>(
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

  loginStub(user: User, token: string): void {
    this.persistSession(token, user);
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  private persistSession(token: string, user: User): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
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
      return null;
    }
  }
}
