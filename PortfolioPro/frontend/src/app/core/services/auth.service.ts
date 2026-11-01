import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, AuthResponse, UserDto } from '../models/portfolio.models';

const ACCESS_KEY = 'pp_access_token';
const REFRESH_KEY = 'pp_refresh_token';
const USER_KEY = 'pp_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<UserDto | null>(this.loadStoredUser());
  readonly theme = signal<'light' | 'dark'>(this.user()?.theme ?? 'dark');
  readonly isAuthenticated = computed(() => !!this.user() && !!this.getAccessToken());

  constructor() {
    effect(() => {
      const currentTheme = this.theme();
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', currentTheme === 'dark');
      }
    });
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<ApiEnvelope<AuthResponse>>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(
        map((res) => res.data),
        tap((auth) => this.persistSession(auth))
      );
  }

  register(fullName: string, email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<ApiEnvelope<AuthResponse>>(`${environment.apiUrl}/auth/register`, {
        fullName,
        email,
        password,
      })
      .pipe(
        map((res) => res.data),
        tap((auth) => this.persistSession(auth))
      );
  }

  refreshSession(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken() ?? '';
    return this.http
      .post<ApiEnvelope<AuthResponse>>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        map((res) => res.data),
        tap((auth) => this.persistSession(auth))
      );
  }

  toggleTheme(): void {
    const next: 'light' | 'dark' = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    const current = this.user();
    if (current) {
      const updated = { ...current, theme: next };
      this.user.set(updated);
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      this.http
        .put<ApiEnvelope<UserDto>>(`${environment.apiUrl}/auth/theme`, { theme: next })
        .subscribe({ error: () => {} });
    }
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, { refreshToken })
        .subscribe({ error: () => {} });
    }
    this.clearSession();
    this.router.navigate(['/login']);
  }

  clearSession(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
  }

  private persistSession(auth: AuthResponse): void {
    localStorage.setItem(ACCESS_KEY, auth.accessToken);
    localStorage.setItem(REFRESH_KEY, auth.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
    this.user.set(auth.user);
    if (auth.user.theme === 'light' || auth.user.theme === 'dark') {
      this.theme.set(auth.user.theme);
    }
  }

  private loadStoredUser(): UserDto | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as UserDto) : null;
    } catch {
      return null;
    }
  }
}
