export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface UserDto {
  id: number;
  fullName: string;
  email: string;
  theme: 'light' | 'dark';
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

export interface IndexQuote {
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
  eps: number;
  roe: number;
  debtToEquity: number;
  dividendYield: number;
  beta: number;
  about: string;
  sparkline: number[];
}

export interface TickEvent {
  symbol: string;
  ltp: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
}

export interface CandleDto {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalAnalysisDto {
  symbol: string;
  timeframe: string;
  candles: CandleDto[];
  sma20: { time: number; value: number }[];
  sma50: { time: number; value: number }[];
  ema12: { time: number; value: number }[];
  ema26: { time: number; value: number }[];
  bollinger: { time: number; upper: number; middle: number; lower: number }[];
  rsi14: { time: number; value: number }[];
  macd: { time: number; macd: number; signal: number; histogram: number }[];
  summary: {
    signal: string;
    rsiValue: number;
    macdHistogram: number;
    priceVsSma20Pct: number;
    supportLevel: number;
    resistanceLevel: number;
    commentary: string;
  };
}

export interface FundamentalAnalysisDto {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  currentPrice: number;
  marketCapCr: number;
  high52w: number;
  low52w: number;
  peRatio: number;
  pbRatio: number;
  eps: number;
  roe: number;
  debtToEquity: number;
  dividendYield: number;
  revenueGrowthYoY: number;
  netProfitMargin: number;
  beta: number;
  sectorBenchmark: {
    avgPe: number;
    avgPb: number;
    avgRoe: number;
    avgDebtToEquity: number;
    avgDivYield: number;
  };
  rating: 'Strong' | 'Neutral' | 'Weak';
  fundamentalScore: number;
  analystSummary: string;
  strengths: string[];
  watchouts: string[];
  about: string;
}

export interface ChargeEstimateDto {
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

export interface OrderDto {
  id: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  quantity: number;
  requestedPrice: number;
  limitPrice: number | null;
  executedPrice: number | null;
  currentLtp: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
  rejectionReason?: string;
  triggerSource?: string;
  stopLossPrice?: number | null;
  targetPrice?: number | null;
  charges: number;
  totalValue: number;
  createdAt: string;
  executedAt?: string;
}

export interface HoldingDto {
  id: number;
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
  beta: number;
  annualVolatility: number;
  sparkline: number[];
}

export interface PortfolioSummaryDto {
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
  holdings: HoldingDto[];
  sectorAllocation: { sector: string; value: number; weightPct: number }[];
}

export interface RiskSummaryDto {
  riskScore: number;
  riskLabel: string;
  weightedBeta: number;
  annualizedVolatilityPct: number;
  dailyVar95: number;
  dailyVar95Pct: number;
  estimatedMaxDrawdownPct: number;
  hhiConcentration: number;
  maxPositionWeightPct: number;
  topSectorWeightPct: number;
  stopLossCoveragePct: number;
  alerts: { severity: string; title: string; detail: string }[];
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
    oversizedWarning: boolean;
  }[];
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface PlaceOrderPayload {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  quantity: number;
  limitPrice?: number | null;
  stopLossPrice?: number | null;
  targetPrice?: number | null;
}

export interface WatchlistDto {
  id: number;
  name: string;
  symbols: string[];
}

export interface PriceAlertDto {
  id: number;
  symbol: string;
  conditionType: 'ABOVE' | 'BELOW';
  targetPrice: number;
  triggered: boolean;
  note?: string;
  createdAt: string;
  triggeredAt?: string;
}

export interface WalletTransactionDto {
  id: number;
  txType: 'DEPOSIT' | 'WITHDRAWAL' | 'BUY_DEBIT' | 'SELL_CREDIT' | 'MARGIN_BLOCK' | 'MARGIN_RELEASE';
  amount: number;
  balanceAfter: number;
  referenceNote: string;
  createdAt: string;
}

export interface WalletSummaryDto {
  balance: number;
  blockedMargin: number;
  totalDeposited: number;
  totalWithdrawn: number;
  ledger: PagedResponse<WalletTransactionDto>;
}

export interface NotificationDto {
  id: number;
  title: string;
  message: string;
  category: string;
  read: boolean;
  createdAt: string;
}

export interface OrderDrawerState {
  open: boolean;
  symbol: string;
  side: 'BUY' | 'SELL';
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  undoOrderId?: number;
}

