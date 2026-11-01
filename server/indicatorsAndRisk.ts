import type { OhlcvBar, StockSeed } from './nseSeedData.ts';
import { SECTOR_BENCHMARKS } from './nseSeedData.ts';

export interface TimeValuePoint {
  time: number;
  value: number;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface TechnicalAnalysisPayload {
  symbol: string;
  timeframe: string;
  candles: OhlcvBar[];
  sma20: TimeValuePoint[];
  sma50: TimeValuePoint[];
  ema12: TimeValuePoint[];
  ema26: TimeValuePoint[];
  bollinger: BollingerPoint[];
  rsi14: TimeValuePoint[];
  macd: MacdPoint[];
  summary: {
    signal: 'Bullish' | 'Neutral' | 'Bearish';
    rsiValue: number;
    macdHistogram: number;
    priceVsSma20Pct: number;
    supportLevel: number;
    resistanceLevel: number;
    commentary: string;
  };
}

export function computeSMA(candles: OhlcvBar[], period: number): TimeValuePoint[] {
  const out: TimeValuePoint[] = [];
  if (candles.length < period) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: Number((sum / period).toFixed(2)) });
    }
  }
  return out;
}

export function computeEMA(candles: OhlcvBar[], period: number): TimeValuePoint[] {
  const out: TimeValuePoint[] = [];
  if (candles.length === 0) return out;
  const k = 2 / (period + 1);
  let ema = candles[0].close;
  for (let i = 0; i < candles.length; i++) {
    ema = i === 0 ? candles[0].close : candles[i].close * k + ema * (1 - k);
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: Number(ema.toFixed(2)) });
    }
  }
  return out;
}

export function computeBollingerBands(candles: OhlcvBar[], period = 20, stdMult = 2): BollingerPoint[] {
  const out: BollingerPoint[] = [];
  if (candles.length < period) return out;
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    const mean = sum / period;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = candles[j].close - mean;
      sqSum += d * d;
    }
    const std = Math.sqrt(sqSum / period);
    out.push({
      time: candles[i].time,
      middle: Number(mean.toFixed(2)),
      upper: Number((mean + stdMult * std).toFixed(2)),
      lower: Number(Math.max(0.5, mean - stdMult * std).toFixed(2)),
    });
  }
  return out;
}

export function computeRSI(candles: OhlcvBar[], period = 14): TimeValuePoint[] {
  const out: TimeValuePoint[] = [];
  if (candles.length <= period) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  out.push({
    time: candles[period].time,
    value: Number((avgLoss === 0 ? 100 : 100 - 100 / (1 + firstRs)).toFixed(2)),
  });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    out.push({ time: candles[i].time, value: Number(rsi.toFixed(2)) });
  }
  return out;
}

export function computeMACD(candles: OhlcvBar[], fast = 12, slow = 26, signalPeriod = 9): MacdPoint[] {
  const out: MacdPoint[] = [];
  if (candles.length < slow) return out;

  const kFast = 2 / (fast + 1);
  const kSlow = 2 / (slow + 1);
  const kSig = 2 / (signalPeriod + 1);

  let emaFast = candles[0].close;
  let emaSlow = candles[0].close;
  const macdRaw: { time: number; macd: number }[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i].close;
    emaFast = i === 0 ? c : c * kFast + emaFast * (1 - kFast);
    emaSlow = i === 0 ? c : c * kSlow + emaSlow * (1 - kSlow);
    if (i >= slow - 1) {
      macdRaw.push({ time: candles[i].time, macd: emaFast - emaSlow });
    }
  }

  if (macdRaw.length === 0) return out;
  let sig = macdRaw[0].macd;
  for (let i = 0; i < macdRaw.length; i++) {
    sig = i === 0 ? macdRaw[0].macd : macdRaw[i].macd * kSig + sig * (1 - kSig);
    if (i >= signalPeriod - 1) {
      const m = Number(macdRaw[i].macd.toFixed(2));
      const s = Number(sig.toFixed(2));
      out.push({
        time: macdRaw[i].time,
        macd: m,
        signal: s,
        histogram: Number((m - s).toFixed(2)),
      });
    }
  }
  return out;
}

