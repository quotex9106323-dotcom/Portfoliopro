import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ChargeEstimateDto, PlaceOrderPayload } from '../../core/models/portfolio.models';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { MarketStompService } from '../../core/services/market-stomp.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .layout {
        display: flex;
        min-height: 100vh;
        background: var(--bg-canvas);
      }
      .sidebar {
        width: 224px;
        background: var(--bg-surface);
        border-right: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        transition: width 180ms ease;
        flex-shrink: 0;
      }
      .sidebar.collapsed {
        width: 68px;
      }
      .brand {
        height: 58px;
        padding: 0 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--border-color);
        font-weight: 700;
        font-size: 16px;
      }
      .nav-list {
        padding: 12px 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
      }
      .nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
      }
      .nav-item:hover {
        background: var(--bg-muted);
        color: var(--text-primary);
      }
      .nav-item.active {
        background: var(--color-gain-bg);
        color: var(--color-gain);
        font-weight: 600;
      }
      .main-area {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .topbar {
        height: 58px;
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border-color);
        padding: 0 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        position: sticky;
        top: 0;
        z-index: 20;
      }
      .ticker-strip {
        display: flex;
        align-items: center;
        gap: 18px;
        overflow-x: auto;
        font-size: 12px;
      }
      .search-trigger {
        min-width: 250px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px 12px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-color);
        background: var(--bg-muted);
        color: var(--text-muted);
        font-size: 12px;
        cursor: pointer;
      }
      .topbar-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
      .content {
        padding: 20px;
        max-width: 1520px;
        width: 100%;
        margin: 0 auto;
        padding-bottom: 76px;
      }
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(2px);
        z-index: 50;
        display: flex;
        justify-content: flex-end;
      }
      .drawer {
        width: 100%;
        max-width: 410px;
        background: var(--bg-surface);
        border-left: 1px solid var(--border-color);
        height: 100%;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        overflow-y: auto;
      }
      .palette-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
        z-index: 60;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 90px;
      }
      .palette-modal {
        width: 100%;
        max-width: 540px;
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        box-shadow: var(--elevation-2);
        overflow: hidden;
      }
      .toast-stack {
        position: fixed;
        right: 20px;
        bottom: 24px;
        z-index: 70;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 360px;
      }
      .toast-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-left: 4px solid var(--color-accent);
        border-radius: var(--radius-md);
        padding: 12px 14px;
        box-shadow: var(--elevation-2);
        font-size: 12.5px;
      }
      .toast-card.error {
        border-left-color: var(--color-loss);
      }
      .mobile-nav {
        display: none;
      }
      @media (max-width: 900px) {
        .sidebar {
          display: none;
        }
        .ticker-strip {
          display: none;
        }
        .search-trigger {
          min-width: 150px;
        }
        .mobile-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 58px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: space-around;
          align-items: center;
          z-index: 30;
        }
      }
    `,
  ],
  template: `
    <div class="layout">
      <aside class="sidebar" [class.collapsed]="collapsed()">
        <div class="brand">
          @if (!collapsed()) {
            <span>Portfolio<span class="gain">Pro</span></span>
          } @else {
            <span class="gain">PP</span>
          }
          <button
            type="button"
            class="pp-btn"
            style="padding: 4px 8px;"
            (click)="collapsed.set(!collapsed())"
            aria-label="Toggle sidebar"
          >
            {{ collapsed() ? '»' : '«' }}
          </button>
        </div>

        <nav class="nav-list" aria-label="Main navigation">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              class="nav-item"
              [title]="item.label"
            >
              <span class="mono" style="width: 20px; text-align: center;">{{ item.short }}</span>
              @if (!collapsed()) {
                <span>{{ item.label }}</span>
              }
            </a>
          }
        </nav>

        @if (!collapsed() && market.portfolio(); as pf) {
          <div style="padding: 12px; border-top: 1px solid var(--border-color); font-size: 12px;">
            <div style="color: var(--text-muted);">Available Cash</div>
            <div class="mono" style="font-weight: 700; font-size: 14px; margin-top: 2px;">
              ₹{{ pf.walletBalance | number: '1.2-2' }}
            </div>
          </div>
        }
      </aside>

      <div class="main-area">
        <header class="topbar">
          <div class="ticker-strip">
            @for (idx of market.indices(); track idx.name) {
              <div style="display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                <span style="font-weight: 600;">{{ idx.name }}</span>
                <span class="mono">{{ idx.value | number: '1.2-2' }}</span>
                <span class="mono" [class.gain]="idx.change >= 0" [class.loss]="idx.change < 0">
                  {{ idx.change >= 0 ? '+' : '' }}{{ idx.changePct | number: '1.2-2' }}%
                </span>
              </div>
            }
          </div>

          <button
            type="button"
            class="search-trigger"
            (click)="paletteOpen.set(true)"
            aria-label="Open global command palette"
          >
            <span>Search stocks or jump...</span>
            <kbd class="mono" style="font-size: 11px;">⌘K</kbd>
          </button>

          <div class="topbar-actions">
            <span
              style="display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-secondary);"
            >
              <span
                class="status-dot"
                [style.background]="market.connected() ? 'var(--color-gain)' : '#f59e0b'"
              ></span>
              {{ market.connected() ? 'NSE Live' : 'Syncing' }}
            </span>

            <button
              type="button"
              class="pp-btn"
              (click)="toggleNotifPanel()"
              aria-label="Notifications"
            >
              Alerts
              @if (market.unreadCount() > 0) {
                <span class="mono gain">({{ market.unreadCount() }})</span>
              }
            </button>

            <button
              type="button"
              class="pp-btn"
              (click)="auth.toggleTheme()"
              aria-label="Toggle color theme"
            >
              {{ auth.theme() === 'dark' ? 'Light' : 'Dark' }}
            </button>

            <button type="button" class="pp-btn" (click)="auth.logout()">Logout</button>
          </div>
        </header>

        @if (notifOpen()) {
          <div
            class="pp-card"
            style="position: fixed; right: 20px; top: 64px; width: 340px; max-height: 380px; overflow-y: auto; z-index: 45; box-shadow: var(--elevation-2);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <strong style="font-size: 13px;">Notifications</strong>
              <button type="button" class="pp-btn" style="padding: 4px 8px;" (click)="markAllRead()">
                Mark read
              </button>
            </div>
            @if (market.notifications().length === 0) {
              <p style="font-size: 12px; color: var(--text-muted);">No notifications yet.</p>
            } @else {
              @for (n of market.notifications(); track n.id) {
                <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 12px;">
                  <div style="font-weight: 600;">{{ n.title }}</div>
                  <div style="color: var(--text-secondary); margin-top: 2px;">{{ n.message }}</div>
                </div>
              }
            }
          </div>
        }

        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>

    <!-- Mobile Bottom Navigation -->
    <nav class="mobile-nav" aria-label="Mobile navigation">
      @for (item of mobileItems; track item.path) {
        <a [routerLink]="item.path" routerLinkActive="gain" style="text-decoration: none; color: var(--text-secondary); font-size: 11px; font-weight: 600;">
          {{ item.label }}
        </a>
      }
    </nav>

    <!-- Command Palette (Ctrl/Cmd + K) -->
    @if (paletteOpen()) {
      <div class="palette-backdrop" (click)="paletteOpen.set(false)">
        <div class="palette-modal" (click)="$event.stopPropagation()">
          <div style="padding: 12px; border-bottom: 1px solid var(--border-color);">
            <input
              type="text"
              class="pp-input"
              placeholder="Search NSE symbol, company, or page..."
              [ngModel]="paletteQuery()"
              (ngModelChange)="paletteQuery.set($event)"
              autofocus
            />
          </div>
          <div style="max-height: 340px; overflow-y: auto; padding: 8px;">
            @for (st of filteredPaletteStocks(); track st.symbol) {
              <div
                style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 6px; cursor: pointer;"
                (click)="jumpToStock(st.symbol)"
              >
                <div>
                  <strong class="mono">{{ st.symbol }}</strong>
                  <span style="color: var(--text-secondary); font-size: 12px; margin-left: 8px;">{{ st.name }}</span>
                </div>
                <div class="mono" [class.gain]="st.change >= 0" [class.loss]="st.change < 0">
                  ₹{{ st.ltp | number: '1.2-2' }} ({{ st.change >= 0 ? '+' : '' }}{{ st.changePct | number: '1.2-2' }}%)
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- Slide-In Order Drawer -->
    @if (market.orderDrawer().open) {
      <div class="overlay" (click)="market.closeOrderDrawer()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="margin: 0; font-size: 16px;">
                {{ drawerSide() }} {{ market.orderDrawer().symbol }}
              </h3>
              @if (activeStock(); as st) {
                <div class="mono" style="font-size: 13px; margin-top: 2px;">
                  LTP ₹{{ st.ltp | number: '1.2-2' }}
                  <span [class.gain]="st.change >= 0" [class.loss]="st.change < 0">
                    ({{ st.change >= 0 ? '+' : '' }}{{ st.changePct | number: '1.2-2' }}%)
                  </span>
                </div>
              }
            </div>
            <button type="button" class="pp-btn" (click)="market.closeOrderDrawer()">Close</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button
              type="button"
              class="pp-btn"
              [class.pp-btn-buy]="drawerSide() === 'BUY'"
              (click)="setDrawerSide('BUY')"
            >
              BUY
            </button>
            <button
              type="button"
              class="pp-btn"
              [class.pp-btn-sell]="drawerSide() === 'SELL'"
              (click)="setDrawerSide('SELL')"
            >
              SELL
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button
              type="button"
              class="pp-btn"
              [style.border-color]="orderType() === 'MARKET' ? 'var(--color-accent)' : ''"
              (click)="setOrderType('MARKET')"
            >
              Market
            </button>
            <button
              type="button"
              class="pp-btn"
              [style.border-color]="orderType() === 'LIMIT' ? 'var(--color-accent)' : ''"
              (click)="setOrderType('LIMIT')"
            >
              Limit
            </button>
          </div>

          <label style="font-size: 12px; font-weight: 600;">
            Quantity
            <input
              type="number"
              min="1"
              class="pp-input mono"
              style="margin-top: 4px;"
              [ngModel]="quantity()"
              (ngModelChange)="onOrderInputChanged($event, limitPrice())"
            />
          </label>

          @if (orderType() === 'LIMIT') {
            <label style="font-size: 12px; font-weight: 600;">
              Limit Price (₹)
              <input
                type="number"
                step="0.05"
                class="pp-input mono"
                style="margin-top: 4px;"
                [ngModel]="limitPrice()"
                (ngModelChange)="onOrderInputChanged(quantity(), $event)"
              />
            </label>
          }

          @if (drawerSide() === 'BUY') {
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <label style="font-size: 11.5px; color: var(--text-secondary);">
                Stop-Loss (Optional ₹)
                <input
                  type="number"
                  step="0.1"
                  class="pp-input mono"
                  style="margin-top: 4px;"
                  [ngModel]="stopLoss()"
                  (ngModelChange)="stopLoss.set($event)"
                />
              </label>
              <label style="font-size: 11.5px; color: var(--text-secondary);">
                Target (Optional ₹)
                <input
                  type="number"
                  step="0.1"
                  class="pp-input mono"
                  style="margin-top: 4px;"
                  [ngModel]="targetPrice()"
                  (ngModelChange)="targetPrice.set($event)"
                />
              </label>
            </div>
          }

          @if (estimate(); as est) {
            <div class="pp-card" style="background: var(--bg-muted); font-size: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Trade Value</span>
                <span class="mono">₹{{ est.turnover | number: '1.2-2' }}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: var(--text-secondary);">
                <span>Brokerage + STT + GST</span>
                <span class="mono">₹{{ est.totalCharges | number: '1.2-2' }}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: 700; padding-top: 6px; border-top: 1px solid var(--border-color);">
                <span>Estimated Total</span>
                <span class="mono">₹{{ est.netAmount | number: '1.2-2' }}</span>
              </div>
            </div>
          }

          @if (!confirmStep()) {
            <button
              type="button"
              class="pp-btn"
              [class.pp-btn-buy]="drawerSide() === 'BUY'"
              [class.pp-btn-sell]="drawerSide() === 'SELL'"
              style="padding: 11px; font-size: 13px;"
              (click)="confirmStep.set(true)"
            >
              Review {{ drawerSide() }} Order
            </button>
          } @else {
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <button type="button" class="pp-btn" (click)="confirmStep.set(false)">Back</button>
              <button
                type="button"
                class="pp-btn"
                [class.pp-btn-buy]="drawerSide() === 'BUY'"
                [class.pp-btn-sell]="drawerSide() === 'SELL'"
                [disabled]="submittingOrder()"
                (click)="submitOrder()"
              >
                {{ submittingOrder() ? 'Placing...' : 'Confirm ' + drawerSide() }}
              </button>
            </div>
          }
        </div>
      </div>
    }

    <!-- Toast Notifications with Undo for Pending Limit Orders -->
    <div class="toast-stack" aria-live="polite">
      @for (t of market.toasts(); track t.id) {
        <div class="toast-card" [class.error]="t.type === 'error'">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <strong>{{ t.title }}</strong>
            <button
              type="button"
              style="background: none; border: none; color: var(--text-muted); cursor: pointer;"
              (click)="market.dismissToast(t.id)"
            >
              ✕
            </button>
          </div>
          <div style="color: var(--text-secondary); margin-top: 4px;">{{ t.message }}</div>
          @if (t.undoOrderId) {
            <button
              type="button"
              class="pp-btn"
              style="margin-top: 8px; padding: 4px 10px; font-size: 11px;"
              (click)="market.undoPendingOrder(t.undoOrderId!, t.id)"
            >
              Undo Pending Order
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly market = inject(MarketStompService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly collapsed = signal<boolean>(false);
  readonly paletteOpen = signal<boolean>(false);
  readonly paletteQuery = signal<string>('');
  readonly notifOpen = signal<boolean>(false);

  // Order drawer state
  readonly drawerSide = signal<'BUY' | 'SELL'>('BUY');
  readonly orderType = signal<'MARKET' | 'LIMIT'>('MARKET');
  readonly quantity = signal<number>(10);
  readonly limitPrice = signal<number>(0);
  readonly stopLoss = signal<number | null>(null);
  readonly targetPrice = signal<number | null>(null);
  readonly estimate = signal<ChargeEstimateDto | null>(null);
  readonly confirmStep = signal<boolean>(false);
  readonly submittingOrder = signal<boolean>(false);

  readonly navItems = [
    { path: '/dashboard', label: 'Dashboard', short: 'DB' },
    { path: '/markets', label: 'Markets', short: 'MK' },
    { path: '/portfolio', label: 'Portfolio', short: 'PF' },
    { path: '/orders', label: 'Orders', short: 'OR' },
    { path: '/watchlist', label: 'Watchlist', short: 'WL' },
    { path: '/analysis', label: 'Analysis', short: 'AN' },
    { path: '/risk', label: 'Risk', short: 'RK' },
    { path: '/wallet', label: 'Wallet', short: 'WA' },
  ];

  readonly mobileItems = this.navItems.slice(0, 5);

  readonly activeStock = computed(() => this.market.stocksMap()[this.market.orderDrawer().symbol]);

  readonly filteredPaletteStocks = computed(() => {
    const q = this.paletteQuery().trim().toLowerCase();
    const list = this.market.stocksList();
    if (!q) return list.slice(0, 10);
    return list
      .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 12);
  });

  constructor() {
    effect(
      () => {
        const d = this.market.orderDrawer();
        if (d.open) {
          this.drawerSide.set(d.side);
          this.orderType.set('MARKET');
          this.quantity.set(10);
          const ltp = this.market.stocksMap()[d.symbol]?.ltp ?? 100;
          this.limitPrice.set(ltp);
          this.stopLoss.set(null);
          this.targetPrice.set(null);
          this.confirmStep.set(false);
          this.refreshEstimate();
        }
      },
      { allowSignalWrites: true }
    );
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.paletteOpen.update((v) => !v);
    } else if (event.key === 'Escape') {
      this.paletteOpen.set(false);
      this.notifOpen.set(false);
    }
  }

  jumpToStock(symbol: string): void {
    this.paletteOpen.set(false);
    this.paletteQuery.set('');
    this.router.navigate(['/stocks', symbol]);
  }

  toggleNotifPanel(): void {
    const next = !this.notifOpen();
    this.notifOpen.set(next);
    if (next) this.market.refreshNotifications();
  }

  markAllRead(): void {
    this.api.markNotificationsRead().subscribe({
      next: () => this.market.refreshNotifications(),
    });
  }

  setDrawerSide(side: 'BUY' | 'SELL'): void {
    this.drawerSide.set(side);
    this.confirmStep.set(false);
    this.refreshEstimate();
  }

  setOrderType(type: 'MARKET' | 'LIMIT'): void {
    this.orderType.set(type);
    this.confirmStep.set(false);
    this.refreshEstimate();
  }

  onOrderInputChanged(qty: number, lim: number): void {
    this.quantity.set(Math.max(1, Number(qty) || 1));
    this.limitPrice.set(Number(lim) || 0);
    this.confirmStep.set(false);
    this.refreshEstimate();
  }

  refreshEstimate(): void {
    const d = this.market.orderDrawer();
    if (!d.open) return;
    const payload: PlaceOrderPayload = {
      symbol: d.symbol,
      side: this.drawerSide(),
      orderType: this.orderType(),
      quantity: this.quantity(),
      limitPrice: this.orderType() === 'LIMIT' ? this.limitPrice() : null,
    };
    this.api.estimateOrder(payload).subscribe({
      next: (est) => this.estimate.set(est),
      error: () => {},
    });
  }

  submitOrder(): void {
    const d = this.market.orderDrawer();
    const payload: PlaceOrderPayload = {
      symbol: d.symbol,
      side: this.drawerSide(),
      orderType: this.orderType(),
      quantity: this.quantity(),
      limitPrice: this.orderType() === 'LIMIT' ? this.limitPrice() : null,
      stopLossPrice: this.stopLoss() || null,
      targetPrice: this.targetPrice() || null,
    };
    this.submittingOrder.set(true);
    this.api.placeOrder(payload).subscribe({
      next: (ord) => {
        this.submittingOrder.set(false);
        this.market.closeOrderDrawer();
        this.market.refreshPortfolio();
        this.market.pushToast(
          {
            type: 'success',
            title: `Order ${ord.status}`,
            message: `${ord.side} ${ord.quantity} ${ord.symbol} (${ord.orderType})`,
            undoOrderId: ord.status === 'PENDING' ? ord.id : undefined,
          },
          8000
        );
      },
      error: (err) => {
        this.submittingOrder.set(false);
        this.market.pushToast({
          type: 'error',
          title: 'Order Rejected',
          message: err?.error?.message ?? 'Check wallet balance or available shares.',
        });
      },
    });
  }
}
