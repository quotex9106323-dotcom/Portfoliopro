export type PageRoute =
  | 'dashboard'
  | 'markets'
  | 'stock'
  | 'portfolio'
  | 'orders'
  | 'watchlist'
  | 'analysis'
  | 'risk'
  | 'wallet';

export type TimeframeKey = '1D' | '1W' | '1M' | '1Y' | '5Y';
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  theme: 'light' | 'dark';
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePct: number;
}

export interface StockQuote {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  ltp: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  change: number;
  changePct: number;
  volume: number;
  high52w: number;
  low52w: number;
  marketCapCr: number;
  peRatio: number;
  pbRatio: number;
  roe: number;
  dividendYield: number;
  beta: number;
  sparkline: number[];
  lastDirection: 'UP' | 'DOWN' | 'FLAT';
  about?: string;
  catalysts?: string[];
  eps?: number;
  debtToEquity?: number;
  revenueGrowthYoY?: number;
  netProfitMargin?: number;
}

export interface OhlcvCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalAnalysisData {
  symbol: string;
  timeframe: TimeframeKey;
  candles: OhlcvCandle[];
  sma20: { time: number; value: number }[];
  sma50: { time: number; value: number }[];
  ema12: { time: number; value: number }[];
  ema26: { time: number; value: number }[];
  bollinger: { time: number; upper: number; middle: number; lower: number }[];
  rsi14: { time: number; value: number }[];
  macd: { time: number; macd: number; signal: number; histogram: number }[];
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

export interface FundamentalAnalysisData {
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

export interface ChargeEstimate {
  referencePrice: number;
  quantity: number;
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

export interface OrderItem {
  id: string;
  userId: string;
  symbol: string;
  stockName?: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  requestedPrice: number;
  limitPrice: number | null;
  executedPrice: number | null;
  currentLtp?: number;
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

export interface HoldingItem {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  quantity: number;
  avgBuyPrice: number;
  investedAmount: number;
  ltp: number;
  prevClose: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPct: number;
  dayPnl: number;
  dayPnlPct: number;
  stopLossPrice: number | null;
  targetPrice: number | null;
  sparkline: number[];
  beta: number;
  annualVolatility: number;
}

export interface PortfolioSummary {
  totalAccountEquity: number;
  walletBalance: number;
  blockedMargin: number;
  totalInvested: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPct: number;
  dayPnl: number;
  dayPnlPct: number;
  xirrPct: number;
  holdingsCount: number;
  holdings: HoldingItem[];
  sectorAllocation: { sector: string; value: number; weightPct: number }[];
}

export interface RiskSummary {
  riskScore: number;
  riskLabel: 'Low' | 'Conservative' | 'Moderate' | 'Elevated' | 'Aggressive';
  weightedBeta: number;
  annualizedVolatilityPct: number;
  dailyVar95: number;
  dailyVar95Pct: number;
  estimatedMaxDrawdownPct: number;
  hhiConcentration: number;
  maxPositionWeightPct: number;
  topSectorWeightPct: number;
  stopLossCoveragePct: number;
  alerts: { severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'; title: string; detail: string }[];
  positions: {
    symbol: string;
    name: string;
    sector: string;
    quantity: number;
    avgBuyPrice: number;
    ltp: number;
    currentValue: number;
    weightPct: number;
    beta: number;
    stopLossPrice: number | null;
    targetPrice: number | null;
    downsideToSlPct: number | null;
    upsideToTpPct: number | null;
    oversizedWarning: boolean;
  }[];
}

export interface WatchlistGroup {
  id: string;
  name: string;
  symbols: string[];
  items: StockQuote[];
}

export interface PriceAlertItem {
  id: string;
  symbol: string;
  condition: 'ABOVE' | 'BELOW';
  targetPrice: number;
  currentLtp: number;
  triggered: boolean;
  createdAt: string;
  triggeredAt?: string;
}

export interface WalletSummary {
  wallet: {
    userId: string;
    balance: number;
    blockedMargin: number;
    totalDeposited: number;
    totalWithdrawn: number;
  };
  transactions: {
    id: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE_BUY' | 'TRADE_SELL' | 'ORDER_REFUND';
    amount: number;
    balanceAfter: number;
    description: string;
    referenceId?: string;
    createdAt: string;
  }[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: 'ORDER' | 'RISK' | 'ALERT' | 'WALLET';
  read: boolean;
  createdAt: string;
}
