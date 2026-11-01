import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type {
  UserProfile,
  StockQuote,
  MarketIndex,
  PortfolioSummary,
  WatchlistGroup,
  PriceAlertItem,
  AppNotification,
  PageRoute,
  OrderSide,
  OrderType,
} from '../types';
import {
  apiFetch,
  setAuthTokens,
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
} from '../services/api';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  variant: 'success' | 'error' | 'info' | 'warning';
  undoOrderId?: string;
}

export interface OrderDrawerState {
  open: boolean;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
}

interface PortfolioContextValue {
  user: UserProfile | null;
  authLoading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  route: PageRoute;
  selectedSymbol: string;
  navigate: (route: PageRoute, symbol?: string) => void;
  stocks: StockQuote[];
  stocksMap: Record<string, StockQuote>;
  tickFlash: Record<string, 'UP' | 'DOWN'>;
  indices: MarketIndex[];
  wsConnected: boolean;
  portfolio: PortfolioSummary | null;
  watchlists: WatchlistGroup[];
  alerts: PriceAlertItem[];
  notifications: AppNotification[];
  unreadCount: number;
  refreshPortfolioAll: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  orderDrawer: OrderDrawerState;
  openOrderDrawer: (symbol: string, side?: OrderSide, orderType?: OrderType) => void;
  closeOrderDrawer: () => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  markNotificationsRead: () => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('pp_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  const [route, setRoute] = useState<PageRoute>('dashboard');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');

