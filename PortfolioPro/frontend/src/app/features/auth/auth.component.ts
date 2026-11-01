import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .auth-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: var(--bg-canvas);
      }
      .auth-card {
        width: 100%;
        max-width: 420px;
      }
      .tab-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 16px 0;
      }
      .hint {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
      }
    `,
  ],
  template: `
    <div class="auth-page">
      <div class="pp-card auth-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h1 style="margin: 0; font-size: 20px;">Portfolio<span class="gain">Pro</span></h1>
          <span class="mono" style="font-size: 11px; color: var(--text-muted);">NSE Paper Desk</span>
        </div>
        <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 6px;">
          Every new account starts with a ₹10,00,000 virtual wallet and live NSE simulated feeds.
        </p>

        <div class="tab-row">
          <button
            type="button"
            class="pp-btn"
            [class.pp-btn-buy]="mode() === 'LOGIN'"
            (click)="mode.set('LOGIN'); errorMsg.set('')"
          >
            Sign In
          </button>
          <button
            type="button"
            class="pp-btn"
            [class.pp-btn-buy]="mode() === 'REGISTER'"
            (click)="mode.set('REGISTER'); errorMsg.set('')"
          >
            Create Account
          </button>
        </div>

        <form (ngSubmit)="onSubmit()" style="display: flex; flex-direction: column; gap: 12px;">
          @if (mode() === 'REGISTER') {
            <label style="font-size: 12px; font-weight: 600;">
              Full Name
              <input
                type="text"
                class="pp-input"
                style="margin-top: 4px;"
                name="fullName"
                required
                minlength="2"
                [ngModel]="fullName()"
                (ngModelChange)="fullName.set($event)"
                placeholder="Aarav Mehta"
              />
            </label>
          }

          <label style="font-size: 12px; font-weight: 600;">
            Email Address
            <input
              type="email"
              class="pp-input"
              style="margin-top: 4px;"
              name="email"
              required
              [ngModel]="email()"
              (ngModelChange)="email.set($event)"
              placeholder="demo@portfoliopro.in"
            />
          </label>

          <label style="font-size: 12px; font-weight: 600;">
            Password
            <input
              type="password"
              class="pp-input"
              style="margin-top: 4px;"
              name="password"
              required
              minlength="6"
              [ngModel]="password()"
              (ngModelChange)="password.set($event)"
              placeholder="••••••••"
            />
            <div class="hint">Minimum 6 characters.</div>
          </label>

          @if (errorMsg()) {
            <div
              style="padding: 8px 10px; border-radius: 6px; background: var(--color-loss-bg); color: var(--color-loss); font-size: 12px;"
            >
              {{ errorMsg() }}
            </div>
          }

          <button
            type="submit"
            class="pp-btn pp-btn-buy"
            style="padding: 10px; font-size: 13px;"
            [disabled]="loading()"
          >
            {{ loading() ? 'Authenticating...' : mode() === 'LOGIN' ? 'Sign In' : 'Open ₹10,00,000 Account' }}
          </button>

          <button
            type="button"
            class="pp-btn"
            style="padding: 10px;"
            [disabled]="loading()"
            (click)="loginDemo()"
          >
            Instant Demo Login (demo&#64;portfoliopro.in)
          </button>
        </form>
      </div>
    </div>
  `,
})
export class AuthComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<'LOGIN' | 'REGISTER'>('LOGIN');
  readonly fullName = signal<string>('');
  readonly email = signal<string>('demo@portfoliopro.in');
  readonly password = signal<string>('Demo@1234');
  readonly loading = signal<boolean>(false);
  readonly errorMsg = signal<string>('');

  onSubmit(): void {
    this.errorMsg.set('');
    this.loading.set(true);
    const req$ =
      this.mode() === 'LOGIN'
        ? this.auth.login(this.email().trim(), this.password())
        : this.auth.register(this.fullName().trim(), this.email().trim(), this.password());

    req$.subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Invalid credentials or server unreachable.');
      },
    });
  }

  loginDemo(): void {
    this.mode.set('LOGIN');
    this.email.set('demo@portfoliopro.in');
    this.password.set('Demo@1234');
    this.onSubmit();
  }
}
