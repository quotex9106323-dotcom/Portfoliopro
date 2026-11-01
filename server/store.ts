import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { OhlcvBar, StockSeed, TimeframeKey } from './nseSeedData.ts';
import { NSE_STOCKS_SEED, generateHistoricalCandles } from './nseSeedData.ts';
import { calculateCharges, computeXIRR } from './indicatorsAndRisk.ts';

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  theme: 'light' | 'dark';
  createdAt: string;
}

export interface RefreshTokenRecord {
  token: string;
  userId: string;
  expiresAtMs: number;
}

export interface WalletRecord {
  userId: string;
  balance: number;
  blockedMargin: number;
  totalDeposited: number;
  totalWithdrawn: number;
}

export interface WalletTransactionRecord {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE_BUY' | 'TRADE_SELL' | 'ORDER_REFUND';
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

export interface HoldingRecord {
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

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';

export interface OrderRecord {
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

export interface WatchlistRecord {
  id: string;
  userId: string;
  name: string;
  symbols: string[];
  createdAt: string;
}

export interface PriceAlertRecord {
  id: string;
  userId: string;
  symbol: string;
  condition: 'ABOVE' | 'BELOW';
  targetPrice: number;
  triggered: boolean;
  createdAt: string;
  triggeredAt?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'ORDER' | 'RISK' | 'ALERT' | 'WALLET';
  read: boolean;
  createdAt: string;
}

export interface LiveStockState {
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

export interface PersistedDb {
  users: UserRecord[];
  refreshTokens: RefreshTokenRecord[];
  wallets: Record<string, WalletRecord>;
  walletTransactions: WalletTransactionRecord[];
  holdings: HoldingRecord[];
  orders: OrderRecord[];
  watchlists: WatchlistRecord[];
  priceAlerts: PriceAlertRecord[];
  notifications: NotificationRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'portfoliopro-db.json');

export class PortfolioStore {
  public db: PersistedDb;
  public stocks: Map<string, LiveStockState> = new Map();
  public candleCache: Map<string, OhlcvBar[]> = new Map();
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

  public getCandles(symbol: string, timeframe: TimeframeKey): OhlcvBar[] {
    const key = `${symbol}:${timeframe}`;
    const stock = this.stocks.get(symbol);
    if (!stock) return [];

    let cached = this.candleCache.get(key);
    if (!cached) {
      cached = generateHistoricalCandles(stock.seed, timeframe, stock.ltp);
      this.candleCache.set(key, cached);
    } else if (cached.length > 0) {
      // Keep last bar synced with current LTP
      const last = cached[cached.length - 1];
      last.close = stock.ltp;
      last.high = Math.max(last.high, stock.ltp);
      last.low = Math.min(last.low, stock.ltp);
    }
    return cached;
  }

  private loadOrSeedDb(): PersistedDb {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedDb;
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
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
      // Fall back to fresh seed
    }

    const seeded = this.createSeededDb();
    this.persistImmediate(seeded);
    return seeded;
  }

  private createSeededDb(): PersistedDb {
    const demoUserId = 'usr_demo_001';
    const now = Date.now();
    const dayMs = 86400 * 1000;
    const passwordHash = bcrypt.hashSync('Demo@1234', 10);

    const demoUser: UserRecord = {
      id: demoUserId,
      fullName: 'Manish Singh',
      email: 'demo@portfoliopro.in',
      passwordHash,
      theme: 'dark',
      createdAt: new Date(now - 95 * dayMs).toISOString(),
    };

    // Initial ₹10,00,000 virtual wallet, with realistic historical trades leaving healthy cash
    const demoPositions: Array<{
      symbol: string;
      qty: number;
      buyPrice: number;
      daysAgo: number;
      sl: number | null;
      tp: number | null;
    }> = [
      { symbol: 'RELIANCE', qty: 45, buyPrice: 2790.00, daysAgo: 84, sl: 2710.00, tp: 3280.00 },
      { symbol: 'TCS', qty: 30, buyPrice: 3915.00, daysAgo: 72, sl: 3820.00, tp: 4480.00 },
      { symbol: 'HDFCBANK', qty: 75, buyPrice: 1645.00, daysAgo: 61, sl: 1610.00, tp: 1920.00 },
      { symbol: 'ICICIBANK', qty: 80, buyPrice: 1198.00, daysAgo: 52, sl: 1180.00, tp: 1450.00 },
      { symbol: 'TATAMOTORS', qty: 95, buyPrice: 952.00, daysAgo: 38, sl: 845.00, tp: 1120.00 },
      { symbol: 'SUNPHARMA', qty: 45, buyPrice: 1712.00, daysAgo: 29, sl: 1690.00, tp: 2050.00 },
      { symbol: 'LT', qty: 22, buyPrice: 3488.00, daysAgo: 19, sl: 3390.00, tp: 3980.00 },
    ];

    let runningCash = 1000000;
    const walletTransactions: WalletTransactionRecord[] = [
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

    const holdings: HoldingRecord[] = [];
    const orders: OrderRecord[] = [];

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

    // Add 1 realistic pending limit order (blocking margin)
    const pendingLimitCharges = calculateCharges('BUY', 1845.00, 15);
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
      limitPrice: 1845.00,
      executedPrice: null,
      status: 'PENDING',
      triggerSource: 'MANUAL',
      stopLossPrice: 1760.00,
      targetPrice: 2040.00,
      charges: pendingLimitCharges.totalCharges,
      totalValue: pendingLimitCharges.turnover,
      createdAt: new Date(now - 2 * 3600 * 1000).toISOString(),
    });