  const [stocksMap, setStocksMap] = useState<Record<string, StockQuote>>({});
  const [tickFlash, setTickFlash] = useState<Record<string, 'UP' | 'DOWN'>>({});
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [watchlists, setWatchlists] = useState<WatchlistGroup[]>([]);
  const [alerts, setAlerts] = useState<PriceAlertItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const [orderDrawer, setOrderDrawer] = useState<OrderDrawerState>({
    open: false,
    symbol: 'RELIANCE',
    side: 'BUY',
    orderType: 'MARKET',
  });
  const [commandOpen, setCommandOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const flashTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Sync theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('pp_theme', theme);
    if (user) {
      localStorage.setItem(`pp_theme_${user.email}`, theme);
    }
  }, [theme, user]);

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `tst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 4));
    const ttl = toast.undoOrderId ? 8000 : 4500;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ttl);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshPortfolioAll = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const [portData, wlData, ntfData] = await Promise.all([
        apiFetch<PortfolioSummary>('/api/portfolio/summary'),
        apiFetch<{ watchlists: WatchlistGroup[]; alerts: PriceAlertItem[] }>('/api/watchlists'),
        apiFetch<{ notifications: AppNotification[]; unreadCount: number }>('/api/notifications'),
      ]);
      setPortfolio(portData);
      setWatchlists(wlData.watchlists);
      setAlerts(wlData.alerts);
      setNotifications(ntfData.notifications);
      setUnreadCount(ntfData.unreadCount);
    } catch {
      // Handled gracefully
    }
  }, []);

  const loadMarketInitial = useCallback(async () => {
    try {
      const data = await apiFetch<{ indices: MarketIndex[]; stocks: StockQuote[] }>('/api/market/stocks');
      setIndices(data.indices);
      const map: Record<string, StockQuote> = {};
      for (const s of data.stocks) map[s.symbol] = s;
      setStocksMap(map);
    } catch {
      // Will retry via WebSocket
    }
  }, []);

  // Restore session on startup
  useEffect(() => {
    loadMarketInitial();
    const token = getAccessToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    apiFetch<UserProfile>('/api/auth/me')
      .then((u) => {
        setUser(u);
        const userSavedTheme = localStorage.getItem(`pp_theme_${u.email}`) as 'light' | 'dark' | null;
        setTheme(userSavedTheme || u.theme || 'dark');
      })
      .catch(() => {
        clearAuthTokens();
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, [loadMarketInitial]);

  useEffect(() => {
    if (user) {
      refreshPortfolioAll();
    }
  }, [user, refreshPortfolioAll]);

  // Global Ctrl/Cmd+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (user) {
          setCommandOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [user]);

  // Live WebSocket Connection with Auto-Reconnect
  useEffect(() => {
    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (unmounted) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getAccessToken();
      const wsUrl = `${proto}//${window.location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmounted) setWsConnected(true);
      };

      ws.onmessage = (evt) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'MARKET_SNAPSHOT') {
            if (Array.isArray(msg.indices)) setIndices(msg.indices);
            if (Array.isArray(msg.stocks)) {
              const nextMap: Record<string, StockQuote> = {};
              for (const s of msg.stocks) nextMap[s.symbol] = s;
              setStocksMap(nextMap);
            }
          } else if (msg.type === 'PRICE_TICKS') {
            if (Array.isArray(msg.indices)) setIndices(msg.indices);
            if (Array.isArray(msg.ticks)) {
              const flashes: Record<string, 'UP' | 'DOWN'> = {};
              setStocksMap((prev) => {
                const updated = { ...prev };
                for (const t of msg.ticks) {
                  const existing = updated[t.symbol];
                  if (!existing) continue;
                  if (t.ltp !== existing.ltp && (t.direction === 'UP' || t.direction === 'DOWN')) {
                    flashes[t.symbol] = t.direction;
                  }
                  const nextSpark = [...existing.sparkline];
                  if (nextSpark.length > 0) {
                    nextSpark[nextSpark.length - 1] = t.ltp;
                  }
                  updated[t.symbol] = {
                    ...existing,
                    ltp: t.ltp,
                    change: t.change,
                    changePct: t.changePct,
                    dayHigh: t.dayHigh,
                    dayLow: t.dayLow,
                    volume: t.volume,
                    lastDirection: t.direction,
                    sparkline: nextSpark,
                  };
                }
                return updated;
              });

              const flashKeys = Object.keys(flashes);
              if (flashKeys.length > 0) {
                setTickFlash((prev) => ({ ...prev, ...flashes }));
                for (const sym of flashKeys) {
                  if (flashTimersRef.current[sym]) clearTimeout(flashTimersRef.current[sym]);
                  flashTimersRef.current[sym] = setTimeout(() => {
                    setTickFlash((p) => {
                      const copy = { ...p };
                      delete copy[sym];
                      return copy;
                    });
                  }, 600);
                }
              }

              // Recompute live portfolio P&L smoothly from updated LTPs
              setPortfolio((prev) => {
                if (!prev || prev.holdings.length === 0) return prev;
                const tickLookup: Record<string, number> = {};
                for (const t of msg.ticks) tickLookup[t.symbol] = t.ltp;

                let currentValue = 0;
                let dayPnl = 0;
                const nextHoldings = prev.holdings.map((h) => {
                  const ltp = tickLookup[h.symbol] ?? h.ltp;
                  const mktVal = Number((ltp * h.quantity).toFixed(2));
                  const totalPnl = Number((mktVal - h.investedAmount).toFixed(2));
                  const totalPnlPct =
                    h.investedAmount > 0 ? Number(((totalPnl / h.investedAmount) * 100).toFixed(2)) : 0;
                  const itemDayPnl = Number(((ltp - h.prevClose) * h.quantity).toFixed(2));
                  const itemDayPnlPct =
                    h.prevClose > 0 ? Number((((ltp - h.prevClose) / h.prevClose) * 100).toFixed(2)) : 0;

                  currentValue += mktVal;
                  dayPnl += itemDayPnl;
                  return {
                    ...h,
                    ltp,
                    currentValue: mktVal,
                    totalPnl,
                    totalPnlPct,
                    dayPnl: itemDayPnl,
                    dayPnlPct: itemDayPnlPct,
                  };
                });

                currentValue = Number(currentValue.toFixed(2));
                dayPnl = Number(dayPnl.toFixed(2));
                const totalPnl = Number((currentValue - prev.totalInvested).toFixed(2));
                const totalPnlPct =
                  prev.totalInvested > 0
                    ? Number(((totalPnl / prev.totalInvested) * 100).toFixed(2))
                    : 0;
                const prevVal = currentValue - dayPnl;
                const dayPnlPct = prevVal > 0 ? Number(((dayPnl / prevVal) * 100).toFixed(2)) : 0;

                return {
                  ...prev,
                  currentValue,
                  totalAccountEquity: Number(
                    (currentValue + prev.walletBalance + prev.blockedMargin).toFixed(2)
                  ),
                  totalPnl,
                  totalPnlPct,
                  dayPnl,
                  dayPnlPct,
                  holdings: nextHoldings,
                };
              });
            }
          } else if (msg.type === 'USER_EVENT') {
            refreshPortfolioAll();
            if (msg.eventType === 'ORDER_EXECUTED' && msg.payload) {
              const o = msg.payload;
              pushToast({
                title: `Limit ${o.side} Filled — ${o.symbol}`,
                message: `${o.quantity} shares executed @ ₹${Number(o.executedPrice).toFixed(2)}`,
                variant: 'success',
              });
            } else if (msg.eventType === 'RISK_TRIGGERED' && msg.payload) {
              const p = msg.payload;
              pushToast({
                title: `${p.trigger === 'STOP_LOSS' ? 'Stop-Loss' : 'Target'} Triggered — ${p.symbol}`,
                message: `Position exited automatically at market price.`,
                variant: p.trigger === 'STOP_LOSS' ? 'warning' : 'success',
              });
            } else if (msg.eventType === 'ALERT_TRIGGERED' && msg.payload?.notification) {
              pushToast({
                title: msg.payload.notification.title,
                message: msg.payload.notification.message,
                variant: 'info',
              });
            }
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 2500);
        }
      };
    };

    connect();
    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [user, refreshPortfolioAll, pushToast]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (getAccessToken()) {
        apiFetch('/api/auth/theme', {
          method: 'PUT',
          body: JSON.stringify({ theme: next }),
        }).catch(() => {});
      }
      return next;
    });
  }, []);

  const navigate = useCallback((nextRoute: PageRoute, symbol?: string) => {
    if (symbol) setSelectedSymbol(symbol.toUpperCase());
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ user: UserProfile; accessToken: string; refreshToken: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    setAuthTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    const savedTheme = localStorage.getItem(`pp_theme_${res.user.email}`) as 'light' | 'dark' | null;
    setTheme(savedTheme || res.user.theme || 'dark');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'AUTH', token: res.accessToken }));
    }
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const res = await apiFetch<{ user: UserProfile; accessToken: string; refreshToken: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password }),
      }
    );
    setAuthTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'AUTH', token: res.accessToken }));
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore
    }
    clearAuthTokens();
    setUser(null);
    setPortfolio(null);
    setRoute('dashboard');
  }, []);

  const openOrderDrawer = useCallback(
    (symbol: string, side: OrderSide = 'BUY', orderType: OrderType = 'MARKET') => {
      setOrderDrawer({ open: true, symbol: symbol.toUpperCase(), side, orderType });
    },
    []
  );

  const closeOrderDrawer = useCallback(() => {
    setOrderDrawer((prev) => ({ ...prev, open: false }));
  }, []);

  const markNotificationsRead = useCallback(async () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
  }, []);

  const stocks = Object.values(stocksMap);

  return (
    <PortfolioContext.Provider
      value={{
        user,
        authLoading,
        theme,
        toggleTheme,
        route,
        selectedSymbol,
        navigate,
        stocks,
        stocksMap,
        tickFlash,
        indices,
        wsConnected,
        portfolio,
        watchlists,
        alerts,
        notifications,
        unreadCount,
        refreshPortfolioAll,
        login,
        register,
        logout,
        orderDrawer,
        openOrderDrawer,
        closeOrderDrawer,
        commandOpen,
        setCommandOpen,
        toasts,
        pushToast,
        dismissToast,
        markNotificationsRead,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used inside PortfolioProvider');
  return ctx;
}
