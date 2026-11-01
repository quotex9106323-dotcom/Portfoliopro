import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FundamentalAnalysisDto,
  TechnicalAnalysisDto,
} from '../../core/models/portfolio.models';
import { ApiService } from '../../core/services/api.service';
import { MarketStompService } from '../../core/services/market-stomp.service';
import { CandlestickChartComponent } from '../../shared/candlestick-chart/candlestick-chart.component';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [DecimalPipe, FormsModule, CandlestickChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div class="pp-card" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <strong style="font-size: 14px;">Technical &amp; Fundamental Workbench</strong>
          <select class="pp-input mono" style="width: 240px;" [ngModel]="selectedSymbol()" (ngModelChange)="selectedSymbol.set($event)">
            @for (st of market.stocksList(); track st.symbol) {
              <option [value]="st.symbol">{{ st.symbol }} — {{ st.name }}</option>
            }
          </select>
        </div>

        <button
          type="button"
          class="pp-btn pp-btn-buy"
          (click)="market.openOrderDrawer(selectedSymbol(), 'BUY')"
        >
          Trade {{ selectedSymbol() }}
        </button>
      </div>

      <div style="display: grid; grid-template-columns: 1.55fr 1fr; gap: 16px;">
        <div class="pp-card">
          <app-candlestick-chart
            [analysis]="technicals()"
            [timeframe]="timeframe()"
            (timeframeChange)="timeframe.set($event)"
          />
          @if (technicals(); as tech) {
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-color); font-size: 12.5px;">
              <strong>Signal: {{ tech.summary.signal }}</strong> — {{ tech.summary.commentary }}
            </div>
          }
        </div>

        @if (fundamentals(); as f) {
          <div class="pp-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 15px;">Fundamental Scorecard</strong>
              <span
                class="mono"
                style="font-weight: 700;"
                [class.gain]="f.rating === 'Strong'"
                [class.loss]="f.rating === 'Weak'"
              >
                {{ f.rating }} ({{ f.fundamentalScore }}/100)
              </span>
            </div>
            <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5;">
              {{ f.analystSummary }}
            </p>

            <table class="pp-table" style="margin-top: 12px;">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>{{ f.symbol }}</th>
                  <th>{{ f.sector }} Avg</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>P/E Ratio</td><td class="mono">{{ f.peRatio | number: '1.2-2' }}x</td><td class="mono">{{ f.sectorBenchmark.avgPe | number: '1.1-1' }}x</td></tr>
                <tr><td>P/B Ratio</td><td class="mono">{{ f.pbRatio | number: '1.2-2' }}x</td><td class="mono">{{ f.sectorBenchmark.avgPb | number: '1.1-1' }}x</td></tr>
                <tr><td>ROE (%)</td><td class="mono">{{ f.roe | number: '1.2-2' }}%</td><td class="mono">{{ f.sectorBenchmark.avgRoe | number: '1.1-1' }}%</td></tr>
                <tr><td>Debt / Equity</td><td class="mono">{{ f.debtToEquity | number: '1.2-2' }}</td><td class="mono">{{ f.sectorBenchmark.avgDebtToEquity | number: '1.2-2' }}</td></tr>
                <tr><td>Dividend Yield</td><td class="mono">{{ f.dividendYield | number: '1.2-2' }}%</td><td class="mono">{{ f.sectorBenchmark.avgDivYield | number: '1.2-2' }}%</td></tr>
                <tr><td>EPS (TTM)</td><td class="mono">₹{{ f.eps | number: '1.2-2' }}</td><td class="mono">—</td></tr>
                <tr><td>52W High / Low</td><td class="mono" colspan="2">₹{{ f.high52w | number: '1.0-0' }} / ₹{{ f.low52w | number: '1.0-0' }}</td></tr>
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
export class AnalysisComponent {
  readonly market = inject(MarketStompService);
  private readonly api = inject(ApiService);

  readonly selectedSymbol = signal<string>('RELIANCE');
  readonly timeframe = signal<string>('1Y');
  readonly technicals = signal<TechnicalAnalysisDto | null>(null);
  readonly fundamentals = signal<FundamentalAnalysisDto | null>(null);

  constructor() {
    effect(
      () => {
        const sym = this.selectedSymbol();
        const tf = this.timeframe();
        this.api.getTechnicals(sym, tf).subscribe({ next: (t) => this.technicals.set(t) });
        this.api.getFundamentals(sym).subscribe({ next: (f) => this.fundamentals.set(f) });
      },
      { allowSignalWrites: true }
    );
  }
}
