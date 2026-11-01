import { Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { environment } from '../../../environments/environment';
import {
  IndexQuote,
  NotificationDto,
  OrderDrawerState,
  PortfolioSummaryDto,
  StockQuote,
  TickEvent,
  ToastItem,
} from '../models/portfolio.models';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MarketStompService implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private stompClient: Client | null = null;

  readonly connected = signal<boolean>(false);
  readonly loadingInitial = signal<boolean>(true);
  readonly indices = signal<IndexQuote[]>([]);
  readonly stocksMap = signal<Record<string, StockQuote>>({});
  readonly sectors = signal<string[]>([]);
  readonly tickFlashes = signal<Record<string, 'UP' | 'DOWN'>>({});

  readonly portfolio = signal<PortfolioSummaryDto | null>(null);
  readonly notifications = signal<NotificationDto[]>([]);
  readonly unreadCount = signal<number>(0);

  readonly orderDrawer = signal<OrderDrawerState>({
    open: false,
    symbol: 'RELIANCE',
    side: 'BUY',
  });

  readonly toasts = signal<ToastItem[]>([]);

  readonly stocksList = computed<StockQuote[]>(() => Object.values(this.stocksMap()));

  readonly topGainers = computed<StockQuote[]>(() =>
    [...this.stocksList()].sort((a, b) => b.changePct - a.changePct).slice(0, 5)
  );

  readonly topLosers = computed<StockQuote[]>(() =>
    [...this.stocksList()].sort((a, b) => a.changePct - b.changePct).slice(0, 5)
  );

  constructor() {
    effect(
      () => {
        const user = this.auth.user();
        if (user) {
          this.bootstrapAll(user.id);
        } else {
          this.disconnect();
          this.portfolio.set(null);
        }
      },
      { allowSignalWrites: true }
    );
  }

  bootstrapAll(userId: number): void {
    this.loadingInitial.set(true);
    this.api.getStocks().subscribe({
      next: (data) => {
        this.indices.set(data.indices);
        this.sectors.set(data.sectors);
        const map: Record<string, StockQuote> = {};
        for (const s of data.stocks) {
          map[s.symbol] = s;
        }
        this.stocksMap.set(map);
        this.loadingInitial.set(false);
      },
      error: () => this.loadingInitial.set(false),
    });

    this.refreshPortfolio();
    this.refreshNotifications();
    this.connectStomp(userId);
  }

  refreshPortfolio(): void {
    if (!this.auth.isAuthenticated()) return;
    this.api.getPortfolioSummary().subscribe({
      next: (summary) => this.portfolio.set(summary),
      error: () => {},
    });
  }

  refreshNotifications(): void {
    if (!this.auth.isAuthenticated()) return;
    this.api.getNotifications().subscribe({
      next: (res) => {
        this.notifications.set(res.notifications);
        this.unreadCount.set(res.unreadCount);
      },
      error: () => {},
    });
  }

  openOrderDrawer(symbol: string, side: 'BUY' | 'SELL' = 'BUY'): void {
    this.orderDrawer.set({ open: true, symbol: symbol.toUpperCase(), side });
  }

  closeOrderDrawer(): void {
    this.orderDrawer.update((s) => ({ ...s, open: false }));
  }

  pushToast(toast: Omit<ToastItem, 'id'>, durationMs = 6000): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.toasts.update((list) => [...list, { ...toast, id }]);
    setTimeout(() => this.dismissToast(id), durationMs);
  }

  dismissToast(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  undoPendingOrder(orderId: number, toastId: string): void {
    this.dismissToast(toastId);
    this.api.cancelOrder(orderId).subscribe({
      next: () => {
        this.refreshPortfolio();
        this.pushToast({
          type: 'info',
          title: 'Limit Order Cancelled',
          message: `Order #${orderId} was cancelled and margin released.`,
        });
      },
      error: (err) => {
        this.pushToast({
          type: 'error',
          title: 'Undo Failed',
          message: err?.error?.message ?? 'Order may have already executed.',
        });
      },
    });
  }

  private connectStomp(userId: number): void {
    this.disconnect();
    const client = new Client({
      brokerURL: environment.wsUrl,
      reconnectDelay: 3000,
      onConnect: () => {
        this.connected.set(true);

        client.subscribe('/topic/ticks', (msg: IMessage) => {
          const ticks = JSON.parse(msg.body) as TickEvent[];
          this.applyLiveTicks(ticks);
        });

        client.subscribe('/topic/indices', (msg: IMessage) => {
          const idx = JSON.parse(msg.body) as IndexQuote[];
          this.indices.set(idx);
        });

        client.subscribe(`/topic/user/${userId}`, (msg: IMessage) => {
          const payload = JSON.parse(msg.body) as {
            eventType: string;
            symbol?: string;
            trigger?: string;
          };
          this.refreshPortfolio();
          this.refreshNotifications();
          if (payload.eventType === 'ORDER_EXECUTED') {
            this.pushToast({
              type: 'success',
              title: 'Limit Order Executed',
              message: `${payload.symbol} limit order filled automatically.`,
            });
          } else if (payload.eventType === 'RISK_TRIGGERED') {
            this.pushToast({
              type: 'info',
              title: `${payload.trigger} Triggered`,
              message: `Auto-exit executed on ${payload.symbol}.`,
            });
          } else if (payload.eventType === 'ALERT_TRIGGERED') {
            this.pushToast({
              type: 'info',
              title: 'Price Alert Triggered',
              message: `${payload.symbol} crossed your alert price.`,
            });
          }
        });
      },
      onWebSocketClose: () => {
        this.connected.set(false);
      },
    });

    client.activate();
    this.stompClient = client;
  }

  private applyLiveTicks(ticks: TickEvent[]): void {
    const nextMap = { ...this.stocksMap() };
    const flashBatch: Record<string, 'UP' | 'DOWN'> = {};

    for (const t of ticks) {
      const existing = nextMap[t.symbol];
      if (!existing) continue;
      const spark = [...(existing.sparkline ?? []), t.ltp].slice(-24);
      nextMap[t.symbol] = {
        ...existing,
        ltp: t.ltp,
        change: t.change,
        changePct: t.changePct,
        dayHigh: t.dayHigh,
        dayLow: t.dayLow,
        volume: t.volume,
        sparkline: spark,
      };
      if (t.direction === 'UP' || t.direction === 'DOWN') {
        flashBatch[t.symbol] = t.direction;
      }
    }

    this.stocksMap.set(nextMap);
    this.tickFlashes.set(flashBatch);

    // Live-revalue portfolio holdings in real time
    const p = this.portfolio();
    if (p && p.holdings.length > 0) {
      let currentValue = 0;
      let dayPnl = 0;
      const updatedHoldings = p.holdings.map((h) => {
        const live = nextMap[h.symbol];
        if (!live) {
          currentValue += h.currentValue;
          dayPnl += h.dayPnl;
          return h;
        }
        const val = +(h.quantity * live.ltp).toFixed(2);
        const totPnl = +(val - h.investedAmount).toFixed(2);
        const totPct = h.investedAmount > 0 ? +((totPnl / h.investedAmount) * 100).toFixed(2) : 0;
        const dPnl = +(h.quantity * (live.ltp - live.prevClose)).toFixed(2);
        const dPct = live.prevClose > 0 ? +(((live.ltp - live.prevClose) / live.prevClose) * 100).toFixed(2) : 0;
        currentValue += val;
        dayPnl += dPnl;
        return {
          ...h,
          ltp: live.ltp,
          currentValue: val,
          totalPnl: totPnl,
          totalPnlPct: totPct,
          dayPnl: dPnl,
          dayPnlPct: dPct,
          sparkline: live.sparkline,
        };
      });
      const totalPnl = +(currentValue - p.totalInvested).toFixed(2);
      const totalPnlPct = p.totalInvested > 0 ? +((totalPnl / p.totalInvested) * 100).toFixed(2) : 0;
      const prevPortfolioVal = currentValue - dayPnl;
      const dayPnlPct = prevPortfolioVal > 0 ? +((dayPnl / prevPortfolioVal) * 100).toFixed(2) : 0;
      this.portfolio.set({
        ...p,
        currentValue: +currentValue.toFixed(2),
        totalAccountEquity: +(p.walletBalance + p.blockedMargin + currentValue).toFixed(2),
        totalPnl,
        totalPnlPct,
        dayPnl: +dayPnl.toFixed(2),
        dayPnlPct,
        holdings: updatedHoldings,
      });
    }
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
    this.connected.set(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
