import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChargeEstimateDto,
  FundamentalAnalysisDto,
  PlaceOrderPayload,
  TechnicalAnalysisDto,
} from '../../core/models/portfolio.models';
import { ApiService } from '../../core/services/api.service';
import { MarketStompService } from '../../core/services/market-stomp.service';
import { CandlestickChartComponent } from '../../shared/candlestick-chart/candlestick-chart.component';

@Component({
  selector: 'app-stock-detail',
  standalone: true,
  imports: [DecimalPipe, FormsModule, CandlestickChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .sticky-quote {
        position: sticky;
        top: 58px;
        z-index: 15;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: 1fr 340px;
        gap: 16px;
        align-items: start;
      }
      .tabs {
        display: flex;
        gap: 8px;
        margin: 16px 0 12px;
      }
      .ratio-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
      }
      @media (max-width: 1024px) {
        .detail-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: `
    @if (stock(); as st) {
      <div
        class="pp-card sticky-quote"
        [class.flash-up]="market.tickFlashes()[st.symbol] === 'UP'"
        [class.flash-down]="market.tickFlashes()[st.symbol] === 'DOWN'"
      >
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 class="mono" style="margin: 0; font-size: 20px;">{{ st.symbol }}</h2>
            <span style="font-size: 13px; color: var(--text-secondary);">{{ st.name }}</span>
            <span style="font-size: 11px; color: var(--text-muted);">· {{ st.sector }}</span>
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;" class="mono">
            Day Range ₹{{ st.dayLow | number: '1.2-2' }} – ₹{{ st.dayHigh | number: '1.2-2' }} · 52W ₹{{ st.low52w | number: '1.0-0' }} – ₹{{ st.high52w | number: '1.0-0' }}
          </div>
        </div>

        <div style="text-align: right;">
          <div class="mono" style="font-size: 24px; font-weight: 700;">₹{{ st.ltp | number: '1.2-2' }}</div>
          <div class="mono" style="font-size: 13px;" [class.gain]="st.change >= 0" [class.loss]="st.change < 0">
            {{ st.change >= 0 ? '+' : '' }}{{ st.change | number: '1.2-2' }} ({{ st.change >= 0 ? '+' : '' }}{{ st.changePct | number: '1.2-2' }}%)
          </div>
        </div>
      </div>

      <div class="detail-grid">
        <div>
          <div class="pp-card">
            <app-candlestick-chart
              [analysis]="technicals()"
              [timeframe]="timeframe()"
              (timeframeChange)="onTimeframeChange($event)"
            />
          </div>

          <div class="tabs">
            @for (tab of ['OVERVIEW', 'TECHNICALS', 'FUNDAMENTALS', 'INSIGHTS']; track tab) {
              <button
                type="button"
                class="pp-btn"
                [class.pp-btn-buy]="activeTab() === tab"
                (click)="activeTab.set(tab)"
              >
                {{ tab }}
              </button>
            }
          </div>

          @if (activeTab() === 'OVERVIEW') {
            <div class="pp-card">
              <h3 style="margin: 0 0 8px; font-size: 14px;">Company Overview</h3>
              <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.55;">{{ st.about }}</p>
              <div class="ratio-grid" style="margin-top: 14px;">
                <div><div style="font-size: 11px; color: var(--text-muted);">Market Cap</div><div class="mono" style="font-weight: 600;">₹{{ st.marketCapCr | number: '1.0-0' }} Cr</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">P/E Ratio</div><div class="mono" style="font-weight: 600;">{{ st.peRatio | number: '1.2-2' }}x</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">ROE</div><div class="mono" style="font-weight: 600;">{{ st.roe | number: '1.2-2' }}%</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">Beta</div><div class="mono" style="font-weight: 600;">{{ st.beta | number: '1.2-2' }}</div></div>
              </div>
            </div>
          }

          @if (activeTab() === 'TECHNICALS' && technicals(); as tech) {
            <div class="pp-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="font-size: 14px;">Server-Computed Signal: {{ tech.summary.signal }}</strong>
                <span class="mono" style="font-size: 12px;">RSI(14): {{ tech.summary.rsiValue | number: '1.1-1' }}</span>
              </div>
              <p style="font-size: 13px; color: var(--text-secondary);">{{ tech.summary.commentary }}</p>
              <div class="ratio-grid" style="margin-top: 12px;">
                <div><div style="font-size: 11px; color: var(--text-muted);">Support (20-bar)</div><div class="mono">₹{{ tech.summary.supportLevel | number: '1.2-2' }}</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">Resistance (20-bar)</div><div class="mono">₹{{ tech.summary.resistanceLevel | number: '1.2-2' }}</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">MACD Histogram</div><div class="mono">{{ tech.summary.macdHistogram | number: '1.2-2' }}</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">Price vs SMA20</div><div class="mono">{{ tech.summary.priceVsSma20Pct | number: '1.2-2' }}%</div></div>
              </div>
            </div>
          }

          @if (activeTab() === 'FUNDAMENTALS' && fundamentals(); as fund) {
            <div class="pp-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="font-size: 14px;">Analyst Rating: {{ fund.rating }} ({{ fund.fundamentalScore }}/100)</strong>
                <span style="font-size: 12px; color: var(--text-muted);">vs {{ fund.sector }} Peers</span>
              </div>
              <p style="font-size: 13px; color: var(--text-secondary);">{{ fund.analystSummary }}</p>
              <div class="ratio-grid" style="margin-top: 12px;">
                <div><div style="font-size: 11px; color: var(--text-muted);">P/E (Sector {{ fund.sectorBenchmark.avgPe }}x)</div><div class="mono">{{ fund.peRatio }}x</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">P/B (Sector {{ fund.sectorBenchmark.avgPb }}x)</div><div class="mono">{{ fund.pbRatio }}x</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">ROE (Sector {{ fund.sectorBenchmark.avgRoe }}%)</div><div class="mono">{{ fund.roe }}%</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">Debt / Equity</div><div class="mono">{{ fund.debtToEquity }}</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">EPS (TTM)</div><div class="mono">₹{{ fund.eps }}</div></div>
                <div><div style="font-size: 11px; color: var(--text-muted);">Dividend Yield</div><div class="mono">{{ fund.dividendYield }}%</div></div>
              </div>
            </div>
          }

          @if (activeTab() === 'INSIGHTS' && fundamentals(); as fund) {
            <div class="pp-card">
              <strong style="font-size: 14px; display: block; margin-bottom: 8px;">Key Fundamental Catalysts &amp; Watchouts</strong>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12.5px;">
                <div>
                  <div class="gain" style="font-weight: 600; margin-bottom: 6px;">Strengths</div>
                  @for (s of fund.strengths; track s) {
                    <div style="margin-bottom: 6px;">• {{ s }}</div>
                  }
                </div>
                <div>
                  <div class="loss" style="font-weight: 600; margin-bottom: 6px;">Watchouts</div>
                  @for (w of fund.watchouts; track w) {
                    <div style="margin-bottom: 6px;">• {{ w }}</div>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Right-hand Kite/Groww Order Ticket -->
        <div class="pp-card" style="position: sticky; top: 142px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            <button type="button" class="pp-btn" [class.pp-btn-buy]="side() === 'BUY'" (click)="side.set('BUY'); refreshEstimate()">BUY</button>
            <button type="button" class="pp-btn" [class.pp-btn-sell]="side() === 'SELL'" (click)="side.set('SELL'); refreshEstimate()">SELL</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            <button type="button" class="pp-btn" [style.border-color]="orderType() === 'MARKET' ? 'var(--color-accent)' : ''" (click)="orderType.set('MARKET'); refreshEstimate()">Market</button>
            <button type="button" class="pp-btn" [style.border-color]="orderType() === 'LIMIT' ? 'var(--color-accent)' : ''" (click)="orderType.set('LIMIT'); limitPrice.set(st.ltp); refreshEstimate()">Limit</button>
          </div>

          <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 10px;">
            Quantity (NSE Shares)
            <input type="number" min="1" class="pp-input mono" style="margin-top: 4px;" [ngModel]="qty()" (ngModelChange)="qty.set($event); refreshEstimate()" />
          </label>

          @if (orderType() === 'LIMIT') {
            <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 10px;">
              Limit Price (₹)
              <input type="number" step="0.05" class="pp-input mono" style="margin-top: 4px;" [ngModel]="limitPrice()" (ngModelChange)="limitPrice.set($event); refreshEstimate()" />
            </label>
          }

          @if (estimate(); as est) {
            <div style="font-size: 12px; padding: 10px; border-radius: 8px; background: var(--bg-muted); margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between;"><span>Turnover</span><span class="mono">₹{{ est.turnover | number: '1.2-2' }}</span></div>
              <div style="display: flex; justify-content: space-between; color: var(--text-muted); margin-top: 4px;"><span>Charges + Taxes</span><span class="mono">₹{{ est.totalCharges | number: '1.2-2' }}</span></div>
              <div style="display: flex; justify-content: space-between; font-weight: 700; margin-top: 6px;"><span>Total Required</span><span class="mono">₹{{ est.netAmount | number: '1.2-2' }}</span></div>
            </div>
          }

          <button
            type="button"
            class="pp-btn"
            style="width: 100%; padding: 11px; font-size: 13px;"
            [class.pp-btn-buy]="side() === 'BUY'"
            [class.pp-btn-sell]="side() === 'SELL'"
            (click)="executeInlineOrder()"
          >
            {{ side() }} {{ st.symbol }}
          </button>
        </div>
      </div>
    }
  `,
})
export class StockDetailComponent {
  readonly symbol = input<string>('RELIANCE');

  readonly market = inject(MarketStompService);
  private readonly api = inject(ApiService);

  readonly timeframe = signal<string>('1Y');
  readonly activeTab = signal<string>('OVERVIEW');
  readonly technicals = signal<TechnicalAnalysisDto | null>(null);
  readonly fundamentals = signal<FundamentalAnalysisDto | null>(null);

  readonly side = signal<'BUY' | 'SELL'>('BUY');
  readonly orderType = signal<'MARKET' | 'LIMIT'>('MARKET');
  readonly qty = signal<number>(10);
  readonly limitPrice = signal<number>(0);
  readonly estimate = signal<ChargeEstimateDto | null>(null);

  readonly stock = computed(() => this.market.stocksMap()[this.symbol()?.toUpperCase() ?? 'RELIANCE']);

  constructor() {
    effect(
      () => {
        const sym = (this.symbol() || 'RELIANCE').toUpperCase();
        const tf = this.timeframe();
        this.api.getTechnicals(sym, tf).subscribe({
          next: (t) => this.technicals.set(t),
          error: () => {},
        });
        this.api.getFundamentals(sym).subscribe({
          next: (f) => this.fundamentals.set(f),
          error: () => {},
        });
        this.refreshEstimate();
      },
      { allowSignalWrites: true }
    );
  }

  onTimeframeChange(tf: string): void {
    this.timeframe.set(tf);
  }

  refreshEstimate(): void {
    const sym = (this.symbol() || 'RELIANCE').toUpperCase();
    const payload: PlaceOrderPayload = {
      symbol: sym,
      side: this.side(),
      orderType: this.orderType(),
      quantity: Math.max(1, Number(this.qty()) || 1),
      limitPrice: this.orderType() === 'LIMIT' ? Number(this.limitPrice()) : null,
    };
    this.api.estimateOrder(payload).subscribe({
      next: (est) => this.estimate.set(est),
      error: () => {},
    });
  }

  executeInlineOrder(): void {
    const sym = (this.symbol() || 'RELIANCE').toUpperCase();
    const payload: PlaceOrderPayload = {
      symbol: sym,
      side: this.side(),
      orderType: this.orderType(),
      quantity: Math.max(1, Number(this.qty()) || 1),
      limitPrice: this.orderType() === 'LIMIT' ? Number(this.limitPrice()) : null,
    };
    this.api.placeOrder(payload).subscribe({
      next: (ord) => {
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
        this.market.pushToast({
          type: 'error',
          title: 'Order Rejected',
          message: err?.error?.message ?? 'Insufficient margin or holdings.',
        });
      },
    });
  }
}