export function buildTechnicalAnalysis(
  symbol: string,
  timeframe: string,
  candles: OhlcvBar[]
): TechnicalAnalysisPayload {
  const sma20 = computeSMA(candles, 20);
  const sma50 = computeSMA(candles, 50);
  const ema12 = computeEMA(candles, 12);
  const ema26 = computeEMA(candles, 26);
  const bollinger = computeBollingerBands(candles, 20, 2);
  const rsi14 = computeRSI(candles, 14);
  const macd = computeMACD(candles, 12, 26, 9);

  const lastClose = candles[candles.length - 1]?.close ?? 0;
  const lastSma20 = sma20[sma20.length - 1]?.value ?? lastClose;
  const lastSma50 = sma50[sma50.length - 1]?.value ?? lastClose;
  const lastRsi = rsi14[rsi14.length - 1]?.value ?? 50;
  const lastMacd = macd[macd.length - 1] ?? { macd: 0, signal: 0, histogram: 0 };

  const recentWindow = candles.slice(-30);
  const supportLevel = Number(Math.min(...recentWindow.map((c) => c.low)).toFixed(2));
  const resistanceLevel = Number(Math.max(...recentWindow.map((c) => c.high)).toFixed(2));

  let bullPoints = 0;
  if (lastClose > lastSma20) bullPoints += 1;
  if (lastSma20 >= lastSma50) bullPoints += 1;
  if (lastMacd.histogram > 0) bullPoints += 1;
  if (lastRsi >= 45 && lastRsi <= 68) bullPoints += 1;
  if (lastRsi > 74) bullPoints -= 1;
  if (lastRsi < 30) bullPoints += 1; // Oversold mean-reversion bias

  const signal: 'Bullish' | 'Neutral' | 'Bearish' =
    bullPoints >= 3 ? 'Bullish' : bullPoints <= 1 ? 'Bearish' : 'Neutral';

  const priceVsSma20Pct = lastSma20 > 0 ? Number((((lastClose - lastSma20) / lastSma20) * 100).toFixed(2)) : 0;

  const rsiDesc =
    lastRsi > 70
      ? `RSI(14) at ${lastRsi} indicates overbought momentum near short-term resistance.`
      : lastRsi < 32
        ? `RSI(14) at ${lastRsi} signals oversold territory with potential rebound interest.`
        : `RSI(14) at ${lastRsi} sits in a balanced momentum zone.`;

  const macdDesc =
    lastMacd.histogram >= 0
      ? `MACD histogram is positive (+${lastMacd.histogram}), confirming upward trend strength.`
      : `MACD histogram is negative (${lastMacd.histogram}), reflecting near-term consolidation.`;

  return {
    symbol,
    timeframe,
    candles,
    sma20,
    sma50,
    ema12,
    ema26,
    bollinger,
    rsi14,
    macd,
    summary: {
      signal,
      rsiValue: lastRsi,
      macdHistogram: lastMacd.histogram,
      priceVsSma20Pct,
      supportLevel,
      resistanceLevel,
      commentary: `${symbol} trades ${priceVsSma20Pct >= 0 ? `${priceVsSma20Pct}% above` : `${Math.abs(priceVsSma20Pct)}% below`} its 20-period SMA. ${rsiDesc} ${macdDesc}`,
    },
  };
}

export interface ChargeBreakdown {
  turnover: number;
  brokerage: number;
  stt: number;
  exchangeTxnCharge: number;
  sebiTurnoverFee: number;
  stampDuty: number;
  gst: number;
  totalCharges: number;
  netAmount: number;
}

export function calculateCharges(side: 'BUY' | 'SELL', price: number, quantity: number): ChargeBreakdown {
  const turnover = Number((price * quantity).toFixed(2));
  const brokerage = Number(Math.min(20, turnover * 0.0003).toFixed(2));
  const stt = Number((turnover * 0.001).toFixed(2)); // 0.1% equity delivery STT
  const exchangeTxnCharge = Number((turnover * 0.0000325).toFixed(2));
  const sebiTurnoverFee = Number((turnover * 0.000001).toFixed(2));
  const stampDuty = side === 'BUY' ? Number((turnover * 0.00015).toFixed(2)) : 0;
  const gst = Number(((brokerage + exchangeTxnCharge + sebiTurnoverFee) * 0.18).toFixed(2));
  const totalCharges = Number(
    (brokerage + stt + exchangeTxnCharge + sebiTurnoverFee + stampDuty + gst).toFixed(2)
  );
  const netAmount =
    side === 'BUY'
      ? Number((turnover + totalCharges).toFixed(2))
      : Number(Math.max(0, turnover - totalCharges).toFixed(2));

  return {
    turnover,
    brokerage,
    stt,
    exchangeTxnCharge,
    sebiTurnoverFee,
    stampDuty,
    gst,
    totalCharges,
    netAmount,
  };
}

