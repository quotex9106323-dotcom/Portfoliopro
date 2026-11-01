import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ApiEnvelope,
  CandleDto,
  ChargeEstimateDto,
  FundamentalAnalysisDto,
  IndexQuote,
  NotificationDto,
  OrderDto,
  PagedResponse,
  PlaceOrderPayload,
  PortfolioSummaryDto,
  PriceAlertDto,
  RiskSummaryDto,
  StockQuote,
  TechnicalAnalysisDto,
  WalletSummaryDto,
  WatchlistDto,
} from '../models/portfolio.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getStocks(sector?: string, q?: string): Observable<{
    indices: IndexQuote[];
    stocks: StockQuote[];
    sectors: string[];
  }> {
    let params = new HttpParams();
    if (sector && sector !== 'ALL') params = params.set('sector', sector);
    if (q) params = params.set('q', q);
    return this.http
      .get<ApiEnvelope<{ indices: IndexQuote[]; stocks: StockQuote[]; sectors: string[] }>>(
        `${this.base}/market/stocks`,
        { params }
      )
      .pipe(map((r) => r.data));
  }

  getStock(symbol: string): Observable<StockQuote> {
    return this.http
      .get<ApiEnvelope<StockQuote>>(`${this.base}/market/stocks/${symbol}`)
      .pipe(map((r) => r.data));
  }

  getCandles(symbol: string, timeframe = '1Y'): Observable<CandleDto[]> {
    return this.http
      .get<ApiEnvelope<{ candles: CandleDto[] }>>(
        `${this.base}/market/stocks/${symbol}/candles`,
        { params: { timeframe } }
      )
      .pipe(map((r) => r.data.candles));
  }

  getTechnicals(symbol: string, timeframe = '1Y'): Observable<TechnicalAnalysisDto> {
    return this.http
      .get<ApiEnvelope<TechnicalAnalysisDto>>(
        `${this.base}/analysis/${symbol}/technicals`,
        { params: { timeframe } }
      )
      .pipe(map((r) => r.data));
  }

  getFundamentals(symbol: string): Observable<FundamentalAnalysisDto> {
    return this.http
      .get<ApiEnvelope<FundamentalAnalysisDto>>(`${this.base}/analysis/${symbol}/fundamentals`)
      .pipe(map((r) => r.data));
  }

  estimateOrder(payload: PlaceOrderPayload): Observable<ChargeEstimateDto> {
    return this.http
      .post<ApiEnvelope<ChargeEstimateDto>>(`${this.base}/orders/estimate`, payload)
      .pipe(map((r) => r.data));
  }

  placeOrder(payload: PlaceOrderPayload): Observable<OrderDto> {
    return this.http
      .post<ApiEnvelope<OrderDto>>(`${this.base}/orders`, payload)
      .pipe(map((r) => r.data));
  }

  listOrders(status = 'ALL', page = 0, size = 30): Observable<PagedResponse<OrderDto>> {
    return this.http
      .get<ApiEnvelope<PagedResponse<OrderDto>>>(`${this.base}/orders`, {
        params: { status, page, size },
      })
      .pipe(map((r) => r.data));
  }

  cancelOrder(orderId: number): Observable<OrderDto> {
    return this.http
      .post<ApiEnvelope<OrderDto>>(`${this.base}/orders/${orderId}/cancel`, {})
      .pipe(map((r) => r.data));
  }

  getPortfolioSummary(): Observable<PortfolioSummaryDto> {
    return this.http
      .get<ApiEnvelope<PortfolioSummaryDto>>(`${this.base}/portfolio/summary`)
      .pipe(map((r) => r.data));
  }

  updatePositionRisk(
    symbol: string,
    stopLossPrice: number | null,
    targetPrice: number | null
  ): Observable<unknown> {
    return this.http
      .put<ApiEnvelope<unknown>>(`${this.base}/portfolio/holdings/${symbol}/risk`, {
        stopLossPrice,
        targetPrice,
      })
      .pipe(map((r) => r.data));
  }

  getRiskSummary(): Observable<RiskSummaryDto> {
    return this.http
      .get<ApiEnvelope<RiskSummaryDto>>(`${this.base}/risk/summary`)
      .pipe(map((r) => r.data));
  }

  getWatchlists(): Observable<{ watchlists: WatchlistDto[]; alerts: PriceAlertDto[] }> {
    return this.http
      .get<ApiEnvelope<{ watchlists: WatchlistDto[]; alerts: PriceAlertDto[] }>>(
        `${this.base}/watchlists`
      )
      .pipe(map((r) => r.data));
  }

  createWatchlist(name: string): Observable<WatchlistDto> {
    return this.http
      .post<ApiEnvelope<WatchlistDto>>(`${this.base}/watchlists`, { name })
      .pipe(map((r) => r.data));
  }

  deleteWatchlist(id: number): Observable<void> {
    return this.http
      .delete<ApiEnvelope<unknown>>(`${this.base}/watchlists/${id}`)
      .pipe(map(() => undefined));
  }

  addWatchlistSymbol(id: number, symbol: string): Observable<WatchlistDto> {
    return this.http
      .post<ApiEnvelope<WatchlistDto>>(`${this.base}/watchlists/${id}/items`, { symbol })
      .pipe(map((r) => r.data));
  }

  removeWatchlistSymbol(id: number, symbol: string): Observable<WatchlistDto> {
    return this.http
      .delete<ApiEnvelope<WatchlistDto>>(`${this.base}/watchlists/${id}/items/${symbol}`)
      .pipe(map((r) => r.data));
  }

  reorderWatchlist(id: number, symbols: string[]): Observable<WatchlistDto> {
    return this.http
      .put<ApiEnvelope<WatchlistDto>>(`${this.base}/watchlists/${id}/reorder`, { symbols })
      .pipe(map((r) => r.data));
  }

  createAlert(
    symbol: string,
    conditionType: 'ABOVE' | 'BELOW',
    targetPrice: number,
    note?: string
  ): Observable<PriceAlertDto> {
    return this.http
      .post<ApiEnvelope<PriceAlertDto>>(`${this.base}/alerts`, {
        symbol,
        conditionType,
        targetPrice,
        note,
      })
      .pipe(map((r) => r.data));
  }

  deleteAlert(id: number): Observable<void> {
    return this.http
      .delete<ApiEnvelope<unknown>>(`${this.base}/alerts/${id}`)
      .pipe(map(() => undefined));
  }

  getWallet(page = 0, size = 25): Observable<WalletSummaryDto> {
    return this.http
      .get<ApiEnvelope<WalletSummaryDto>>(`${this.base}/wallet`, { params: { page, size } })
      .pipe(map((r) => r.data));
  }

  depositFunds(amount: number, note?: string): Observable<unknown> {
    return this.http
      .post<ApiEnvelope<unknown>>(`${this.base}/wallet/deposit`, { amount, note })
      .pipe(map((r) => r.data));
  }

  withdrawFunds(amount: number, note?: string): Observable<unknown> {
    return this.http
      .post<ApiEnvelope<unknown>>(`${this.base}/wallet/withdraw`, { amount, note })
      .pipe(map((r) => r.data));
  }

  getNotifications(): Observable<{ notifications: NotificationDto[]; unreadCount: number }> {
    return this.http
      .get<ApiEnvelope<{ notifications: NotificationDto[]; unreadCount: number }>>(
        `${this.base}/notifications`
      )
      .pipe(map((r) => r.data));
  }

  markNotificationsRead(): Observable<void> {
    return this.http
      .post<ApiEnvelope<unknown>>(`${this.base}/notifications/read-all`, {})
      .pipe(map(() => undefined));
  }

  exportCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
    const escapeCell = (val: string | number) => {
      const str = String(val ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
