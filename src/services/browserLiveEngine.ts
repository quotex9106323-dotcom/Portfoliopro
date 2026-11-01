import type { OhlcvBar, StockSeed, TimeframeKey } from '../../server/nseSeedData.ts';
import { NSE_STOCKS_SEED, generateHistoricalCandles } from '../../server/nseSeedData.ts';
import {
  buildTechnicalAnalysis,
  buildFundamentalAnalysis,
  calculateCharges,
  computeXIRR,
} from '../../server/indicatorsAndRisk.ts';

interface BrowserUserRecord {
  id: string;
  fullName: string;
  email: string;
  passwordDigest: string;
  theme: 'light' | 'dark';
  createdAt: string;
}

interface BrowserWalletRecord {
  userId: string;
  balance: number;
  blockedMargin: number;
  totalDeposited: number;
  totalWithdrawn: number;
}

interface BrowserWalletTxn {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE_BUY' | 'TRADE_SELL' | 'ORDER_REFUND';
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

interface BrowserHoldingRecord {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  investedAmount: number;
  stopLossPrice: number | null;
  targetPrice: number | null;
  firstBoughtAt: string;
  updatedAt: string;
}

type OrderSide = 'BUY' | 'SELL';
type OrderType = 'MARKET' | 'LIMIT';
type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';

interface BrowserOrderRecord {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  requestedPrice: number;
  limitPrice: number | null;
  executedPrice: number | null;
  status: OrderStatus;
  rejectionReason?: string;
  triggerSource?: 'MANUAL' | 'LIMIT_MATCH' | 'STOP_LOSS' | 'TARGET';
  stopLossPrice?: number | null;
  targetPrice?: number | null;
  charges: number;
  totalValue: number;
  createdAt: string;
  executedAt?: string;
}

interface BrowserWatchlistRecord {
  id: string;
  userId: string;
  name: string;
  symbols: string[];
  createdAt: string;
}

interface BrowserAlertRecord {
  id: string;
  userId: string;
  symbol: string;
  condition: 'ABOVE' | 'BELOW';
  targetPrice: number;
  triggered: boolean;
  createdAt: string;
  triggeredAt?: string;
}

interface BrowserNotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'ORDER' | 'RISK' | 'ALERT' | 'WALLET';
  read: boolean;
  createdAt: string;
}

interface BrowserLiveStock {
  seed: StockSeed;
  ltp: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  change: number;
  changePct: number;
  volume: number;
  sparkline: number[];
  lastDirection: 'UP' | 'DOWN' | 'FLAT';
  updatedAtMs: number;
}

interface BrowserPersistedDb {
  version: number;
  users: BrowserUserRecord[];
  wallets: Record<string, BrowserWalletRecord>;
  walletTransactions: BrowserWalletTxn[];
  holdings: BrowserHoldingRecord[];
  orders: BrowserOrderRecord[];
  watchlists: BrowserWatchlistRecord[];
  priceAlerts: BrowserAlertRecord[];
  notifications: BrowserNotificationRecord[];
}

export type StreamPacket =
  | {
      type: 'MARKET_SNAPSHOT';
      indices: Array<{ name: string; value: number; change: number; changePct: number }>;
      stocks: Array<Record<string, unknown>>;
      marketOpen: boolean;
      serverTime: string;
    }
  | {
      type: 'PRICE_TICKS';
      indices: Array<{ name: string; value: number; change: number; changePct: number }>;
      ticks: Array<{
        symbol: string;
        ltp: number;
        change: number;
        changePct: number;
        dayHigh: number;
        dayLow: number;
        volume: number;
        direction: 'UP' | 'DOWN' | 'FLAT';
      }>;
      timestamp: number;
    }
  | {
      type: 'USER_EVENT';
      eventType: string;
      payload: unknown;
    };

const STORAGE_KEY = 'pp_vercel_db_v1';