export interface FundamentalAnalysisPayload {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  currentPrice: number;
  marketCapCr: number;
  high52w: number;
  low52w: number;
  range52wPositionPct: number;
  metrics: {
    peRatio: number;
    pbRatio: number;
    eps: number;
    roe: number;
    debtToEquity: number;
    dividendYield: number;
    revenueGrowthYoY: number;
    netProfitMargin: number;
    beta: number;
  };
  sectorBenchmark: {
    avgPe: number;
    avgPb: number;
    avgRoe: number;
    avgDebtToEquity: number;
    avgDivYield: number;
  };
  rating: 'Strong' | 'Neutral' | 'Weak';
  fundamentalScore: number;
  pillars: {
    valuationScore: number;
    profitabilityScore: number;
    balanceSheetScore: number;
    growthScore: number;
  };
  analystSummary: string;
  strengths: string[];
  watchouts: string[];
  catalysts: string[];
  about: string;
}

export function buildFundamentalAnalysis(
  stock: StockSeed,
  currentPrice: number
): FundamentalAnalysisPayload {
  const bench = SECTOR_BENCHMARKS[stock.sector] ?? {
    avgPe: 25,
    avgPb: 4.0,
    avgRoe: 16.0,
    avgDebtToEquity: 0.6,
    avgDivYield: 1.4,
  };

  // Dynamic P/E and P/B adjusted by live price relative to basePrice
  const priceScale = currentPrice / Math.max(1, stock.basePrice);
  const livePe = Number((stock.peRatio * priceScale).toFixed(2));
  const livePb = Number((stock.pbRatio * priceScale).toFixed(2));
  const liveMcap = Math.round(stock.marketCapCr * priceScale);
  const high52w = Math.max(stock.high52w, currentPrice);
  const low52w = Math.min(stock.low52w, currentPrice);
  const range52wPositionPct =
    high52w > low52w ? Number((((currentPrice - low52w) / (high52w - low52w)) * 100).toFixed(1)) : 50;

  // Pillar 1: Valuation (0-25)
  const peRatioVsSector = livePe / Math.max(1, bench.avgPe);
  const valuationScore = Math.round(
    Math.max(4, Math.min(25, 25 - (peRatioVsSector - 0.75) * 12))
  );

  // Pillar 2: Profitability (0-30)
  const roeScore = Math.min(18, (stock.roe / Math.max(10, bench.avgRoe)) * 13);
  const marginScore = Math.min(12, (stock.netProfitMargin / 18) * 10);
  const profitabilityScore = Math.round(Math.max(6, Math.min(30, roeScore + marginScore)));

  // Pillar 3: Balance Sheet (0-25)
  const isBankOrNbfc = stock.sector === 'Banking & Financials';
  const deRatioNorm = isBankOrNbfc ? stock.debtToEquity / 2.2 : stock.debtToEquity;
  const balanceSheetScore = Math.round(
    Math.max(5, Math.min(25, 24 - deRatioNorm * 11 + Math.min(4, stock.dividendYield * 1.4)))
  );

  // Pillar 4: Growth (0-20)
  const growthScore = Math.round(
    Math.max(4, Math.min(20, (stock.revenueGrowthYoY / 16) * 16 + 3))
  );

  const fundamentalScore = Math.min(
    98,
    Math.max(22, valuationScore + profitabilityScore + balanceSheetScore + growthScore)
  );

  const rating: 'Strong' | 'Neutral' | 'Weak' =
    fundamentalScore >= 70 ? 'Strong' : fundamentalScore >= 52 ? 'Neutral' : 'Weak';

  const strengths: string[] = [];
  const watchouts: string[] = [];

  if (stock.roe >= bench.avgRoe) {
    strengths.push(`Superior capital efficiency with ROE of ${stock.roe}% vs sector average ${bench.avgRoe}%.`);
  } else {
    watchouts.push(`ROE of ${stock.roe}% trails the ${stock.sector} peer average of ${bench.avgRoe}%.`);
  }

  if (livePe <= bench.avgPe * 1.05) {
    strengths.push(`Reasonably valued at ${livePe}x P/E compared to sector multiple of ${bench.avgPe}x.`);
  } else {
    watchouts.push(`Trades at a valuation premium (${livePe}x P/E vs ${bench.avgPe}x sector average).`);
  }

  if (!isBankOrNbfc && stock.debtToEquity <= 0.35) {
    strengths.push(`Conservative leverage (${stock.debtToEquity}x D/E) provides strong downside resilience.`);
  } else if (!isBankOrNbfc && stock.debtToEquity > 1.0) {
    watchouts.push(`Elevated debt-to-equity (${stock.debtToEquity}x) increases sensitivity to interest rates.`);
  }

  if (stock.revenueGrowthYoY >= 12) {
    strengths.push(`Healthy top-line expansion of ${stock.revenueGrowthYoY}% YoY supports earnings compounding.`);
  }

  if (stock.dividendYield >= 1.8) {
    strengths.push(`Attractive ${stock.dividendYield}% dividend yield cushions total shareholder return.`);
  }

  if (watchouts.length === 0) {
    watchouts.push(`Monitor quarterly margin execution and broader ${stock.sector} macro demand trends.`);
  }

  const analystSummary =
    rating === 'Strong'
      ? `${stock.name} screens as Fundamentally Strong (${fundamentalScore}/100), backed by ${stock.roe}% ROE, ${stock.netProfitMargin}% net margins, and disciplined balance-sheet metrics relative to ${stock.sector} peers.`
      : rating === 'Neutral'
        ? `${stock.name} carries a Neutral fundamental profile (${fundamentalScore}/100): steady operational scale (${stock.revenueGrowthYoY}% YoY growth), though current valuation of ${livePe}x P/E prices in near-term execution.`
        : `${stock.name} screens Weak on composite ratios (${fundamentalScore}/100) primarily due to stretched valuation (${livePe}x P/E) or balance-sheet leverage (${stock.debtToEquity}x D/E); strict stop-loss discipline is advised.`;

  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    industry: stock.industry,
    currentPrice,
    marketCapCr: liveMcap,
    high52w,
    low52w,
    range52wPositionPct,
    metrics: {
      peRatio: livePe,
      pbRatio: livePb,
      eps: stock.eps,
      roe: stock.roe,
      debtToEquity: stock.debtToEquity,
      dividendYield: stock.dividendYield,
      revenueGrowthYoY: stock.revenueGrowthYoY,
      netProfitMargin: stock.netProfitMargin,
      beta: stock.beta,
    },
    sectorBenchmark: bench,
    rating,
    fundamentalScore,
    pillars: {
      valuationScore,
      profitabilityScore,
      balanceSheetScore,
      growthScore,
    },
    analystSummary,
    strengths,
    watchouts,
    catalysts: stock.catalysts,
    about: stock.about,
  };
}

