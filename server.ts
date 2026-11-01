import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { PortfolioStore } from './server/store.ts';
import type { TimeframeKey } from './server/nseSeedData.ts';
import {
  buildTechnicalAnalysis,
  buildFundamentalAnalysis,
  calculateCharges,
} from './server/indicatorsAndRisk.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'portfoliopro_access_secret_key_2026_nse';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'portfoliopro_refresh_secret_key_2026_nse';

const store = new PortfolioStore();

interface AuthPayload {
  sub: string;
  email: string;
  name: string;
}

interface AuthedRequest extends Request {
  user?: AuthPayload;
}

function issueTokens(userId: string, email: string, name: string) {
  const accessToken = jwt.sign({ sub: userId, email, name }, JWT_ACCESS_SECRET, {
    expiresIn: '30m',
  });
  const refreshToken = jwt.sign({ sub: userId, jti: crypto.randomUUID() }, JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });

  // Clean expired refresh tokens and store new one
  const now = Date.now();
  store.db.refreshTokens = store.db.refreshTokens.filter((rt) => rt.expiresAtMs > now);
  store.db.refreshTokens.push({
    token: refreshToken,
    userId,
    expiresAtMs: now + 7 * 86400 * 1000,
  });
  store.scheduleSave();

  return { accessToken, refreshToken };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Access token invalid or expired.' });
  }
}