function randomHex(bytes = 6): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function digestPassword(plain: string): string {
  const salted = `pp_salt_2026::${plain}`;
  let h1 = 0xdeadbeef ^ salted.length;
  let h2 = 0x41c6ce57 ^ salted.length;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `ppdigest_${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

function encodeBrowserToken(payload: { sub: string; email: string; name: string; kind: 'access' | 'refresh' }): string {
  const json = JSON.stringify({ ...payload, iat: Date.now() });
  const encoded = btoa(encodeURIComponent(json));
  return `pp_local.${encoded}.sig`;
}

function decodeTokenSub(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts[0] === 'pp_local' && parts[1]) {
      const parsed = JSON.parse(decodeURIComponent(atob(parts[1]))) as { sub?: string };
      return parsed.sub ?? null;
    }
    if (parts.length === 3 && parts[1]) {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const parsed = JSON.parse(atob(base64)) as { sub?: string };
      return parsed.sub ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

class BrowserLiveTradingEngine {
  private db: BrowserPersistedDb;
  private stocks: Map<string, BrowserLiveStock> = new Map();
  private candleCache: Map<string, OhlcvBar[]> = new Map();
  private subscribers: Set<{ getToken: () => string | null; onPacket: (pkt: StreamPacket) => void }> = new Set();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initLiveStocks();
    this.db = this.loadOrSeedDb();
  }

  private initLiveStocks() {
    for (const s of NSE_STOCKS_SEED) {
      const candles1D = generateHistoricalCandles(s, '1D', s.basePrice);
      this.candleCache.set(`${s.symbol}:1D`, candles1D);
      const dayBars = candles1D.slice(-24);
      const open = dayBars[0]?.open ?? s.prevClose;
      const dayHigh = Math.max(s.basePrice, ...dayBars.map((b) => b.high));
      const dayLow = Math.min(s.basePrice, ...dayBars.map((b) => b.low));
      const change = Number((s.basePrice - s.prevClose).toFixed(2));
      const changePct = Number(((change / s.prevClose) * 100).toFixed(2));

      this.stocks.set(s.symbol, {
        seed: s,
        ltp: s.basePrice,
        open,
        dayHigh,
        dayLow,
        prevClose: s.prevClose,
        change,
        changePct,
        volume: dayBars.reduce((acc, b) => acc + b.volume, 0),
        sparkline: candles1D.slice(-28).map((c) => c.close),
        lastDirection: change >= 0 ? 'UP' : 'DOWN',
        updatedAtMs: Date.now(),
      });
    }
  }

  private loadOrSeedDb(): BrowserPersistedDb {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BrowserPersistedDb;
        if (parsed && parsed.version === 1 && Array.isArray(parsed.users) && parsed.users.length > 0) {
          let migrated = false;
          for (const u of parsed.users) {
            if (
              (u.id === 'usr_demo_001' || u.email === 'demo@portfoliopro.in') &&
              u.fullName === 'Aarav Mehta'
            ) {
              u.fullName = 'Manish Singh';
              migrated = true;
            }
          }
          if (migrated) {
            this.persistImmediate(parsed);
          }
          return parsed;
        }
      }
    } catch {
      // Seed fresh database
    }
    const seeded = this.createSeededDb();
    this.persistImmediate(seeded);
    return seeded;
  }

  private createSeededDb(): BrowserPersistedDb {
    const demoUserId = 'usr_demo_001';
    const now = Date.now();
    const dayMs = 86400 * 1000;

    const demoUser: BrowserUserRecord = {
      id: demoUserId,
      fullName: 'Manish Singh',
      email: 'demo@portfoliopro.in',
      passwordDigest: digestPassword('Demo@1234'),
      theme: 'dark',
      createdAt: new Date(now - 95 * dayMs).toISOString(),
    };

    const demoPositions = [
      { symbol: 'RELIANCE', qty: 45, buyPrice: 2790.0, daysAgo: 84, sl: 2710.0, tp: 3280.0 },
      { symbol: 'TCS', qty: 30, buyPrice: 3915.0, daysAgo: 72, sl: 3820.0, tp: 4480.0 },
      { symbol: 'HDFCBANK', qty: 75, buyPrice: 1645.0, daysAgo: 61, sl: 1610.0, tp: 1920.0 },
      { symbol: 'ICICIBANK', qty: 80, buyPrice: 1198.0, daysAgo: 52, sl: 1180.0, tp: 1450.0 },
      { symbol: 'TATAMOTORS', qty: 95, buyPrice: 952.0, daysAgo: 38, sl: 845.0, tp: 1120.0 },
      { symbol: 'SUNPHARMA', qty: 45, buyPrice: 1712.0, daysAgo: 29, sl: 1690.0, tp: 2050.0 },
      { symbol: 'LT', qty: 22, buyPrice: 3488.0, daysAgo: 19, sl: 3390.0, tp: 3980.0 },
    ];

    let runningCash = 1000000;
    const walletTransactions: BrowserWalletTxn[] = [
      {
        id: 'txn_init_001',
        userId: demoUserId,
        type: 'DEPOSIT',
        amount: 1000000,
        balanceAfter: 1000000,
        description: 'Initial Virtual Trading Capital Allocation',
        createdAt: new Date(now - 95 * dayMs).toISOString(),
      },
    ];

    const holdings: BrowserHoldingRecord[] = [];
    const orders: BrowserOrderRecord[] = [];

    demoPositions.forEach((pos, idx) => {
      const charges = calculateCharges('BUY', pos.buyPrice, pos.qty);
      runningCash = Number((runningCash - charges.netAmount).toFixed(2));
      const ts = new Date(now - pos.daysAgo * dayMs).toISOString();
      const orderId = `ord_seed_${idx + 1}`;

      orders.push({
        id: orderId,
        userId: demoUserId,
        symbol: pos.symbol,
        side: 'BUY',
        orderType: 'MARKET',
        quantity: pos.qty,
        requestedPrice: pos.buyPrice,
        limitPrice: null,
        executedPrice: pos.buyPrice,
        status: 'EXECUTED',
        triggerSource: 'MANUAL',
        stopLossPrice: pos.sl,
        targetPrice: pos.tp,
        charges: charges.totalCharges,
        totalValue: charges.turnover,
        createdAt: ts,
        executedAt: ts,
      });

      holdings.push({
        id: `hld_seed_${idx + 1}`,
        userId: demoUserId,
        symbol: pos.symbol,
        quantity: pos.qty,
        avgBuyPrice: pos.buyPrice,
        investedAmount: charges.turnover,
        stopLossPrice: pos.sl,
        targetPrice: pos.tp,
        firstBoughtAt: ts,
        updatedAt: ts,
      });

      walletTransactions.push({
        id: `txn_seed_${idx + 1}`,
        userId: demoUserId,
        type: 'TRADE_BUY',
        amount: -charges.netAmount,
        balanceAfter: runningCash,
        description: `Bought ${pos.qty} ${pos.symbol} @ ₹${pos.buyPrice.toFixed(2)}`,
        referenceId: orderId,
        createdAt: ts,
      });
    });

    const pendingLimitCharges = calculateCharges('BUY', 1845.0, 15);
    const blockedMargin = pendingLimitCharges.netAmount;
    runningCash = Number((runningCash - blockedMargin).toFixed(2));

    orders.push({
      id: 'ord_seed_limit_1',
      userId: demoUserId,
      symbol: 'INFY',
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: 15,
      requestedPrice: 1878.25,
      limitPrice: 1845.0,
      executedPrice: null,
      status: 'PENDING',
      triggerSource: 'MANUAL',
      stopLossPrice: 1760.0,
      targetPrice: 2040.0,
      charges: pendingLimitCharges.totalCharges,
      totalValue: pendingLimitCharges.turnover,
      createdAt: new Date(now - 2 * 3600 * 1000).toISOString(),
    });

    const watchlists: BrowserWatchlistRecord[] = [
      {
        id: 'wl_demo_1',
        userId: demoUserId,
        name: 'Nifty Core Leaders',
        symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'LT', 'ITC', 'SBIN'],
        createdAt: new Date(now - 90 * dayMs).toISOString(),
      },
      {
        id: 'wl_demo_2',
        userId: demoUserId,
        name: 'High Alpha & Auto',
        symbols: ['TATAMOTORS', 'M&M', 'BAJFINANCE', 'SUNPHARMA', 'TITAN', 'HCLTECH'],
        createdAt: new Date(now - 45 * dayMs).toISOString(),
      },
    ];

    const priceAlerts: BrowserAlertRecord[] = [
      {
        id: 'alt_demo_1',
        userId: demoUserId,
        symbol: 'RELIANCE',
        condition: 'ABOVE',
        targetPrice: 3020.0,
        triggered: false,
        createdAt: new Date(now - 3 * dayMs).toISOString(),
      },
      {
        id: 'alt_demo_2',
        userId: demoUserId,
        symbol: 'INFY',
        condition: 'BELOW',
        targetPrice: 1850.0,
        triggered: false,
        createdAt: new Date(now - 1 * dayMs).toISOString(),
      },
    ];

    const notifications: BrowserNotificationRecord[] = [
      {
        id: 'ntf_demo_1',
        userId: demoUserId,
        title: 'Limit Order Queued — INFY',
        message: 'Buy 15 INFY Limit @ ₹1,845.00 is active in the NSE order book.',
        category: 'ORDER',
        read: false,
        createdAt: new Date(now - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 'ntf_demo_2',
        userId: demoUserId,
        title: 'Stop-Loss Active Across 7 Positions',
        message: 'Automated risk triggers are armed on all active portfolio holdings.',
        category: 'RISK',
        read: false,
        createdAt: new Date(now - 12 * 3600 * 1000).toISOString(),
      },
    ];

    return {
      version: 1,
      users: [demoUser],
      wallets: {
        [demoUserId]: {
          userId: demoUserId,
          balance: runningCash,
          blockedMargin,
          totalDeposited: 1000000,
          totalWithdrawn: 0,
        },
      },
      walletTransactions,
      holdings,
      orders,
      watchlists,
      priceAlerts,
      notifications,
    };
  }

  private persistImmediate(data: BrowserPersistedDb = this.db) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage quota warnings
    }
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persistImmediate();
    }, 350);
  }

  private formatStockDto(symbol: string) {
    const s = this.stocks.get(symbol);
    if (!s) return null;
    return {
      symbol: s.seed.symbol,
      name: s.seed.name,
      sector: s.seed.sector,
      industry: s.seed.industry,
      ltp: s.ltp,
      open: s.open,
      dayHigh: s.dayHigh,
      dayLow: s.dayLow,
      prevClose: s.prevClose,
      change: s.change,
      changePct: s.changePct,
      volume: s.volume,
      high52w: Math.max(s.seed.high52w, s.ltp),
      low52w: Math.min(s.seed.low52w, s.ltp),
      marketCapCr: Math.round(s.seed.marketCapCr * (s.ltp / s.seed.basePrice)),
      peRatio: Number((s.seed.peRatio * (s.ltp / s.seed.basePrice)).toFixed(2)),
      pbRatio: Number((s.seed.pbRatio * (s.ltp / s.seed.basePrice)).toFixed(2)),
      roe: s.seed.roe,
      dividendYield: s.seed.dividendYield,
      beta: s.seed.beta,
      sparkline: s.sparkline,
      lastDirection: s.lastDirection,
    };
  }

  private computeIndices() {
    const all = Array.from(this.stocks.values());
    const avgPct = all.reduce((acc, s) => acc + s.changePct, 0) / Math.max(1, all.length);
    const banks = all.filter((s) => s.seed.sector === 'Banking & Financials');
    const bankPct = banks.reduce((acc, s) => acc + s.changePct, 0) / Math.max(1, banks.length);
    const it = all.filter((s) => s.seed.sector === 'Information Technology');
    const itPct = it.reduce((acc, s) => acc + s.changePct, 0) / Math.max(1, it.length);

    const niftyBase = 24680.5;
    const niftyVal = Number((niftyBase * (1 + avgPct / 100)).toFixed(2));
    const sensexBase = 81145.2;
    const sensexVal = Number((sensexBase * (1 + avgPct / 100)).toFixed(2));
    const bankBase = 52340.0;
    const bankVal = Number((bankBase * (1 + bankPct / 100)).toFixed(2));
    const itBase = 42190.0;
    const itVal = Number((itBase * (1 + itPct / 100)).toFixed(2));

    return [
      { name: 'NIFTY 50', value: niftyVal, change: Number((niftyVal - niftyBase).toFixed(2)), changePct: Number(avgPct.toFixed(2)) },
      { name: 'SENSEX', value: sensexVal, change: Number((sensexVal - sensexBase).toFixed(2)), changePct: Number(avgPct.toFixed(2)) },
      { name: 'NIFTY BANK', value: bankVal, change: Number((bankVal - bankBase).toFixed(2)), changePct: Number(bankPct.toFixed(2)) },
      { name: 'NIFTY IT', value: itVal, change: Number((itVal - itBase).toFixed(2)), changePct: Number(itPct.toFixed(2)) },
    ];
  }

  private getCandles(symbol: string, timeframe: TimeframeKey): OhlcvBar[] {
    const key = `${symbol}:${timeframe}`;
    const stock = this.stocks.get(symbol);
    if (!stock) return [];

    let cached = this.candleCache.get(key);
    if (!cached) {
      cached = generateHistoricalCandles(stock.seed, timeframe, stock.ltp);
      this.candleCache.set(key, cached);
    } else if (cached.length > 0) {
      const last = cached[cached.length - 1];
      last.close = stock.ltp;
      last.high = Math.max(last.high, stock.ltp);
      last.low = Math.min(last.low, stock.ltp);
    }
    return cached;
  }

  private addNotification(
    userId: string,
    title: string,
    message: string,
    category: BrowserNotificationRecord['category']
  ): BrowserNotificationRecord {
    const ntf: BrowserNotificationRecord = {
      id: `ntf_${randomHex(6)}`,
      userId,
      title,
      message,
      category,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.db.notifications.unshift(ntf);
    if (this.db.notifications.length > 200) {
      this.db.notifications = this.db.notifications.slice(0, 200);
    }
    return ntf;
  }

  private emitUserEvent(userId: string, eventType: string, payload: unknown) {
    const pkt: StreamPacket = { type: 'USER_EVENT', eventType, payload };
    for (const sub of this.subscribers) {
      if (decodeTokenSub(sub.getToken()) === userId) {
        sub.onPacket(pkt);
      }
    }
  }

  public subscribeStream(
    getToken: () => string | null,
    onPacket: (pkt: StreamPacket) => void
  ): () => void {
    const entry = { getToken, onPacket };
    this.subscribers.add(entry);
    this.ensureTickLoop();

    // Emit initial snapshot asynchronously just like WebSocket onopen + snapshot
    setTimeout(() => {
      if (!this.subscribers.has(entry)) return;
      const stocksSnapshot = Array.from(this.stocks.keys())
        .map((sym) => this.formatStockDto(sym))
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
      onPacket({
        type: 'MARKET_SNAPSHOT',
        indices: this.computeIndices(),
        stocks: stocksSnapshot,
        marketOpen: true,
        serverTime: new Date().toISOString(),
      });
    }, 20);

    return () => {
      this.subscribers.delete(entry);
      if (this.subscribers.size === 0 && this.tickTimer) {
        clearInterval(this.tickTimer);
        this.tickTimer = null;
      }
    };
  }

  private ensureTickLoop() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const barBucket = Math.floor(nowSec / 300) * 300;
      const marketPulse = (Math.random() - 0.498) * 0.0008;
      const changedTicks: Array<{
        symbol: string;
        ltp: number;
        change: number;
        changePct: number;
        dayHigh: number;
        dayLow: number;
        volume: number;
        direction: 'UP' | 'DOWN' | 'FLAT';
      }> = [];

      for (const [symbol, st] of this.stocks.entries()) {
        const stepSigma = (st.seed.annualVolatility / 0.21) * 0.0019;
        const shock =
          (Math.random() + Math.random() + Math.random() - 1.5) * stepSigma + marketPulse * st.seed.beta;
        const driftBack = ((st.seed.basePrice - st.ltp) / st.seed.basePrice) * 0.004;
        const nextPrice = Math.max(5, Number((st.ltp * (1 + shock + driftBack)).toFixed(2)));
        const dir: 'UP' | 'DOWN' | 'FLAT' =
          nextPrice > st.ltp ? 'UP' : nextPrice < st.ltp ? 'DOWN' : 'FLAT';

        st.ltp = nextPrice;
        st.dayHigh = Math.max(st.dayHigh, nextPrice);
        st.dayLow = Math.min(st.dayLow, nextPrice);
        st.change = Number((nextPrice - st.prevClose).toFixed(2));
        st.changePct = Number(((st.change / st.prevClose) * 100).toFixed(2));
        st.volume += Math.round(60 + Math.random() * 680);
        st.lastDirection = dir;
        st.updatedAtMs = Date.now();

        if (Math.random() < 0.35) {
          st.sparkline = [...st.sparkline.slice(-27), nextPrice];
        } else if (st.sparkline.length > 0) {
          st.sparkline[st.sparkline.length - 1] = nextPrice;
        }

        const candles1D = this.candleCache.get(`${symbol}:1D`);
        if (candles1D && candles1D.length > 0) {
          const lastBar = candles1D[candles1D.length - 1];
          if (lastBar.time === barBucket) {
            lastBar.close = nextPrice;
            lastBar.high = Math.max(lastBar.high, nextPrice);
            lastBar.low = Math.min(lastBar.low, nextPrice);
            lastBar.volume += Math.round(40 + Math.random() * 220);
          } else if (barBucket > lastBar.time) {
            candles1D.push({
              time: barBucket,
              open: lastBar.close,
              high: Math.max(lastBar.close, nextPrice),
              low: Math.min(lastBar.close, nextPrice),
              close: nextPrice,
              volume: Math.round(400 + Math.random() * 1400),
            });
            if (candles1D.length > 120) candles1D.shift();
          }
        }

        changedTicks.push({
          symbol,
          ltp: st.ltp,
          change: st.change,
          changePct: st.changePct,
          dayHigh: st.dayHigh,
          dayLow: st.dayLow,
          volume: st.volume,
          direction: dir,
        });
      }

      // 1. Auto-Execute Pending Limit Orders
      const pendingOrders = this.db.orders.filter((o) => o.status === 'PENDING' && o.orderType === 'LIMIT');
      for (const ord of pendingOrders) {
        const st = this.stocks.get(ord.symbol);
        if (!st || !ord.limitPrice) continue;
        const hitBuy = ord.side === 'BUY' && st.ltp <= ord.limitPrice;
        const hitSell = ord.side === 'SELL' && st.ltp >= ord.limitPrice;
        if (!hitBuy && !hitSell) continue;

        const wallet = this.db.wallets[ord.userId];
        if (!wallet) continue;
        const nowIso = new Date().toISOString();
        const execPrice = st.ltp;

        if (ord.side === 'BUY') {
          const originallyBlocked = calculateCharges('BUY', ord.limitPrice, ord.quantity).netAmount;
          const actualCost = calculateCharges('BUY', execPrice, ord.quantity);
          wallet.blockedMargin = Number(Math.max(0, wallet.blockedMargin - originallyBlocked).toFixed(2));
          const priceSavings = Number((originallyBlocked - actualCost.netAmount).toFixed(2));
          if (priceSavings !== 0) {
            wallet.balance = Number((wallet.balance + priceSavings).toFixed(2));
          }
          this.upsertHoldingOnBuy(
            ord.userId,
            ord.symbol,
            ord.quantity,
            execPrice,
            ord.stopLossPrice ?? null,
            ord.targetPrice ?? null,
            nowIso
          );

          ord.status = 'EXECUTED';
          ord.executedPrice = execPrice;
          ord.executedAt = nowIso;
          ord.triggerSource = 'LIMIT_MATCH';
          ord.charges = actualCost.totalCharges;
          ord.totalValue = actualCost.turnover;

          this.db.walletTransactions.unshift({
            id: `txn_${randomHex(6)}`,
            userId: ord.userId,
            type: 'TRADE_BUY',
            amount: -actualCost.netAmount,
            balanceAfter: wallet.balance,
            description: `Limit Buy Executed: ${ord.quantity} ${ord.symbol} @ ₹${execPrice.toFixed(2)}`,
            referenceId: ord.id,
            createdAt: nowIso,
          });
          this.addNotification(
            ord.userId,
            `Limit Buy Filled — ${ord.symbol}`,
            `Filled ${ord.quantity} ${ord.symbol} @ ₹${execPrice.toFixed(2)} (Limit ₹${ord.limitPrice.toFixed(2)}).`,
            'ORDER'
          );
          this.scheduleSave();
          this.emitUserEvent(ord.userId, 'ORDER_EXECUTED', ord);
        } else {
          const holdingIdx = this.db.holdings.findIndex(
            (h) => h.userId === ord.userId && h.symbol === ord.symbol
          );
          if (holdingIdx === -1 || this.db.holdings[holdingIdx].quantity < ord.quantity) {
            ord.status = 'REJECTED';
            ord.rejectionReason = 'Holdings no longer available at limit trigger time.';
            this.scheduleSave();
            continue;
          }
          const actualProceeds = calculateCharges('SELL', execPrice, ord.quantity);
          wallet.balance = Number((wallet.balance + actualProceeds.netAmount).toFixed(2));
          this.reduceHoldingOnSell(ord.userId, ord.symbol, ord.quantity, nowIso);

          ord.status = 'EXECUTED';
          ord.executedPrice = execPrice;
          ord.executedAt = nowIso;
          ord.triggerSource = 'LIMIT_MATCH';
          ord.charges = actualProceeds.totalCharges;
          ord.totalValue = actualProceeds.turnover;

          this.db.walletTransactions.unshift({
            id: `txn_${randomHex(6)}`,
            userId: ord.userId,
            type: 'TRADE_SELL',
            amount: actualProceeds.netAmount,
            balanceAfter: wallet.balance,
            description: `Limit Sell Executed: ${ord.quantity} ${ord.symbol} @ ₹${execPrice.toFixed(2)}`,
            referenceId: ord.id,
            createdAt: nowIso,
          });
          this.addNotification(
            ord.userId,
            `Limit Sell Filled — ${ord.symbol}`,
            `Sold ${ord.quantity} ${ord.symbol} @ ₹${execPrice.toFixed(2)} (Limit ₹${ord.limitPrice.toFixed(2)}).`,
            'ORDER'
          );
          this.scheduleSave();
          this.emitUserEvent(ord.userId, 'ORDER_EXECUTED', ord);
        }
      }

      // 2. Auto-Trigger Position Stop-Loss and Target
      const holdingsSnap = [...this.db.holdings];
      for (const h of holdingsSnap) {
        const st = this.stocks.get(h.symbol);
        if (!st) continue;
        if (h.stopLossPrice && h.stopLossPrice > 0 && st.ltp <= h.stopLossPrice) {
          const execOrder = this.placeOrder({
            userId: h.userId,
            symbol: h.symbol,
            side: 'SELL',
            orderType: 'MARKET',
            quantity: h.quantity,
            triggerSource: 'STOP_LOSS',
          });
          this.emitUserEvent(h.userId, 'RISK_TRIGGERED', {
            trigger: 'STOP_LOSS',
            symbol: h.symbol,
            order: execOrder,
          });
        } else if (h.targetPrice && h.targetPrice > 0 && st.ltp >= h.targetPrice) {
          const execOrder = this.placeOrder({
            userId: h.userId,
            symbol: h.symbol,
            side: 'SELL',
            orderType: 'MARKET',
            quantity: h.quantity,
            triggerSource: 'TARGET',
          });
          this.emitUserEvent(h.userId, 'RISK_TRIGGERED', {
            trigger: 'TARGET',
            symbol: h.symbol,
            order: execOrder,
          });
        }
      }

      // 3. Fire Price Alerts
      for (const alert of this.db.priceAlerts) {
        if (alert.triggered) continue;
        const st = this.stocks.get(alert.symbol);
        if (!st) continue;
        const hit =
          (alert.condition === 'ABOVE' && st.ltp >= alert.targetPrice) ||
          (alert.condition === 'BELOW' && st.ltp <= alert.targetPrice);
        if (hit) {
          alert.triggered = true;
          alert.triggeredAt = new Date().toISOString();
          const ntf = this.addNotification(
            alert.userId,
            `Price Alert Hit — ${alert.symbol}`,
            `${alert.symbol} crossed ${alert.condition === 'ABOVE' ? 'above' : 'below'} ₹${alert.targetPrice.toFixed(2)} (LTP ₹${st.ltp.toFixed(2)}).`,
            'ALERT'
          );
          this.scheduleSave();
          this.emitUserEvent(alert.userId, 'ALERT_TRIGGERED', { alert, notification: ntf });
        }
      }

      if (this.subscribers.size > 0) {
        const pkt: StreamPacket = {
          type: 'PRICE_TICKS',
          indices: this.computeIndices(),
          ticks: changedTicks,
          timestamp: Date.now(),
        };
        for (const sub of this.subscribers) {
          sub.onPacket(pkt);
        }
      }
    }, 1500);
  }

  private upsertHoldingOnBuy(
    userId: string,
    symbol: string,
    qty: number,
    execPrice: number,
    sl: number | null,
    tp: number | null,
    nowIso: string
  ) {
    const existing = this.db.holdings.find((h) => h.userId === userId && h.symbol === symbol);
    if (existing) {
      const totalCost = existing.avgBuyPrice * existing.quantity + execPrice * qty;
      const newQty = existing.quantity + qty;
      existing.quantity = newQty;
      existing.avgBuyPrice = Number((totalCost / newQty).toFixed(2));
      existing.investedAmount = Number((existing.avgBuyPrice * newQty).toFixed(2));
      if (sl !== null && sl > 0) existing.stopLossPrice = sl;
      if (tp !== null && tp > 0) existing.targetPrice = tp;
      existing.updatedAt = nowIso;
    } else {
      this.db.holdings.push({
        id: `hld_${randomHex(6)}`,
        userId,
        symbol,
        quantity: qty,
        avgBuyPrice: execPrice,
        investedAmount: Number((execPrice * qty).toFixed(2)),
        stopLossPrice: sl && sl > 0 ? sl : null,
        targetPrice: tp && tp > 0 ? tp : null,
        firstBoughtAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  private reduceHoldingOnSell(userId: string, symbol: string, qty: number, nowIso: string) {
    const idx = this.db.holdings.findIndex((h) => h.userId === userId && h.symbol === symbol);
    if (idx === -1) return;
    const h = this.db.holdings[idx];
    const remaining = h.quantity - qty;
    if (remaining <= 0) {
      this.db.holdings.splice(idx, 1);
    } else {
      h.quantity = remaining;
      h.investedAmount = Number((h.avgBuyPrice * remaining).toFixed(2));
      h.updatedAt = nowIso;
    }
  }

  private placeOrder(params: {
    userId: string;
    symbol: string;
    side: OrderSide;
    orderType: OrderType;
    quantity: number;
    limitPrice?: number | null;
    stopLossPrice?: number | null;
    targetPrice?: number | null;
    triggerSource?: BrowserOrderRecord['triggerSource'];
  }): BrowserOrderRecord {
    const {
      userId,
      symbol,
      side,
      orderType,
      quantity,
      limitPrice = null,
      stopLossPrice = null,
      targetPrice = null,
      triggerSource = 'MANUAL',
    } = params;

    const stock = this.stocks.get(symbol);
    if (!stock) throw new Error(`Unknown stock symbol: ${symbol}`);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive whole number.');
    }
    if (orderType === 'LIMIT' && (!limitPrice || limitPrice <= 0)) {
      throw new Error('Valid limit price is required for Limit orders.');
    }

    const wallet = this.db.wallets[userId];
    if (!wallet) throw new Error('Wallet not found for user.');

    const nowIso = new Date().toISOString();
    const orderId = `ord_${randomHex(6)}`;
    const refPrice = orderType === 'LIMIT' && limitPrice ? Number(limitPrice.toFixed(2)) : stock.ltp;
    const estCharges = calculateCharges(side, refPrice, quantity);

    const canExecuteImmediately =
      orderType === 'MARKET' ||
      (orderType === 'LIMIT' &&
        limitPrice !== null &&
        ((side === 'BUY' && stock.ltp <= limitPrice) || (side === 'SELL' && stock.ltp >= limitPrice)));

    if (side === 'BUY') {
      if (wallet.balance < estCharges.netAmount) {
        const rejected: BrowserOrderRecord = {
          id: orderId,
          userId,
          symbol,
          side,
          orderType,
          quantity,
          requestedPrice: stock.ltp,
          limitPrice,
          executedPrice: null,
          status: 'REJECTED',
          rejectionReason: `Insufficient available margin. Required ₹${estCharges.netAmount.toLocaleString('en-IN')}, available ₹${wallet.balance.toLocaleString('en-IN')}.`,
          triggerSource,
          stopLossPrice,
          targetPrice,
          charges: estCharges.totalCharges,
          totalValue: estCharges.turnover,
          createdAt: nowIso,
        };
        this.db.orders.unshift(rejected);
        this.persistImmediate();
        return rejected;
      }

      if (canExecuteImmediately) {
        const execPrice = stock.ltp;
        const execCharges = calculateCharges('BUY', execPrice, quantity);
        wallet.balance = Number((wallet.balance - execCharges.netAmount).toFixed(2));
        this.upsertHoldingOnBuy(userId, symbol, quantity, execPrice, stopLossPrice, targetPrice, nowIso);

        const executed: BrowserOrderRecord = {
          id: orderId,
          userId,
          symbol,
          side: 'BUY',
          orderType,
          quantity,
          requestedPrice: stock.ltp,
          limitPrice,
          executedPrice: execPrice,
          status: 'EXECUTED',
          triggerSource,
          stopLossPrice,
          targetPrice,
          charges: execCharges.totalCharges,
          totalValue: execCharges.turnover,
          createdAt: nowIso,
          executedAt: nowIso,
        };
        this.db.orders.unshift(executed);
        this.db.walletTransactions.unshift({
          id: `txn_${randomHex(6)}`,
          userId,
          type: 'TRADE_BUY',
          amount: -execCharges.netAmount,
          balanceAfter: wallet.balance,
          description: `Bought ${quantity} ${symbol} @ ₹${execPrice.toFixed(2)}`,
          referenceId: orderId,
          createdAt: nowIso,
        });
        this.addNotification(
          userId,
          `Buy Executed — ${symbol}`,
          `Bought ${quantity} shares of ${symbol} at ₹${execPrice.toFixed(2)}.`,
          'ORDER'
        );
        this.persistImmediate();
        return executed;
      }

      wallet.balance = Number((wallet.balance - estCharges.netAmount).toFixed(2));
      wallet.blockedMargin = Number((wallet.blockedMargin + estCharges.netAmount).toFixed(2));
      const pending: BrowserOrderRecord = {
        id: orderId,
        userId,
        symbol,
        side: 'BUY',
        orderType: 'LIMIT',
        quantity,
        requestedPrice: stock.ltp,
        limitPrice,
        executedPrice: null,
        status: 'PENDING',
        triggerSource,
        stopLossPrice,
        targetPrice,
        charges: estCharges.totalCharges,
        totalValue: estCharges.turnover,
        createdAt: nowIso,
      };
      this.db.orders.unshift(pending);
      this.persistImmediate();
      return pending;
    }

    const holding = this.db.holdings.find((h) => h.userId === userId && h.symbol === symbol);
    const pendingSellQty = this.db.orders
      .filter((o) => o.userId === userId && o.symbol === symbol && o.side === 'SELL' && o.status === 'PENDING')
      .reduce((acc, o) => acc + o.quantity, 0);
    const availableQty = (holding?.quantity ?? 0) - (triggerSource === 'MANUAL' ? pendingSellQty : 0);

    if (!holding || availableQty < quantity) {
      const rejected: BrowserOrderRecord = {
        id: orderId,
        userId,
        symbol,
        side: 'SELL',
        orderType,
        quantity,
        requestedPrice: stock.ltp,
        limitPrice,
        executedPrice: null,
        status: 'REJECTED',
        rejectionReason: `Insufficient holdings for ${symbol}. Available sellable qty: ${Math.max(0, availableQty)}.`,
        triggerSource,
        charges: estCharges.totalCharges,
        totalValue: estCharges.turnover,
        createdAt: nowIso,
      };
      this.db.orders.unshift(rejected);
      this.persistImmediate();
      return rejected;
    }

    if (canExecuteImmediately) {
      const execPrice = stock.ltp;
      const execCharges = calculateCharges('SELL', execPrice, quantity);
      wallet.balance = Number((wallet.balance + execCharges.netAmount).toFixed(2));
      this.reduceHoldingOnSell(userId, symbol, quantity, nowIso);

      const executed: BrowserOrderRecord = {
        id: orderId,
        userId,
        symbol,
        side: 'SELL',
        orderType,
        quantity,
        requestedPrice: stock.ltp,
        limitPrice,
        executedPrice: execPrice,
        status: 'EXECUTED',
        triggerSource,
        charges: execCharges.totalCharges,
        totalValue: execCharges.turnover,
        createdAt: nowIso,
        executedAt: nowIso,
      };
      this.db.orders.unshift(executed);
      this.db.walletTransactions.unshift({
        id: `txn_${randomHex(6)}`,
        userId,
        type: 'TRADE_SELL',
        amount: execCharges.netAmount,
        balanceAfter: wallet.balance,
        description: `Sold ${quantity} ${symbol} @ ₹${execPrice.toFixed(2)}${triggerSource !== 'MANUAL' ? ` (${triggerSource})` : ''}`,
        referenceId: orderId,
        createdAt: nowIso,
      });
      this.addNotification(
        userId,
        `Sell Executed — ${symbol}`,
        `Sold ${quantity} shares of ${symbol} at ₹${execPrice.toFixed(2)}${triggerSource !== 'MANUAL' ? ` via ${triggerSource.replace('_', ' ')}` : ''}.`,
        triggerSource === 'STOP_LOSS' || triggerSource === 'TARGET' ? 'RISK' : 'ORDER'
      );
      this.persistImmediate();
      return executed;
    }

    const pending: BrowserOrderRecord = {
      id: orderId,
      userId,
      symbol,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity,
      requestedPrice: stock.ltp,
      limitPrice,
      executedPrice: null,
      status: 'PENDING',
      triggerSource,
      charges: estCharges.totalCharges,
      totalValue: estCharges.turnover,
      createdAt: nowIso,
    };
    this.db.orders.unshift(pending);
    this.persistImmediate();
    return pending;
  }

  private getPortfolioSummary(userId: string) {
    const wallet = this.db.wallets[userId] ?? {
      userId,
      balance: 0,
      blockedMargin: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
    };
    const userHoldings = this.db.holdings.filter((h) => h.userId === userId);

    let totalInvested = 0;
    let currentValue = 0;
    let dayPnl = 0;

    const enrichedHoldings = userHoldings.map((h) => {
      const st = this.stocks.get(h.symbol);
      const ltp = st?.ltp ?? h.avgBuyPrice;
      const prevClose = st?.prevClose ?? h.avgBuyPrice;
      const mktVal = Number((ltp * h.quantity).toFixed(2));
      const invVal = Number((h.avgBuyPrice * h.quantity).toFixed(2));
      const totalPnl = Number((mktVal - invVal).toFixed(2));
      const totalPnlPct = invVal > 0 ? Number(((totalPnl / invVal) * 100).toFixed(2)) : 0;
      const itemDayPnl = Number(((ltp - prevClose) * h.quantity).toFixed(2));
      const itemDayPnlPct = prevClose > 0 ? Number((((ltp - prevClose) / prevClose) * 100).toFixed(2)) : 0;

      totalInvested += invVal;
      currentValue += mktVal;
      dayPnl += itemDayPnl;

      return {
        ...h,
        name: st?.seed.name ?? h.symbol,
        sector: st?.seed.sector ?? 'Other',
        ltp,
        prevClose,
        currentValue: mktVal,
        totalPnl,
        totalPnlPct,
        dayPnl: itemDayPnl,
        dayPnlPct: itemDayPnlPct,
        sparkline: st?.sparkline ?? [],
        beta: st?.seed.beta ?? 1.0,
        annualVolatility: st?.seed.annualVolatility ?? 0.2,
      };
    });

    totalInvested = Number(totalInvested.toFixed(2));
    currentValue = Number(currentValue.toFixed(2));
    dayPnl = Number(dayPnl.toFixed(2));
    const totalPnl = Number((currentValue - totalInvested).toFixed(2));
    const totalPnlPct = totalInvested > 0 ? Number(((totalPnl / totalInvested) * 100).toFixed(2)) : 0;
    const prevValue = currentValue - dayPnl;
    const dayPnlPct = prevValue > 0 ? Number(((dayPnl / prevValue) * 100).toFixed(2)) : 0;

    const sectorMap = new Map<string, number>();
    for (const item of enrichedHoldings) {
      sectorMap.set(item.sector, (sectorMap.get(item.sector) ?? 0) + item.currentValue);
    }
    const sectorAllocation = Array.from(sectorMap.entries())
      .map(([sector, value]) => ({
        sector,
        value: Number(value.toFixed(2)),
        weightPct: currentValue > 0 ? Number(((value / currentValue) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const execOrders = this.db.orders.filter((o) => o.userId === userId && o.status === 'EXECUTED');
    const cashflows: { amount: number; timestampMs: number }[] = execOrders.map((o) => ({
      amount: o.side === 'BUY' ? -(o.totalValue + o.charges) : o.totalValue - o.charges,
      timestampMs: new Date(o.executedAt ?? o.createdAt).getTime(),
    }));
    if (currentValue > 0) {
      cashflows.push({ amount: currentValue, timestampMs: Date.now() });
    }
    const xirrPct = cashflows.length >= 2 ? computeXIRR(cashflows) : totalPnlPct;

    return {
      totalAccountEquity: Number((currentValue + wallet.balance + wallet.blockedMargin).toFixed(2)),
      walletBalance: wallet.balance,
      blockedMargin: wallet.blockedMargin,
      totalInvested,
      currentValue,
      totalPnl,
      totalPnlPct,
      dayPnl,
      dayPnlPct,
      xirrPct,
      holdingsCount: enrichedHoldings.length,
      holdings: enrichedHoldings.sort((a, b) => b.currentValue - a.currentValue),
      sectorAllocation,
    };
  }

  private getRiskReport(userId: string) {
    const summary = this.getPortfolioSummary(userId);
    const { holdings, currentValue, sectorAllocation } = summary;

    if (holdings.length === 0 || currentValue <= 0) {
      return {
        riskScore: 12,
        riskLabel: 'Low',
        weightedBeta: 0,
        annualizedVolatilityPct: 0,
        dailyVar95: 0,
        dailyVar95Pct: 0,
        estimatedMaxDrawdownPct: 0,
        hhiConcentration: 0,
        maxPositionWeightPct: 0,
        topSectorWeightPct: 0,
        stopLossCoveragePct: 100,
        alerts: [
          {
            severity: 'INFO',
            title: '100% Cash Allocation',
            detail: 'Your portfolio currently holds no equity positions. Market drawdown and concentration risks are zero.',
          },
        ],
        positions: [],
      };
    }

    let weightedBeta = 0;
    let weightedVol = 0;
    let hhi = 0;
    let maxPosWeight = 0;
    let maxPosSymbol = '';
    let coveredValue = 0;

    const positions = holdings.map((h) => {
      const weight = h.currentValue / currentValue;
      const weightPct = Number((weight * 100).toFixed(2));
      weightedBeta += weight * h.beta;
      weightedVol += weight * h.annualVolatility;
      hhi += weightPct * weightPct;
      if (weightPct > maxPosWeight) {
        maxPosWeight = weightPct;
        maxPosSymbol = h.symbol;
      }
      if (h.stopLossPrice && h.stopLossPrice > 0) {
        coveredValue += h.currentValue;
      }
      const downsideToSlPct =
        h.stopLossPrice && h.stopLossPrice > 0
          ? Number((((h.stopLossPrice - h.ltp) / h.ltp) * 100).toFixed(2))
          : null;
      const upsideToTpPct =
        h.targetPrice && h.targetPrice > 0
          ? Number((((h.targetPrice - h.ltp) / h.ltp) * 100).toFixed(2))
          : null;

      return {
        symbol: h.symbol,
        name: h.name,
        sector: h.sector,
        quantity: h.quantity,
        avgBuyPrice: h.avgBuyPrice,
        ltp: h.ltp,
        currentValue: h.currentValue,
        weightPct,
        beta: h.beta,
        stopLossPrice: h.stopLossPrice,
        targetPrice: h.targetPrice,
        downsideToSlPct,
        upsideToTpPct,
        oversizedWarning: weightPct > 22,
      };
    });

    const diversificationFactor = Math.max(0.68, Math.min(1.0, Math.sqrt(0.42 * (hhi / 10000) + 0.58)));
    const portfolioAnnualVol = weightedVol * diversificationFactor;
    const dailyVol = portfolioAnnualVol / Math.sqrt(252);
    const dailyVar95 = Number((1.645 * dailyVol * currentValue).toFixed(2));
    const dailyVar95Pct = Number(((dailyVar95 / currentValue) * 100).toFixed(2));

    let maxDrawdownPct = 0;
    const len = 60;
    const curve: number[] = new Array(len).fill(0);
    for (const h of holdings) {
      const candles = this.getCandles(h.symbol, '1Y').slice(-len);
      for (let i = 0; i < candles.length; i++) {
        curve[i] += candles[i].close * h.quantity;
      }
    }
    let peak = curve[0] || currentValue;
    for (const val of curve) {
      if (val > peak) peak = val;
      if (peak > 0) {
        const dd = ((peak - val) / peak) * 100;
        if (dd > maxDrawdownPct) maxDrawdownPct = dd;
      }
    }

    const topSector = sectorAllocation[0];
    const topSectorWeightPct = topSector?.weightPct ?? 0;
    const stopLossCoveragePct = Number(((coveredValue / currentValue) * 100).toFixed(1));

    const concComponent = Math.min(35, (hhi / 3200) * 35);
    const sectorComponent = Math.min(25, (topSectorWeightPct / 55) * 25);
    const betaVolComponent = Math.min(28, ((weightedBeta * 0.5 + (portfolioAnnualVol / 0.22) * 0.5) / 1.45) * 28);
    const unprotectedPenalty = ((100 - stopLossCoveragePct) / 100) * 12;
    const riskScore = Math.round(
      Math.max(10, Math.min(96, concComponent + sectorComponent + betaVolComponent + unprotectedPenalty))
    );

    const riskLabel =
      riskScore < 35
        ? 'Conservative'
        : riskScore < 58
          ? 'Moderate'
          : riskScore < 76
            ? 'Elevated'
            : 'Aggressive';

    const alerts: Array<{ severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'; title: string; detail: string }> = [];
    if (maxPosWeight > 22) {
      alerts.push({
        severity: 'HIGH',
        title: `Position Size Warning: ${maxPosSymbol} at ${maxPosWeight}%`,
        detail: `${maxPosSymbol} exceeds the recommended 22% single-stock threshold. Trimming partial profits can reduce idiosyncratic stock gap risk.`,
      });
    }
    if (topSector && topSectorWeightPct > 35) {
      alerts.push({
        severity: 'MEDIUM',
        title: `Sector Concentration: ${topSector.sector} (${topSectorWeightPct}%)`,
        detail: `Over a third of your equity capital is concentrated in ${topSector.sector}. Consider balancing into uncorrelated defensive sectors.`,
      });
    }
    if (stopLossCoveragePct < 85) {
      alerts.push({
        severity: 'MEDIUM',
        title: `Unprotected Holdings (${(100 - stopLossCoveragePct).toFixed(0)}% without Stop-Loss)`,
        detail: `One or more equity positions lack an automated stop-loss trigger. Set stop-loss levels below to cap downside tail risk.`,
      });
    }
    if (weightedBeta > 1.15) {
      alerts.push({
        severity: 'MEDIUM',
        title: `High Portfolio Beta (${weightedBeta.toFixed(2)}x Nifty 50)`,
        detail: `Your holdings amplify broader market swings by ${Math.round((weightedBeta - 1) * 100)}%. Expect sharper intraday volatility during index pullbacks.`,
      });
    }
    if (alerts.length === 0) {
      alerts.push({
        severity: 'LOW',
        title: 'Balanced Risk Posture',
        detail: `Position weights (max ${maxPosWeight}%), sector spread, beta (${weightedBeta.toFixed(2)}), and ${stopLossCoveragePct}% stop-loss coverage are within institutional risk guardrails.`,
      });
    }

    return {
      riskScore,
      riskLabel,
      weightedBeta: Number(weightedBeta.toFixed(2)),
      annualizedVolatilityPct: Number((portfolioAnnualVol * 100).toFixed(2)),
      dailyVar95,
      dailyVar95Pct,
      estimatedMaxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
      hhiConcentration: Math.round(hhi),
      maxPositionWeightPct: maxPosWeight,
      topSectorWeightPct,
      stopLossCoveragePct,
      alerts,
      positions,
    };
  }

  private requireUser(token: string | null): BrowserUserRecord {
    const sub = decodeTokenSub(token);
    if (!sub) throw new Error('Authentication required.');
    const user = this.db.users.find((u) => u.id === sub);
    if (!user) throw new Error('Session expired. Please sign in again.');
    return user;
  }

  public async handleRequest<T>(rawUrl: string, options: RequestInit, token: string | null): Promise<T> {
    const parsedUrl = new URL(rawUrl, window.location.origin);
    const pathname = parsedUrl.pathname;
    const method = (options.method || 'GET').toUpperCase();
    const body =
      typeof options.body === 'string' && options.body.trim().length > 0
        ? JSON.parse(options.body)
        : {};

    // AUTH ROUTES
    if (pathname === '/api/auth/register' && method === 'POST') {
      const fullName = String(body.fullName || '').trim();
      const email = String(body.email || '').toLowerCase().trim();
      const password = String(body.password || '');
      if (fullName.length < 2) throw new Error('Full name must be at least 2 characters.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (this.db.users.some((u) => u.email === email)) {
        throw new Error('An account with this email already exists.');
      }

      const id = `usr_${randomHex(6)}`;
      const nowIso = new Date().toISOString();
      const user: BrowserUserRecord = {
        id,
        fullName,
        email,
        passwordDigest: digestPassword(password),
        theme: 'dark',
        createdAt: nowIso,
      };
      this.db.users.push(user);
      this.db.wallets[id] = {
        userId: id,
        balance: 1000000,
        blockedMargin: 0,
        totalDeposited: 1000000,
        totalWithdrawn: 0,
      };
      this.db.walletTransactions.push({
        id: `txn_${randomHex(6)}`,
        userId: id,
        type: 'DEPOSIT',
        amount: 1000000,
        balanceAfter: 1000000,
        description: 'Welcome Virtual Trading Capital (₹10,00,000)',
        createdAt: nowIso,
      });
      this.db.watchlists.push({
        id: `wl_${randomHex(5)}`,
        userId: id,
        name: 'My Watchlist',
        symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'TATAMOTORS'],
        createdAt: nowIso,
      });
      this.addNotification(
        id,
        'Virtual Wallet Funded — ₹10,00,000',
        'Your virtual NSE trading account is ready with ₹10,00,000.00 starting capital.',
        'WALLET'
      );
      this.persistImmediate();

      return {
        user: { id: user.id, fullName: user.fullName, email: user.email, theme: user.theme },
        accessToken: encodeBrowserToken({ sub: user.id, email: user.email, name: user.fullName, kind: 'access' }),
        refreshToken: encodeBrowserToken({ sub: user.id, email: user.email, name: user.fullName, kind: 'refresh' }),
      } as T;
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const email = String(body.email || '').toLowerCase().trim();
      const password = String(body.password || '');
      const user = this.db.users.find((u) => u.email === email);
      if (!user || user.passwordDigest !== digestPassword(password)) {
        throw new Error('Invalid email or password.');
      }
      return {
        user: { id: user.id, fullName: user.fullName, email: user.email, theme: user.theme },
        accessToken: encodeBrowserToken({ sub: user.id, email: user.email, name: user.fullName, kind: 'access' }),
        refreshToken: encodeBrowserToken({ sub: user.id, email: user.email, name: user.fullName, kind: 'refresh' }),
      } as T;
    }

    if (pathname === '/api/auth/refresh' && method === 'POST') {
      const sub = decodeTokenSub(String(body.refreshToken || ''));
      const user = sub ? this.db.users.find((u) => u.id === sub) : null;
      if (!user) throw new Error('Refresh token expired.');
      return {
        user: { id: user.id, fullName: user.fullName, email: user.email, theme: user.theme },
        accessToken: encodeBrowserToken({ sub: user.id, email: user.email, name: user.fullName, kind: 'access' }),
        refreshToken: encodeBrowserToken({ sub: user.id, email: user.email, name: user.fullName, kind: 'refresh' }),
      } as T;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      return { loggedOut: true } as T;
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = this.requireUser(token);
      return { id: user.id, fullName: user.fullName, email: user.email, theme: user.theme } as T;
    }

    if (pathname === '/api/auth/theme' && method === 'PUT') {
      const user = this.requireUser(token);
      if (body.theme === 'light' || body.theme === 'dark') {
        user.theme = body.theme;
        this.persistImmediate();
      }
      return { theme: user.theme } as T;
    }

    // MARKET ROUTES
    if (pathname === '/api/market/stocks' && method === 'GET') {
      const sector = String(parsedUrl.searchParams.get('sector') || '').trim();
      const q = String(parsedUrl.searchParams.get('q') || '').toLowerCase().trim();
      let list = Array.from(this.stocks.keys())
        .map((sym) => this.formatStockDto(sym))
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      if (sector && sector !== 'ALL') {
        list = list.filter((s) => s.sector === sector);
      }
      if (q) {
        list = list.filter(
          (s) =>
            s.symbol.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.sector.toLowerCase().includes(q)
        );
      }

      return {
        indices: this.computeIndices(),
        stocks: list,
        sectors: Array.from(new Set(Array.from(this.stocks.values()).map((s) => s.seed.sector))),
      } as T;
    }

    const stockCandlesMatch = pathname.match(/^\/api\/market\/stocks\/([^/]+)\/candles$/);
    if (stockCandlesMatch && method === 'GET') {
      const sym = decodeURIComponent(stockCandlesMatch[1]).toUpperCase();
      const tfRaw = String(parsedUrl.searchParams.get('timeframe') || '1D').toUpperCase();
      const validTfs: TimeframeKey[] = ['1D', '1W', '1M', '1Y', '5Y'];
      const timeframe: TimeframeKey = validTfs.includes(tfRaw as TimeframeKey) ? (tfRaw as TimeframeKey) : '1D';
      if (!this.stocks.has(sym)) throw new Error(`Stock ${sym} not found.`);
      return { symbol: sym, timeframe, candles: this.getCandles(sym, timeframe) } as T;
    }

    const stockDetailMatch = pathname.match(/^\/api\/market\/stocks\/([^/]+)$/);
    if (stockDetailMatch && method === 'GET') {
      const sym = decodeURIComponent(stockDetailMatch[1]).toUpperCase();
      const dto = this.formatStockDto(sym);
      const st = this.stocks.get(sym);
      if (!dto || !st) throw new Error(`Stock ${sym} not found.`);
      return {
        ...dto,
        about: st.seed.about,
        catalysts: st.seed.catalysts,
        eps: st.seed.eps,
        debtToEquity: st.seed.debtToEquity,
        revenueGrowthYoY: st.seed.revenueGrowthYoY,
        netProfitMargin: st.seed.netProfitMargin,
      } as T;
    }

    // ANALYSIS ROUTES
    const techMatch = pathname.match(/^\/api\/analysis\/([^/]+)\/technicals$/);
    if (techMatch && method === 'GET') {
      const sym = decodeURIComponent(techMatch[1]).toUpperCase();
      const tfRaw = String(parsedUrl.searchParams.get('timeframe') || '1Y').toUpperCase();
      const validTfs: TimeframeKey[] = ['1D', '1W', '1M', '1Y', '5Y'];
      const timeframe: TimeframeKey = validTfs.includes(tfRaw as TimeframeKey) ? (tfRaw as TimeframeKey) : '1Y';
      if (!this.stocks.has(sym)) throw new Error(`Stock ${sym} not found.`);
      return buildTechnicalAnalysis(sym, timeframe, this.getCandles(sym, timeframe)) as T;
    }

    const fundMatch = pathname.match(/^\/api\/analysis\/([^/]+)\/fundamentals$/);
    if (fundMatch && method === 'GET') {
      const sym = decodeURIComponent(fundMatch[1]).toUpperCase();
      const st = this.stocks.get(sym);
      if (!st) throw new Error(`Stock ${sym} not found.`);
      return buildFundamentalAnalysis(st.seed, st.ltp) as T;
    }

    // ORDERS ROUTES
    if (pathname === '/api/orders/estimate' && method === 'POST') {
      this.requireUser(token);
      const sym = String(body.symbol || '').toUpperCase();
      const st = this.stocks.get(sym);
      if (!st) throw new Error(`Unknown stock ${sym}`);
      const qty = Math.max(1, Math.floor(Number(body.quantity) || 1));
      const price =
        body.orderType === 'LIMIT' && Number(body.limitPrice) > 0 ? Number(body.limitPrice) : st.ltp;
      const charges = calculateCharges(body.side === 'SELL' ? 'SELL' : 'BUY', price, qty);
      return { referencePrice: price, quantity: qty, ...charges } as T;
    }

    if (pathname === '/api/orders' && method === 'POST') {
      const user = this.requireUser(token);
      const order = this.placeOrder({
        userId: user.id,
        symbol: String(body.symbol || '').toUpperCase(),
        side: body.side === 'SELL' ? 'SELL' : 'BUY',
        orderType: body.orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
        quantity: Number(body.quantity),
        limitPrice: body.limitPrice ? Number(body.limitPrice) : null,
        stopLossPrice: body.stopLossPrice ? Number(body.stopLossPrice) : null,
        targetPrice: body.targetPrice ? Number(body.targetPrice) : null,
        triggerSource: 'MANUAL',
      });
      if (order.status === 'REJECTED') {
        throw new Error(order.rejectionReason || 'Order rejected.');
      }
      return order as T;
    }

    if (pathname === '/api/orders' && method === 'GET') {
      const user = this.requireUser(token);
      const statusFilter = String(parsedUrl.searchParams.get('status') || 'ALL').toUpperCase();
      const page = Math.max(0, Number(parsedUrl.searchParams.get('page')) || 0);
      const size = Math.min(100, Math.max(5, Number(parsedUrl.searchParams.get('size')) || 25));

      let userOrders = this.db.orders.filter((o) => o.userId === user.id);
      if (statusFilter !== 'ALL') {
        userOrders = userOrders.filter((o) => o.status === statusFilter);
      }

      const totalElements = userOrders.length;
      const totalPages = Math.max(1, Math.ceil(totalElements / size));
      const items = userOrders.slice(page * size, page * size + size).map((o) => ({
        ...o,
        currentLtp: this.stocks.get(o.symbol)?.ltp ?? o.requestedPrice,
        stockName: this.stocks.get(o.symbol)?.seed.name ?? o.symbol,
      }));
      return { items, page, size, totalElements, totalPages } as T;
    }

    const cancelMatch = pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/);
    if (cancelMatch && method === 'POST') {
      const user = this.requireUser(token);
      const orderId = decodeURIComponent(cancelMatch[1]);
      const order = this.db.orders.find((o) => o.id === orderId && o.userId === user.id);
      if (!order) throw new Error('Order not found.');
      if (order.status !== 'PENDING') {
        throw new Error(`Only PENDING orders can be cancelled (current status: ${order.status}).`);
      }
      order.status = 'CANCELLED';
      if (order.side === 'BUY' && order.limitPrice) {
        const blocked = calculateCharges('BUY', order.limitPrice, order.quantity).netAmount;
        const wallet = this.db.wallets[user.id];
        if (wallet) {
          wallet.balance = Number((wallet.balance + blocked).toFixed(2));
          wallet.blockedMargin = Number(Math.max(0, wallet.blockedMargin - blocked).toFixed(2));
        }
      }
      this.persistImmediate();
      return order as T;
    }

    // PORTFOLIO & RISK ROUTES
    if (pathname === '/api/portfolio/summary' && method === 'GET') {
      const user = this.requireUser(token);
      return this.getPortfolioSummary(user.id) as T;
    }

    const holdingRiskMatch = pathname.match(/^\/api\/portfolio\/holdings\/([^/]+)\/risk$/);
    if (holdingRiskMatch && method === 'PUT') {
      const user = this.requireUser(token);
      const sym = decodeURIComponent(holdingRiskMatch[1]).toUpperCase();
      const holding = this.db.holdings.find((h) => h.userId === user.id && h.symbol === sym);
      if (!holding) throw new Error(`No active holding found for ${sym}.`);

      const sl = body.stopLossPrice === null || body.stopLossPrice === '' ? null : Number(body.stopLossPrice);
      const tp = body.targetPrice === null || body.targetPrice === '' ? null : Number(body.targetPrice);
      if (sl !== null && (Number.isNaN(sl) || sl < 0)) throw new Error('Invalid stop-loss price.');
      if (tp !== null && (Number.isNaN(tp) || tp < 0)) throw new Error('Invalid target price.');

      holding.stopLossPrice = sl && sl > 0 ? Number(sl.toFixed(2)) : null;
      holding.targetPrice = tp && tp > 0 ? Number(tp.toFixed(2)) : null;
      holding.updatedAt = new Date().toISOString();
      this.persistImmediate();
      return holding as T;
    }

    if (pathname === '/api/risk/summary' && method === 'GET') {
      const user = this.requireUser(token);
      return this.getRiskReport(user.id) as T;
    }

    // WATCHLISTS & ALERTS ROUTES
    if (pathname === '/api/watchlists' && method === 'GET') {
      const user = this.requireUser(token);
      const watchlists = this.db.watchlists
        .filter((w) => w.userId === user.id)
        .map((w) => ({
          ...w,
          items: w.symbols.map((sym) => this.formatStockDto(sym)).filter(Boolean),
        }));
      const alerts = this.db.priceAlerts
        .filter((a) => a.userId === user.id)
        .map((a) => ({
          ...a,
          currentLtp: this.stocks.get(a.symbol)?.ltp ?? 0,
        }));
      return { watchlists, alerts } as T;
    }

    if (pathname === '/api/watchlists' && method === 'POST') {
      const user = this.requireUser(token);
      const name = String(body.name || '').trim();
      if (!name || name.length > 40) throw new Error('Watchlist name must be 1–40 characters.');
      const created: BrowserWatchlistRecord = {
        id: `wl_${randomHex(5)}`,
        userId: user.id,
        name,
        symbols: [],
        createdAt: new Date().toISOString(),
      };
      this.db.watchlists.push(created);
      this.persistImmediate();
      return { ...created, items: [] } as T;
    }

    const wlDeleteMatch = pathname.match(/^\/api\/watchlists\/([^/]+)$/);
    if (wlDeleteMatch && method === 'DELETE') {
      const user = this.requireUser(token);
      const wlId = decodeURIComponent(wlDeleteMatch[1]);
      const userLists = this.db.watchlists.filter((w) => w.userId === user.id);
      if (userLists.length <= 1) throw new Error('At least one watchlist must remain.');
      this.db.watchlists = this.db.watchlists.filter((w) => !(w.id === wlId && w.userId === user.id));
      this.persistImmediate();
      return { deleted: true } as T;
    }

    const wlAddItemMatch = pathname.match(/^\/api\/watchlists\/([^/]+)\/items$/);
    if (wlAddItemMatch && method === 'POST') {
      const user = this.requireUser(token);
      const wlId = decodeURIComponent(wlAddItemMatch[1]);
      const sym = String(body.symbol || '').toUpperCase();
      if (!this.stocks.has(sym)) throw new Error(`Unknown stock ${sym}.`);
      const wl = this.db.watchlists.find((w) => w.id === wlId && w.userId === user.id);
      if (!wl) throw new Error('Watchlist not found.');
      if (!wl.symbols.includes(sym)) {
        wl.symbols.push(sym);
        this.persistImmediate();
      }
      return { ...wl, items: wl.symbols.map((s) => this.formatStockDto(s)).filter(Boolean) } as T;
    }

    const wlRemoveItemMatch = pathname.match(/^\/api\/watchlists\/([^/]+)\/items\/([^/]+)$/);
    if (wlRemoveItemMatch && method === 'DELETE') {
      const user = this.requireUser(token);
      const wlId = decodeURIComponent(wlRemoveItemMatch[1]);
      const sym = decodeURIComponent(wlRemoveItemMatch[2]).toUpperCase();
      const wl = this.db.watchlists.find((w) => w.id === wlId && w.userId === user.id);
      if (!wl) throw new Error('Watchlist not found.');
      wl.symbols = wl.symbols.filter((s) => s !== sym);
      this.persistImmediate();
      return { ...wl, items: wl.symbols.map((s) => this.formatStockDto(s)).filter(Boolean) } as T;
    }

    const wlReorderMatch = pathname.match(/^\/api\/watchlists\/([^/]+)\/reorder$/);
    if (wlReorderMatch && method === 'PUT') {
      const user = this.requireUser(token);
      const wlId = decodeURIComponent(wlReorderMatch[1]);
      const wl = this.db.watchlists.find((w) => w.id === wlId && w.userId === user.id);
      if (!wl) throw new Error('Watchlist not found.');
      const symbols = Array.isArray(body.symbols)
        ? body.symbols.map((s: unknown) => String(s).toUpperCase()).filter((s: string) => this.stocks.has(s))
        : [];
      wl.symbols = Array.from(new Set(symbols));
      this.persistImmediate();
      return { ...wl, items: wl.symbols.map((s) => this.formatStockDto(s)).filter(Boolean) } as T;
    }

    if (pathname === '/api/alerts' && method === 'POST') {
      const user = this.requireUser(token);
      const sym = String(body.symbol || '').toUpperCase();
      const condition = body.condition === 'BELOW' ? 'BELOW' : 'ABOVE';
      const targetPrice = Number(body.targetPrice);
      if (!this.stocks.has(sym) || Number.isNaN(targetPrice) || targetPrice <= 0) {
        throw new Error('Valid symbol and target price required.');
      }
      const created: BrowserAlertRecord = {
        id: `alt_${randomHex(5)}`,
        userId: user.id,
        symbol: sym,
        condition,
        targetPrice: Number(targetPrice.toFixed(2)),
        triggered: false,
        createdAt: new Date().toISOString(),
      };
      this.db.priceAlerts.unshift(created);
      this.persistImmediate();
      return created as T;
    }

    const alertDeleteMatch = pathname.match(/^\/api\/alerts\/([^/]+)$/);
    if (alertDeleteMatch && method === 'DELETE') {
      const user = this.requireUser(token);
      const alertId = decodeURIComponent(alertDeleteMatch[1]);
      this.db.priceAlerts = this.db.priceAlerts.filter((a) => !(a.id === alertId && a.userId === user.id));
      this.persistImmediate();
      return { deleted: true } as T;
    }

    // WALLET ROUTES
    if (pathname === '/api/wallet' && method === 'GET') {
      const user = this.requireUser(token);
      const page = Math.max(0, Number(parsedUrl.searchParams.get('page')) || 0);
      const size = Math.min(100, Math.max(5, Number(parsedUrl.searchParams.get('size')) || 20));
      const wallet = this.db.wallets[user.id] ?? {
        userId: user.id,
        balance: 0,
        blockedMargin: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
      };
      const txns = this.db.walletTransactions
        .filter((t) => t.userId === user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        wallet,
        transactions: txns.slice(page * size, page * size + size),
        page,
        size,
        totalElements: txns.length,
        totalPages: Math.max(1, Math.ceil(txns.length / size)),
      } as T;
    }

    if (pathname === '/api/wallet/deposit' && method === 'POST') {
      const user = this.requireUser(token);
      const amount = Number(body.amount);
      if (Number.isNaN(amount) || amount < 100 || amount > 50000000) {
        throw new Error('Deposit amount must be between ₹100 and ₹5,00,00,000.');
      }
      const wallet = this.db.wallets[user.id];
      if (!wallet) throw new Error('Wallet not found.');
      const cleanAmt = Number(amount.toFixed(2));
      wallet.balance = Number((wallet.balance + cleanAmt).toFixed(2));
      wallet.totalDeposited = Number((wallet.totalDeposited + cleanAmt).toFixed(2));
      const txn: BrowserWalletTxn = {
        id: `txn_${randomHex(6)}`,
        userId: user.id,
        type: 'DEPOSIT',
        amount: cleanAmt,
        balanceAfter: wallet.balance,
        description: String(body.note || 'Instant UPI / NetBanking Virtual Deposit'),
        createdAt: new Date().toISOString(),
      };
      this.db.walletTransactions.unshift(txn);
      this.persistImmediate();
      return { wallet, transaction: txn } as T;
    }

    if (pathname === '/api/wallet/withdraw' && method === 'POST') {
      const user = this.requireUser(token);
      const amount = Number(body.amount);
      const wallet = this.db.wallets[user.id];
      if (!wallet) throw new Error('Wallet not found.');
      if (Number.isNaN(amount) || amount < 100) {
        throw new Error('Minimum withdrawal amount is ₹100.');
      }
      const cleanAmt = Number(amount.toFixed(2));
      if (cleanAmt > wallet.balance) {
        throw new Error(`Insufficient withdrawable cash (Available: ₹${wallet.balance.toLocaleString('en-IN')}).`);
      }
      wallet.balance = Number((wallet.balance - cleanAmt).toFixed(2));
      wallet.totalWithdrawn = Number((wallet.totalWithdrawn + cleanAmt).toFixed(2));
      const txn: BrowserWalletTxn = {
        id: `txn_${randomHex(6)}`,
        userId: user.id,
        type: 'WITHDRAWAL',
        amount: -cleanAmt,
        balanceAfter: wallet.balance,
        description: String(body.note || 'Bank Settlement Payout'),
        createdAt: new Date().toISOString(),
      };
      this.db.walletTransactions.unshift(txn);
      this.persistImmediate();
      return { wallet, transaction: txn } as T;
    }

    // NOTIFICATIONS ROUTES
    if (pathname === '/api/notifications' && method === 'GET') {
      const user = this.requireUser(token);
      const notifications = this.db.notifications.filter((n) => n.userId === user.id).slice(0, 40);
      const unreadCount = notifications.filter((n) => !n.read).length;
      return { notifications, unreadCount } as T;
    }

    if (pathname === '/api/notifications/read-all' && method === 'POST') {
      const user = this.requireUser(token);
      for (const n of this.db.notifications) {
        if (n.userId === user.id) n.read = true;
      }
      this.persistImmediate();
      return { readAll: true } as T;
    }

    throw new Error(`Unsupported endpoint: ${method} ${pathname}`);
  }
}

let singletonEngine: BrowserLiveTradingEngine | null = null;

export function getBrowserLiveEngine(): BrowserLiveTradingEngine {
  if (!singletonEngine) {
    singletonEngine = new BrowserLiveTradingEngine();
  }
  return singletonEngine;
}