    const watchlists: WatchlistRecord[] = [
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

    const priceAlerts: PriceAlertRecord[] = [
      {
        id: 'alt_demo_1',
        userId: demoUserId,
        symbol: 'RELIANCE',
        condition: 'ABOVE',
        targetPrice: 3020.00,
        triggered: false,
        createdAt: new Date(now - 3 * dayMs).toISOString(),
      },
      {
        id: 'alt_demo_2',
        userId: demoUserId,
        symbol: 'INFY',
        condition: 'BELOW',
        targetPrice: 1850.00,
        triggered: false,
        createdAt: new Date(now - 1 * dayMs).toISOString(),
      },
    ];

    const notifications: NotificationRecord[] = [
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
      users: [demoUser],
      refreshTokens: [],
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

  public scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persistImmediate(this.db);
    }, 800);
  }

  private persistImmediate(data: PersistedDb) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('Failed to persist PortfolioPro DB:', err);
    }
  }

  public createNewUser(fullName: string, email: string, passwordPlain: string): UserRecord {
    const id = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const nowIso = new Date().toISOString();
    const user: UserRecord = {
      id,
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: bcrypt.hashSync(passwordPlain, 10),
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
      id: `txn_${crypto.randomBytes(6).toString('hex')}`,
      userId: id,
      type: 'DEPOSIT',
      amount: 1000000,
      balanceAfter: 1000000,
      description: 'Welcome Virtual Trading Capital (₹10,00,000)',
      createdAt: nowIso,
    });
    this.db.watchlists.push({
      id: `wl_${crypto.randomBytes(5).toString('hex')}`,
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
    this.scheduleSave();
    return user;
  }

  public addNotification(
    userId: string,
    title: string,
    message: string,
    category: NotificationRecord['category']
  ): NotificationRecord {
    const ntf: NotificationRecord = {
      id: `ntf_${crypto.randomBytes(6).toString('hex')}`,
      userId,
      title,
      message,
      category,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.db.notifications.unshift(ntf);
    if (this.db.notifications.length > 250) {
      this.db.notifications = this.db.notifications.slice(0, 250);
    }
    return ntf;
  }

  /**
   * Place Market or Limit Buy/Sell order with strict validation, balance/holding checks, and charge breakdown.
   */
  public placeOrder(params: {
    userId: string;
    symbol: string;
    side: OrderSide;
    orderType: OrderType;
    quantity: number;
    limitPrice?: number | null;
    stopLossPrice?: number | null;
    targetPrice?: number | null;
    triggerSource?: OrderRecord['triggerSource'];
  }): OrderRecord {
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
    if (!stock) {
      throw new Error(`Unknown stock symbol: ${symbol}`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Quantity must be a positive whole number.');
    }
    if (orderType === 'LIMIT' && (!limitPrice || limitPrice <= 0)) {
      throw new Error('Valid limit price is required for Limit orders.');
    }

    const wallet = this.db.wallets[userId];
    if (!wallet) {
      throw new Error('Wallet not found for user.');
    }

    const nowIso = new Date().toISOString();
    const orderId = `ord_${crypto.randomBytes(6).toString('hex')}`;
    const refPrice = orderType === 'LIMIT' && limitPrice ? Number(limitPrice.toFixed(2)) : stock.ltp;
    const estCharges = calculateCharges(side, refPrice, quantity);

    // Check immediate execution eligibility for Limit orders too
    const canExecuteImmediately =
      orderType === 'MARKET' ||
      (orderType === 'LIMIT' &&
        limitPrice !== null &&
        ((side === 'BUY' && stock.ltp <= limitPrice) || (side === 'SELL' && stock.ltp >= limitPrice)));

    if (side === 'BUY') {
      if (wallet.balance < estCharges.netAmount) {
        const rejected: OrderRecord = {
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
        this.scheduleSave();
        return rejected;
      }

      if (canExecuteImmediately) {
        const execPrice = stock.ltp;
        const execCharges = calculateCharges('BUY', execPrice, quantity);
        wallet.balance = Number((wallet.balance - execCharges.netAmount).toFixed(2));

        this.upsertHoldingOnBuy(userId, symbol, quantity, execPrice, stopLossPrice, targetPrice, nowIso);

        const executed: OrderRecord = {
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
          id: `txn_${crypto.randomBytes(6).toString('hex')}`,
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
        this.scheduleSave();
        return executed;
      } else {
        // Queue PENDING BUY Limit order and block margin
        wallet.balance = Number((wallet.balance - estCharges.netAmount).toFixed(2));
        wallet.blockedMargin = Number((wallet.blockedMargin + estCharges.netAmount).toFixed(2));
        const pending: OrderRecord = {
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
        this.scheduleSave();
        return pending;
      }
    } else {
      // SELL order: verify holdings minus already-pending SELL quantities
      const holding = this.db.holdings.find((h) => h.userId === userId && h.symbol === symbol);
      const pendingSellQty = this.db.orders
        .filter((o) => o.userId === userId && o.symbol === symbol && o.side === 'SELL' && o.status === 'PENDING')
        .reduce((acc, o) => acc + o.quantity, 0);
      const availableQty = (holding?.quantity ?? 0) - (triggerSource === 'MANUAL' ? pendingSellQty : 0);

      if (!holding || availableQty < quantity) {
        const rejected: OrderRecord = {
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
        this.scheduleSave();
        return rejected;
      }

      if (canExecuteImmediately) {
        const execPrice = stock.ltp;
        const execCharges = calculateCharges('SELL', execPrice, quantity);
        wallet.balance = Number((wallet.balance + execCharges.netAmount).toFixed(2));

        this.reduceHoldingOnSell(userId, symbol, quantity, nowIso);

        const executed: OrderRecord = {
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
          id: `txn_${crypto.randomBytes(6).toString('hex')}`,
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
        this.scheduleSave();
        return executed;
      } else {
        const pending: OrderRecord = {
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
        this.scheduleSave();
        return pending;
      }
    }
  }

  public cancelPendingOrder(userId: string, orderId: string): OrderRecord {
    const order = this.db.orders.find((o) => o.id === orderId && o.userId === userId);
    if (!order) {
      throw new Error('Order not found.');
    }
    if (order.status !== 'PENDING') {
      throw new Error(`Only PENDING orders can be cancelled (current status: ${order.status}).`);
    }

    order.status = 'CANCELLED';
    if (order.side === 'BUY' && order.limitPrice) {
      const blocked = calculateCharges('BUY', order.limitPrice, order.quantity).netAmount;
      const wallet = this.db.wallets[userId];
      if (wallet) {
        wallet.balance = Number((wallet.balance + blocked).toFixed(2));
        wallet.blockedMargin = Number(Math.max(0, wallet.blockedMargin - blocked).toFixed(2));
      }
    }
    this.scheduleSave();
    return order;
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
        id: `hld_${crypto.randomBytes(6).toString('hex')}`,
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

  public getPortfolioSummary(userId: string) {
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

    // Sector allocation
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

    // XIRR cashflows from executed orders + current value
    const execOrders = this.db.orders.filter((o) => o.userId === userId && o.status === 'EXECUTED');
    const cashflows: { amount: number; timestampMs: number }[] = execOrders.map((o) => ({
      amount: o.side === 'BUY' ? -(o.totalValue + o.charges) : o.totalValue - o.charges,
      timestampMs: new Date(o.executedAt ?? o.createdAt).getTime(),
    }));
    if (currentValue > 0) {
      cashflows.push({ amount: currentValue, timestampMs: Date.now() });
    }
    const xirrPct = cashflows.length >= 2 ? computeXIRR(cashflows) : totalPnlPct;

    const totalAccountEquity = Number((currentValue + wallet.balance + wallet.blockedMargin).toFixed(2));

    return {
      totalAccountEquity,
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

  public getRiskReport(userId: string) {
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

    // Diversification dampening factor (imperfect correlation ~0.58 across sectors)
    const diversificationFactor = Math.max(0.68, Math.min(1.0, Math.sqrt(0.42 * (hhi / 10000) + 0.58)));
    const portfolioAnnualVol = weightedVol * diversificationFactor;
    const dailyVol = portfolioAnnualVol / Math.sqrt(252);
    const dailyVar95 = Number((1.645 * dailyVol * currentValue).toFixed(2));
    const dailyVar95Pct = Number(((dailyVar95 / currentValue) * 100).toFixed(2));

    // Estimate peak-to-trough drawdown over last 60 daily candles weighted by holdings
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

    // Composite Risk Score (0-100)
    const concComponent = Math.min(35, (hhi / 3200) * 35);
    const sectorComponent = Math.min(25, (topSectorWeightPct / 55) * 25);
    const betaVolComponent = Math.min(28, ((weightedBeta * 0.5 + (portfolioAnnualVol / 0.22) * 0.5) / 1.45) * 28);
    const unprotectedPenalty = ((100 - stopLossCoveragePct) / 100) * 12;
    const riskScore = Math.round(
      Math.max(10, Math.min(96, concComponent + sectorComponent + betaVolComponent + unprotectedPenalty))
    );

    const riskLabel: 'Conservative' | 'Moderate' | 'Elevated' | 'Aggressive' =
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
}