function formatStockDto(symbol: string) {
  const s = store.stocks.get(symbol);
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

function computeIndices() {
  const all = Array.from(store.stocks.values());
  const avgPct = all.reduce((acc, s) => acc + s.changePct, 0) / Math.max(1, all.length);
  const banks = all.filter((s) => s.seed.sector === 'Banking & Financials');
  const bankPct = banks.reduce((acc, s) => acc + s.changePct, 0) / Math.max(1, banks.length);
  const it = all.filter((s) => s.seed.sector === 'Information Technology');
  const itPct = it.reduce((acc, s) => acc + s.changePct, 0) / Math.max(1, it.length);

  const niftyBase = 24680.5;
  const niftyVal = Number((niftyBase * (1 + avgPct / 100)).toFixed(2));
  const niftyChg = Number((niftyVal - niftyBase).toFixed(2));

  const sensexBase = 81145.2;
  const sensexVal = Number((sensexBase * (1 + avgPct / 100)).toFixed(2));
  const sensexChg = Number((sensexVal - sensexBase).toFixed(2));

  const bankBase = 52340.0;
  const bankVal = Number((bankBase * (1 + bankPct / 100)).toFixed(2));
  const bankChg = Number((bankVal - bankBase).toFixed(2));

  const itBase = 42190.0;
  const itVal = Number((itBase * (1 + itPct / 100)).toFixed(2));
  const itChg = Number((itVal - itBase).toFixed(2));

  return [
    { name: 'NIFTY 50', value: niftyVal, change: niftyChg, changePct: Number(avgPct.toFixed(2)) },
    { name: 'SENSEX', value: sensexVal, change: sensexChg, changePct: Number(avgPct.toFixed(2)) },
    { name: 'NIFTY BANK', value: bankVal, change: bankChg, changePct: Number(bankPct.toFixed(2)) },
    { name: 'NIFTY IT', value: itVal, change: itChg, changePct: Number(itPct.toFixed(2)) },
  ];
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const wsClients = new Map<WebSocket, { userId: string | null }>();

  wss.on('connection', (ws, req) => {
    let userId: string | null = null;
    try {
      const url = new URL(req.url || '/ws', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      if (token) {
        const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as AuthPayload;
        userId = decoded.sub;
      }
    } catch {
      userId = null;
    }

    wsClients.set(ws, { userId });

    // Send immediate market snapshot
    const stocksSnapshot = Array.from(store.stocks.keys())
      .map((sym) => formatStockDto(sym))
      .filter(Boolean);
    ws.send(
      JSON.stringify({
        type: 'MARKET_SNAPSHOT',
        indices: computeIndices(),
        stocks: stocksSnapshot,
        marketOpen: true,
        serverTime: new Date().toISOString(),
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'AUTH' && typeof msg.token === 'string') {
          const decoded = jwt.verify(msg.token, JWT_ACCESS_SECRET) as AuthPayload;
          wsClients.set(ws, { userId: decoded.sub });
        }
      } catch {
        // Ignore malformed frame
      }
    });

    ws.on('close', () => {
      wsClients.delete(ws);
    });
  });

  function sendUserEvent(userId: string, eventType: string, payload: unknown) {
    const serialized = JSON.stringify({ type: 'USER_EVENT', eventType, payload });
    for (const [client, meta] of wsClients.entries()) {
      if (meta.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  // Live Market Simulation Loop (1.5s interval) + Auto Limit / SL / TP / Price Alert execution
  setInterval(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    const barBucket = Math.floor(nowSec / 300) * 300;
    const marketPulse = (Math.random() - 0.498) * 0.0008; // Subtle market-wide correlation
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

    for (const [symbol, st] of store.stocks.entries()) {
      // Realistic random walk scaled by stock volatility
      const stepSigma = (st.seed.annualVolatility / 0.21) * 0.0019;
      const shock = (Math.random() + Math.random() + Math.random() - 1.5) * stepSigma + marketPulse * st.seed.beta;
      // Mild mean reversion so prices stay realistic over long sessions
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

      // Update sparkline (keep 28 recent points)
      if (Math.random() < 0.35) {
        st.sparkline = [...st.sparkline.slice(-27), nextPrice];
      } else {
        st.sparkline[st.sparkline.length - 1] = nextPrice;
      }

      // Update live 1D candle
      const candles1D = store.candleCache.get(`${symbol}:1D`);
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

    // 1. Check & Auto-Execute Pending Limit Orders
    const pendingOrders = store.db.orders.filter((o) => o.status === 'PENDING' && o.orderType === 'LIMIT');
    for (const ord of pendingOrders) {
      const st = store.stocks.get(ord.symbol);
      if (!st || !ord.limitPrice) continue;

      const hitBuy = ord.side === 'BUY' && st.ltp <= ord.limitPrice;
      const hitSell = ord.side === 'SELL' && st.ltp >= ord.limitPrice;
      if (!hitBuy && !hitSell) continue;

      const wallet = store.db.wallets[ord.userId];
      if (!wallet) continue;
      const nowIso = new Date().toISOString();
      const execPrice = st.ltp;

      if (ord.side === 'BUY') {
        const originallyBlocked = calculateCharges('BUY', ord.limitPrice, ord.quantity).netAmount;
        const actualCost = calculateCharges('BUY', execPrice, ord.quantity);
        // Release blocked margin, refund difference if executed cheaper than limit
        wallet.blockedMargin = Number(Math.max(0, wallet.blockedMargin - originallyBlocked).toFixed(2));
        const priceSavings = Number((originallyBlocked - actualCost.netAmount).toFixed(2));
        if (priceSavings !== 0) {
          wallet.balance = Number((wallet.balance + priceSavings).toFixed(2));
        }

        // Update holding
        const existing = store.db.holdings.find((h) => h.userId === ord.userId && h.symbol === ord.symbol);
        if (existing) {
          const totalCost = existing.avgBuyPrice * existing.quantity + execPrice * ord.quantity;
          existing.quantity += ord.quantity;
          existing.avgBuyPrice = Number((totalCost / existing.quantity).toFixed(2));
          existing.investedAmount = Number((existing.avgBuyPrice * existing.quantity).toFixed(2));
          if (ord.stopLossPrice) existing.stopLossPrice = ord.stopLossPrice;
          if (ord.targetPrice) existing.targetPrice = ord.targetPrice;
          existing.updatedAt = nowIso;
        } else {
          store.db.holdings.push({
            id: `hld_${crypto.randomBytes(6).toString('hex')}`,
            userId: ord.userId,
            symbol: ord.symbol,
            quantity: ord.quantity,
            avgBuyPrice: execPrice,
            investedAmount: Number((execPrice * ord.quantity).toFixed(2)),
            stopLossPrice: ord.stopLossPrice ?? null,
            targetPrice: ord.targetPrice ?? null,
            firstBoughtAt: nowIso,
            updatedAt: nowIso,
          });
        }

        ord.status = 'EXECUTED';
        ord.executedPrice = execPrice;
        ord.executedAt = nowIso;
        ord.triggerSource = 'LIMIT_MATCH';
        ord.charges = actualCost.totalCharges;
        ord.totalValue = actualCost.turnover;

        store.db.walletTransactions.unshift({
          id: `txn_${crypto.randomBytes(6).toString('hex')}`,
          userId: ord.userId,
          type: 'TRADE_BUY',
          amount: -actualCost.netAmount,
          balanceAfter: wallet.balance,
          description: `Limit Buy Executed: ${ord.quantity} ${ord.symbol} @ ₹${execPrice.toFixed(2)}`,
          referenceId: ord.id,
          createdAt: nowIso,
        });

        store.addNotification(
          ord.userId,
          `Limit Buy Filled — ${ord.symbol}`,
          `Filled ${ord.quantity} ${ord.symbol} @ ₹${execPrice.toFixed(2)} (Limit ₹${ord.limitPrice.toFixed(2)}).`,
          'ORDER'
        );
        store.scheduleSave();
        sendUserEvent(ord.userId, 'ORDER_EXECUTED', ord);
      } else {
        // SELL Limit
        const holdingIdx = store.db.holdings.findIndex(
          (h) => h.userId === ord.userId && h.symbol === ord.symbol
        );
        if (holdingIdx === -1 || store.db.holdings[holdingIdx].quantity < ord.quantity) {
          ord.status = 'REJECTED';
          ord.rejectionReason = 'Holdings no longer available at limit trigger time.';
          store.scheduleSave();
          continue;
        }

        const actualProceeds = calculateCharges('SELL', execPrice, ord.quantity);
        wallet.balance = Number((wallet.balance + actualProceeds.netAmount).toFixed(2));

        const h = store.db.holdings[holdingIdx];
        if (h.quantity - ord.quantity <= 0) {
          store.db.holdings.splice(holdingIdx, 1);
        } else {
          h.quantity -= ord.quantity;
          h.investedAmount = Number((h.avgBuyPrice * h.quantity).toFixed(2));
          h.updatedAt = nowIso;
        }

        ord.status = 'EXECUTED';
        ord.executedPrice = execPrice;
        ord.executedAt = nowIso;
        ord.triggerSource = 'LIMIT_MATCH';
        ord.charges = actualProceeds.totalCharges;
        ord.totalValue = actualProceeds.turnover;

        store.db.walletTransactions.unshift({
          id: `txn_${crypto.randomBytes(6).toString('hex')}`,
          userId: ord.userId,
          type: 'TRADE_SELL',
          amount: actualProceeds.netAmount,
          balanceAfter: wallet.balance,
          description: `Limit Sell Executed: ${ord.quantity} ${ord.symbol} @ ₹${execPrice.toFixed(2)}`,
          referenceId: ord.id,
          createdAt: nowIso,
        });

        store.addNotification(
          ord.userId,
          `Limit Sell Filled — ${ord.symbol}`,
          `Sold ${ord.quantity} ${ord.symbol} @ ₹${execPrice.toFixed(2)} (Limit ₹${ord.limitPrice.toFixed(2)}).`,
          'ORDER'
        );
        store.scheduleSave();
        sendUserEvent(ord.userId, 'ORDER_EXECUTED', ord);
      }
    }

    // 2. Check & Auto-Trigger Position Stop-Loss and Target
    const holdingsSnapshot = [...store.db.holdings];
    for (const h of holdingsSnapshot) {
      const st = store.stocks.get(h.symbol);
      if (!st) continue;
      if (h.stopLossPrice && h.stopLossPrice > 0 && st.ltp <= h.stopLossPrice) {
        const execOrder = store.placeOrder({
          userId: h.userId,
          symbol: h.symbol,
          side: 'SELL',
          orderType: 'MARKET',
          quantity: h.quantity,
          triggerSource: 'STOP_LOSS',
        });
        sendUserEvent(h.userId, 'RISK_TRIGGERED', {
          trigger: 'STOP_LOSS',
          symbol: h.symbol,
          order: execOrder,
        });
      } else if (h.targetPrice && h.targetPrice > 0 && st.ltp >= h.targetPrice) {
        const execOrder = store.placeOrder({
          userId: h.userId,
          symbol: h.symbol,
          side: 'SELL',
          orderType: 'MARKET',
          quantity: h.quantity,
          triggerSource: 'TARGET',
        });
        sendUserEvent(h.userId, 'RISK_TRIGGERED', {
          trigger: 'TARGET',
          symbol: h.symbol,
          order: execOrder,
        });
      }
    }

    // 3. Check & Fire Price Alerts
    for (const alert of store.db.priceAlerts) {
      if (alert.triggered) continue;
      const st = store.stocks.get(alert.symbol);
      if (!st) continue;
      const hit =
        (alert.condition === 'ABOVE' && st.ltp >= alert.targetPrice) ||
        (alert.condition === 'BELOW' && st.ltp <= alert.targetPrice);
      if (hit) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        const ntf = store.addNotification(
          alert.userId,
          `Price Alert Hit — ${alert.symbol}`,
          `${alert.symbol} crossed ${alert.condition === 'ABOVE' ? 'above' : 'below'} ₹${alert.targetPrice.toFixed(2)} (LTP ₹${st.ltp.toFixed(2)}).`,
          'ALERT'
        );
        store.scheduleSave();
        sendUserEvent(alert.userId, 'ALERT_TRIGGERED', { alert, notification: ntf });
      }
    }

    // Broadcast live ticks to all connected WebSocket clients
    if (wsClients.size > 0) {
      const packet = JSON.stringify({
        type: 'PRICE_TICKS',
        indices: computeIndices(),
        ticks: changedTicks,
        timestamp: Date.now(),
      });
      for (const client of wsClients.keys()) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(packet);
        }
      }
    }
  }, 1500);

  // ==========================
  // AUTH ROUTES
  // ==========================
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { fullName, email, password } = req.body ?? {};
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      res.status(400).json({ success: false, message: 'Full name must be at least 2 characters.' });
      return;
    }
    const cleanEmail = String(email || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ success: false, message: 'Enter a valid email address.' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }
    if (store.db.users.some((u) => u.email === cleanEmail)) {
      res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    const user = store.createNewUser(fullName, cleanEmail, password);
    const tokens = issueTokens(user.id, user.email, user.fullName);
    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, fullName: user.fullName, email: user.email, theme: user.theme },
        ...tokens,
      },
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    const cleanEmail = String(email || '').toLowerCase().trim();
    const user = store.db.users.find((u) => u.email === cleanEmail);
    if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const tokens = issueTokens(user.id, user.email, user.fullName);
    res.json({
      success: true,
      data: {
        user: { id: user.id, fullName: user.fullName, email: user.email, theme: user.theme },
        ...tokens,
      },
    });
  });

  app.post('/api/auth/refresh', (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token is required.' });
      return;
    }
    const storedIdx = store.db.refreshTokens.findIndex((rt) => rt.token === refreshToken);
    if (storedIdx === -1) {
      res.status(401).json({ success: false, message: 'Refresh token revoked or unknown.' });
      return;
    }
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { sub: string };
      const user = store.db.users.find((u) => u.id === decoded.sub);
      if (!user) {
        res.status(401).json({ success: false, message: 'User not found.' });
        return;
      }
      store.db.refreshTokens.splice(storedIdx, 1);
      const tokens = issueTokens(user.id, user.email, user.fullName);
      res.json({
        success: true,
        data: {
          user: { id: user.id, fullName: user.fullName, email: user.email, theme: user.theme },
          ...tokens,
        },
      });
    } catch {
      res.status(401).json({ success: false, message: 'Refresh token expired.' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};
    if (refreshToken) {
      store.db.refreshTokens = store.db.refreshTokens.filter((rt) => rt.token !== refreshToken);
      store.scheduleSave();
    }
    res.json({ success: true, data: { loggedOut: true } });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = store.db.users.find((u) => u.id === req.user!.sub);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    res.json({
      success: true,
      data: { id: user.id, fullName: user.fullName, email: user.email, theme: user.theme },
    });
  });

  app.put('/api/auth/theme', requireAuth, (req: AuthedRequest, res: Response) => {
    const { theme } = req.body ?? {};
    if (theme !== 'light' && theme !== 'dark') {
      res.status(400).json({ success: false, message: 'Theme must be light or dark.' });
      return;
    }
    const user = store.db.users.find((u) => u.id === req.user!.sub);
    if (user) {
      user.theme = theme;
      store.scheduleSave();
    }
    res.json({ success: true, data: { theme } });
  });

  // ==========================
  // MARKET DATA ROUTES
  // ==========================
  app.get('/api/market/stocks', (req: Request, res: Response) => {
    const sector = String(req.query.sector || '').trim();
    const q = String(req.query.q || '').toLowerCase().trim();

    let list = Array.from(store.stocks.keys())
      .map((sym) => formatStockDto(sym)!)
      .filter(Boolean);

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

    res.json({
      success: true,
      data: {
        indices: computeIndices(),
        stocks: list,
        sectors: Array.from(new Set(Array.from(store.stocks.values()).map((s) => s.seed.sector))),
      },
    });
  });

  app.get('/api/market/stocks/:symbol', (req: Request, res: Response) => {
    const sym = String(req.params.symbol || '').toUpperCase();
    const dto = formatStockDto(sym);
    if (!dto) {
      res.status(404).json({ success: false, message: `Stock ${sym} not found.` });
      return;
    }
    const st = store.stocks.get(sym)!;
    res.json({
      success: true,
      data: {
        ...dto,
        about: st.seed.about,
        catalysts: st.seed.catalysts,
        eps: st.seed.eps,
        debtToEquity: st.seed.debtToEquity,
        revenueGrowthYoY: st.seed.revenueGrowthYoY,
        netProfitMargin: st.seed.netProfitMargin,
      },
    });
  });

  app.get('/api/market/stocks/:symbol/candles', (req: Request, res: Response) => {
    const sym = String(req.params.symbol || '').toUpperCase();
    const tfRaw = String(req.query.timeframe || '1D').toUpperCase();
    const validTfs: TimeframeKey[] = ['1D', '1W', '1M', '1Y', '5Y'];
    const timeframe: TimeframeKey = validTfs.includes(tfRaw as TimeframeKey) ? (tfRaw as TimeframeKey) : '1D';

    if (!store.stocks.has(sym)) {
      res.status(404).json({ success: false, message: `Stock ${sym} not found.` });
      return;
    }

    const candles = store.getCandles(sym, timeframe);
    res.json({ success: true, data: { symbol: sym, timeframe, candles } });
  });

  // ==========================
  // TECHNICAL & FUNDAMENTAL ANALYSIS ROUTES
  // ==========================
  app.get('/api/analysis/:symbol/technicals', (req: Request, res: Response) => {
    const sym = String(req.params.symbol || '').toUpperCase();
    const tfRaw = String(req.query.timeframe || '1Y').toUpperCase();
    const validTfs: TimeframeKey[] = ['1D', '1W', '1M', '1Y', '5Y'];
    const timeframe: TimeframeKey = validTfs.includes(tfRaw as TimeframeKey) ? (tfRaw as TimeframeKey) : '1Y';

    if (!store.stocks.has(sym)) {
      res.status(404).json({ success: false, message: `Stock ${sym} not found.` });
      return;
    }
    const candles = store.getCandles(sym, timeframe);
    const payload = buildTechnicalAnalysis(sym, timeframe, candles);
    res.json({ success: true, data: payload });
  });

  app.get('/api/analysis/:symbol/fundamentals', (req: Request, res: Response) => {
    const sym = String(req.params.symbol || '').toUpperCase();
    const st = store.stocks.get(sym);
    if (!st) {
      res.status(404).json({ success: false, message: `Stock ${sym} not found.` });
      return;
    }
    const payload = buildFundamentalAnalysis(st.seed, st.ltp);
    res.json({ success: true, data: payload });
  });

  // ==========================
  // ORDERS & TRADE EXECUTION ROUTES
  // ==========================
  app.post('/api/orders/estimate', requireAuth, (req: AuthedRequest, res: Response) => {
    const { symbol, side, orderType, quantity, limitPrice } = req.body ?? {};
    const sym = String(symbol || '').toUpperCase();
    const st = store.stocks.get(sym);
    if (!st) {
      res.status(404).json({ success: false, message: `Unknown stock ${sym}` });
      return;
    }
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const price = orderType === 'LIMIT' && Number(limitPrice) > 0 ? Number(limitPrice) : st.ltp;
    const charges = calculateCharges(side === 'SELL' ? 'SELL' : 'BUY', price, qty);
    res.json({ success: true, data: { referencePrice: price, quantity: qty, ...charges } });
  });

  app.post('/api/orders', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const { symbol, side, orderType, quantity, limitPrice, stopLossPrice, targetPrice } = req.body ?? {};
      const order = store.placeOrder({
        userId: req.user!.sub,
        symbol: String(symbol || '').toUpperCase(),
        side: side === 'SELL' ? 'SELL' : 'BUY',
        orderType: orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
        quantity: Number(quantity),
        limitPrice: limitPrice ? Number(limitPrice) : null,
        stopLossPrice: stopLossPrice ? Number(stopLossPrice) : null,
        targetPrice: targetPrice ? Number(targetPrice) : null,
        triggerSource: 'MANUAL',
      });
      res.status(order.status === 'REJECTED' ? 422 : 201).json({
        success: order.status !== 'REJECTED',
        message: order.rejectionReason || `Order ${order.status.toLowerCase()}`,
        data: order,
      });
    } catch (err: unknown) {
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : 'Unable to place order.',
      });
    }
  });

  app.get('/api/orders', requireAuth, (req: AuthedRequest, res: Response) => {
    const statusFilter = String(req.query.status || 'ALL').toUpperCase();
    const page = Math.max(0, Number(req.query.page) || 0);
    const size = Math.min(100, Math.max(5, Number(req.query.size) || 25));

    let userOrders = store.db.orders.filter((o) => o.userId === req.user!.sub);
    if (statusFilter !== 'ALL') {
      userOrders = userOrders.filter((o) => o.status === statusFilter);
    }

    const totalElements = userOrders.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / size));
    const items = userOrders.slice(page * size, page * size + size).map((o) => ({
      ...o,
      currentLtp: store.stocks.get(o.symbol)?.ltp ?? o.requestedPrice,
      stockName: store.stocks.get(o.symbol)?.seed.name ?? o.symbol,
    }));

    res.json({
      success: true,
      data: {
        items,
        page,
        size,
        totalElements,
        totalPages,
      },
    });
  });

  app.post('/api/orders/:id/cancel', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const cancelled = store.cancelPendingOrder(req.user!.sub, String(req.params.id));
      res.json({ success: true, data: cancelled });
    } catch (err: unknown) {
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : 'Unable to cancel order.',
      });
    }
  });

  // ==========================
  // PORTFOLIO & RISK ROUTES
  // ==========================
  app.get('/api/portfolio/summary', requireAuth, (req: AuthedRequest, res: Response) => {
    const summary = store.getPortfolioSummary(req.user!.sub);
    res.json({ success: true, data: summary });
  });

  app.put('/api/portfolio/holdings/:symbol/risk', requireAuth, (req: AuthedRequest, res: Response) => {
    const sym = String(req.params.symbol || '').toUpperCase();
    const { stopLossPrice, targetPrice } = req.body ?? {};
    const holding = store.db.holdings.find((h) => h.userId === req.user!.sub && h.symbol === sym);
    if (!holding) {
      res.status(404).json({ success: false, message: `No active holding found for ${sym}.` });
      return;
    }

    const sl = stopLossPrice === null || stopLossPrice === '' ? null : Number(stopLossPrice);
    const tp = targetPrice === null || targetPrice === '' ? null : Number(targetPrice);
    if (sl !== null && (Number.isNaN(sl) || sl < 0)) {
      res.status(400).json({ success: false, message: 'Invalid stop-loss price.' });
      return;
    }
    if (tp !== null && (Number.isNaN(tp) || tp < 0)) {
      res.status(400).json({ success: false, message: 'Invalid target price.' });
      return;
    }

    holding.stopLossPrice = sl && sl > 0 ? Number(sl.toFixed(2)) : null;
    holding.targetPrice = tp && tp > 0 ? Number(tp.toFixed(2)) : null;
    holding.updatedAt = new Date().toISOString();
    store.scheduleSave();

    res.json({ success: true, data: holding });
  });

  app.get('/api/risk/summary', requireAuth, (req: AuthedRequest, res: Response) => {
    const report = store.getRiskReport(req.user!.sub);
    res.json({ success: true, data: report });
  });

  // ==========================
  // WATCHLISTS & PRICE ALERTS ROUTES
  // ==========================
  app.get('/api/watchlists', requireAuth, (req: AuthedRequest, res: Response) => {
    const lists = store.db.watchlists
      .filter((w) => w.userId === req.user!.sub)
      .map((w) => ({
        ...w,
        items: w.symbols.map((sym) => formatStockDto(sym)).filter(Boolean),
      }));
    const alerts = store.db.priceAlerts
      .filter((a) => a.userId === req.user!.sub)
      .map((a) => ({
        ...a,
        currentLtp: store.stocks.get(a.symbol)?.ltp ?? 0,
      }));
    res.json({ success: true, data: { watchlists: lists, alerts } });
  });

  app.post('/api/watchlists', requireAuth, (req: AuthedRequest, res: Response) => {
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 40) {
      res.status(400).json({ success: false, message: 'Watchlist name must be 1–40 characters.' });
      return;
    }
    const created = {
      id: `wl_${crypto.randomBytes(5).toString('hex')}`,
      userId: req.user!.sub,
      name,
      symbols: [] as string[],
      createdAt: new Date().toISOString(),
    };
    store.db.watchlists.push(created);
    store.scheduleSave();
    res.status(201).json({ success: true, data: { ...created, items: [] } });
  });

  app.delete('/api/watchlists/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const userLists = store.db.watchlists.filter((w) => w.userId === req.user!.sub);
    if (userLists.length <= 1) {
      res.status(400).json({ success: false, message: 'At least one watchlist must remain.' });
      return;
    }
    store.db.watchlists = store.db.watchlists.filter(
      (w) => !(w.id === req.params.id && w.userId === req.user!.sub)
    );
    store.scheduleSave();
    res.json({ success: true, data: { deleted: true } });
  });

  app.post('/api/watchlists/:id/items', requireAuth, (req: AuthedRequest, res: Response) => {
    const sym = String(req.body?.symbol || '').toUpperCase();
    if (!store.stocks.has(sym)) {
      res.status(404).json({ success: false, message: `Unknown stock ${sym}.` });
      return;
    }
    const wl = store.db.watchlists.find((w) => w.id === req.params.id && w.userId === req.user!.sub);
    if (!wl) {
      res.status(404).json({ success: false, message: 'Watchlist not found.' });
      return;
    }
    if (!wl.symbols.includes(sym)) {
      wl.symbols.push(sym);
      store.scheduleSave();
    }
    res.json({
      success: true,
      data: { ...wl, items: wl.symbols.map((s) => formatStockDto(s)).filter(Boolean) },
    });
  });

  app.delete('/api/watchlists/:id/items/:symbol', requireAuth, (req: AuthedRequest, res: Response) => {
    const sym = String(req.params.symbol || '').toUpperCase();
    const wl = store.db.watchlists.find((w) => w.id === req.params.id && w.userId === req.user!.sub);
    if (!wl) {
      res.status(404).json({ success: false, message: 'Watchlist not found.' });
      return;
    }
    wl.symbols = wl.symbols.filter((s) => s !== sym);
    store.scheduleSave();
    res.json({
      success: true,
      data: { ...wl, items: wl.symbols.map((s) => formatStockDto(s)).filter(Boolean) },
    });
  });

  app.put('/api/watchlists/:id/reorder', requireAuth, (req: AuthedRequest, res: Response) => {
    const symbols = Array.isArray(req.body?.symbols)
      ? req.body.symbols.map((s: unknown) => String(s).toUpperCase()).filter((s: string) => store.stocks.has(s))
      : [];
    const wl = store.db.watchlists.find((w) => w.id === req.params.id && w.userId === req.user!.sub);
    if (!wl) {
      res.status(404).json({ success: false, message: 'Watchlist not found.' });
      return;
    }
    wl.symbols = Array.from(new Set(symbols));
    store.scheduleSave();
    res.json({
      success: true,
      data: { ...wl, items: wl.symbols.map((s) => formatStockDto(s)).filter(Boolean) },
    });
  });

  app.post('/api/alerts', requireAuth, (req: AuthedRequest, res: Response) => {
    const sym = String(req.body?.symbol || '').toUpperCase();
    const condition = req.body?.condition === 'BELOW' ? 'BELOW' : 'ABOVE';
    const targetPrice = Number(req.body?.targetPrice);
    if (!store.stocks.has(sym) || Number.isNaN(targetPrice) || targetPrice <= 0) {
      res.status(400).json({ success: false, message: 'Valid symbol and target price required.' });
      return;
    }
    const created = {
      id: `alt_${crypto.randomBytes(5).toString('hex')}`,
      userId: req.user!.sub,
      symbol: sym,
      condition: condition as 'ABOVE' | 'BELOW',
      targetPrice: Number(targetPrice.toFixed(2)),
      triggered: false,
      createdAt: new Date().toISOString(),
    };
    store.db.priceAlerts.unshift(created);
    store.scheduleSave();
    res.status(201).json({ success: true, data: created });
  });

  app.delete('/api/alerts/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    store.db.priceAlerts = store.db.priceAlerts.filter(
      (a) => !(a.id === req.params.id && a.userId === req.user!.sub)
    );
    store.scheduleSave();
    res.json({ success: true, data: { deleted: true } });
  });

  // ==========================
  // WALLET & LEDGER ROUTES
  // ==========================
  app.get('/api/wallet', requireAuth, (req: AuthedRequest, res: Response) => {
    const page = Math.max(0, Number(req.query.page) || 0);
    const size = Math.min(100, Math.max(5, Number(req.query.size) || 20));
    const wallet = store.db.wallets[req.user!.sub] ?? {
      userId: req.user!.sub,
      balance: 0,
      blockedMargin: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
    };
    const txns = store.db.walletTransactions
      .filter((t) => t.userId === req.user!.sub)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: {
        wallet,
        transactions: txns.slice(page * size, page * size + size),
        page,
        size,
        totalElements: txns.length,
        totalPages: Math.max(1, Math.ceil(txns.length / size)),
      },
    });
  });

  app.post('/api/wallet/deposit', requireAuth, (req: AuthedRequest, res: Response) => {
    const amount = Number(req.body?.amount);
    if (Number.isNaN(amount) || amount < 100 || amount > 50000000) {
      res.status(400).json({ success: false, message: 'Deposit amount must be between ₹100 and ₹5,00,00,000.' });
      return;
    }
    const wallet = store.db.wallets[req.user!.sub];
    if (!wallet) {
      res.status(404).json({ success: false, message: 'Wallet not found.' });
      return;
    }
    const cleanAmt = Number(amount.toFixed(2));
    wallet.balance = Number((wallet.balance + cleanAmt).toFixed(2));
    wallet.totalDeposited = Number((wallet.totalDeposited + cleanAmt).toFixed(2));
    const txn = {
      id: `txn_${crypto.randomBytes(6).toString('hex')}`,
      userId: req.user!.sub,
      type: 'DEPOSIT' as const,
      amount: cleanAmt,
      balanceAfter: wallet.balance,
      description: String(req.body?.note || 'Instant UPI / NetBanking Virtual Deposit'),
      createdAt: new Date().toISOString(),
    };
    store.db.walletTransactions.unshift(txn);
    store.scheduleSave();
    res.json({ success: true, data: { wallet, transaction: txn } });
  });

  app.post('/api/wallet/withdraw', requireAuth, (req: AuthedRequest, res: Response) => {
    const amount = Number(req.body?.amount);
    const wallet = store.db.wallets[req.user!.sub];
    if (!wallet) {
      res.status(404).json({ success: false, message: 'Wallet not found.' });
      return;
    }
    if (Number.isNaN(amount) || amount < 100) {
      res.status(400).json({ success: false, message: 'Minimum withdrawal amount is ₹100.' });
      return;
    }
    const cleanAmt = Number(amount.toFixed(2));
    if (cleanAmt > wallet.balance) {
      res.status(400).json({
        success: false,
        message: `Insufficient withdrawable cash (Available: ₹${wallet.balance.toLocaleString('en-IN')}).`,
      });
      return;
    }
    wallet.balance = Number((wallet.balance - cleanAmt).toFixed(2));
    wallet.totalWithdrawn = Number((wallet.totalWithdrawn + cleanAmt).toFixed(2));
    const txn = {
      id: `txn_${crypto.randomBytes(6).toString('hex')}`,
      userId: req.user!.sub,
      type: 'WITHDRAWAL' as const,
      amount: -cleanAmt,
      balanceAfter: wallet.balance,
      description: String(req.body?.note || 'Bank Settlement Payout'),
      createdAt: new Date().toISOString(),
    };
    store.db.walletTransactions.unshift(txn);
    store.scheduleSave();
    res.json({ success: true, data: { wallet, transaction: txn } });
  });

  // ==========================
  // NOTIFICATIONS ROUTES
  // ==========================
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res: Response) => {
    const list = store.db.notifications.filter((n) => n.userId === req.user!.sub).slice(0, 40);
    const unreadCount = list.filter((n) => !n.read).length;
    res.json({ success: true, data: { notifications: list, unreadCount } });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res: Response) => {
    for (const n of store.db.notifications) {
      if (n.userId === req.user!.sub) n.read = true;
    }
    store.scheduleSave();
    res.json({ success: true, data: { readAll: true } });
  });

  // Optional local export archive handler (ignored in production / Vercel builds)
  app.get('/export/:filename', (req: Request, res: Response) => {
    const safeName = path.basename(String(req.params.filename || ''));
    if (!safeName) {
      res.status(404).end();
      return;
    }
    const candidate = path.resolve(process.cwd(), '.deliverables', safeName);
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
      res.status(404).end();
      return;
    }
    const ext = path.extname(safeName).toLowerCase();
    const mime =
      ext === '.zip'
        ? 'application/zip'
        : ext === '.pdf'
          ? 'application/pdf'
          : 'text/plain; charset=utf-8';
    const stat = fs.statSync(candidate);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(candidate).pipe(res);
  });

  // ==========================
  // VITE DEV / PROD STATIC SERVING
  // ==========================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PortfolioPro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PortfolioPro server:', err);
  process.exit(1);
});