/**
 * Newton-Raphson XIRR calculation on cashflows [{ amount, dateMs }] where buys are negative and terminal value is positive.
 */
export function computeXIRR(cashflows: { amount: number; timestampMs: number }[]): number {
  if (cashflows.length < 2) return 0;
  const sorted = [...cashflows].sort((a, b) => a.timestampMs - b.timestampMs);
  const t0 = sorted[0].timestampMs;
  const spanYears = (sorted[sorted.length - 1].timestampMs - t0) / (365.25 * 86400 * 1000);
  if (spanYears < 1 / 365) {
    const invested = sorted.filter((c) => c.amount < 0).reduce((s, c) => s + Math.abs(c.amount), 0);
    const positive = sorted.filter((c) => c.amount > 0).reduce((s, c) => s + c.amount, 0);
    if (invested <= 0) return 0;
    return Number((((positive - invested) / invested) * 100).toFixed(2));
  }

  let rate = 0.12;
  for (let iter = 0; iter < 50; iter++) {
    let f = 0;
    let df = 0;
    for (const cf of sorted) {
      const yrs = (cf.timestampMs - t0) / (365.25 * 86400 * 1000);
      const base = Math.max(0.05, 1 + rate);
      f += cf.amount / Math.pow(base, yrs);
      if (yrs > 0) {
        df -= (yrs * cf.amount) / Math.pow(base, yrs + 1);
      }
    }
    if (Math.abs(f) < 1e-4 || Math.abs(df) < 1e-9) break;
    const next = rate - f / df;
    rate = Math.max(-0.85, Math.min(3.5, next));
  }
  return Number((rate * 100).toFixed(2));
}
