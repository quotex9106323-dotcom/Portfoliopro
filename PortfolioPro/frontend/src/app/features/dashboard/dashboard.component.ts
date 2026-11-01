import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ArcElement, Chart, DoughnutController, Legend, Tooltip } from 'chart.js';
import { OrderDto, WatchlistDto } from '../../core/models/portfolio.models';
import { ApiService } from '../../core/services/api.service';
import { MarketStompService } from '../../core/services/market-stomp.service';
import { SparklineComponent } from '../../shared/sparkline/sparkline.component';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, RouterLink, SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 18px;
      }
      .main-grid {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 16px;
        margin-bottom: 18px;
      }
      .sub-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      @media (max-width: 960px) {
        .main-grid,
        .sub-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: `
    <div>
      @if (market.portfolio(); as pf) {
        <div class="kpi-grid">
          <div class="pp-card" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 12px; color: var(--text-muted);">Total Account Equity</div>
              <div class="mono" style="font-size: 24px; font-weight: 700; margin-top: 4px;">
                ₹{{ pf.totalAccountEquity | number: '1.2-2' }}
              </div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
                Cash ₹{{ pf.walletBalance | number: '1.0-0' }} · Holdings ₹{{ pf.currentValue | number: '1.0-0' }}
              </div>
            </div>
            <app-sparkline [data]="heroSparkline()" [positive]="pf.totalPnl >= 0" [width]="96" [height]="38" />
          </div>

          <div class="pp-card">
            <div style="font-size: 12px; color: var(--text-muted);">Day P&amp;L</div>
            <div
              class="mono"
              style="font-size: 22px; font-weight: 700; margin-top: 4px;"
              [class.gain]="pf.dayPnl >= 0"
              [class.loss]="pf.dayPnl < 0"
            >
              {{ pf.dayPnl >= 0 ? '+' : '' }}₹{{ pf.dayPnl | number: '1.2-2' }}
            </div>
            <div class="mono" style="font-size: 12px; margin-top: 4px;" [class.gain]="pf.dayPnl >= 0" [class.loss]="pf.dayPnl < 0">
              {{ pf.dayPnl >= 0 ? '+' : '' }}{{ pf.dayPnlPct | number: '1.2-2' }}% intraday
            </div>
          </div>

          <div class="pp-card">
            <div style="font-size: 12px; color: var(--text-muted);">Total Unrealized P&amp;L</div>
            <div
              class="mono"
              style="font-size: 22px; font-weight: 700; margin-top: 4px;"
              [class.gain]="pf.totalPnl >= 0"
              [class.loss]="pf.totalPnl < 0"
            >
              {{ pf.totalPnl >= 0 ? '+' : '' }}₹{{ pf.totalPnl | number: '1.2-2' }}
            </div>
            <div class="mono" style="font-size: 12px; margin-top: 4px;" [class.gain]="pf.totalPnl >= 0" [class.loss]="pf.totalPnl < 0">
              {{ pf.totalPnl >= 0 ? '+' : '' }}{{ pf.totalPnlPct | number: '1.2-2' }}% · XIRR {{ pf.xirrPct | number: '1.2-2' }}%
            </div>
          </div>
        </div>
      }

      <div class="main-grid">
        <div class="pp-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="font-size: 14px;">Top Gainers &amp; Losers (NSE Live)</strong>
            <a routerLink="/markets" style="font-size: 12px; color: var(--color-accent); text-decoration: none;">
              View All 30 Stocks →
            </a>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div>
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px; font-weight: 600;">TOP GAINERS</div>
              @for (st of market.topGainers(); track st.symbol) {
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--border-color);">
                  <a [routerLink]="['/stocks', st.symbol]" class="mono" style="font-weight: 600; color: var(--text-primary); text-decoration: none;">
                    {{ st.symbol }}
                  </a>
                  <span class="mono gain">+{{ st.changePct | number: '1.2-2' }}%</span>
                </div>
              }
            </div>
            <div>
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px; font-weight: 600;">TOP LOSERS</div>
              @for (st of market.topLosers(); track st.symbol) {
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--border-color);">
                  <a [routerLink]="['/stocks', st.symbol]" class="mono" style="font-weight: 600; color: var(--text-primary); text-decoration: none;">
                    {{ st.symbol }}
                  </a>
                  <span class="mono loss">{{ st.changePct | number: '1.2-2' }}%</span>
                </div>
              }
            </div>
          </div>
        </div>

        <div class="pp-card">
          <strong style="font-size: 14px; display: block; margin-bottom: 10px;">Sector Allocation</strong>
          <div style="height: 210px; display: flex; align-items: center; justify-content: center;">
            <canvas #sectorCanvas></canvas>
          </div>
        </div>
      </div>

      <div class="sub-grid">
        <div class="pp-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="font-size: 14px;">Recent Orders</strong>
            <a routerLink="/orders" style="font-size: 12px; color: var(--color-accent); text-decoration: none;">Order Book →</a>
          </div>
          @if (recentOrders().length === 0) {
            <p style="font-size: 12.5px; color: var(--text-muted);">No orders placed yet.</p>
          } @else {
            <table class="pp-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Qty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (ord of recentOrders(); track ord.id) {
                  <tr>
                    <td class="mono" style="font-weight: 600;">{{ ord.symbol }}</td>
                    <td [class.gain]="ord.side === 'BUY'" [class.loss]="ord.side === 'SELL'">{{ ord.side }}</td>
                    <td class="mono">{{ ord.quantity }}</td>
                    <td class="mono">{{ ord.status }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="pp-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="font-size: 14px;">Watchlist Snapshot</strong>
            <a routerLink="/watchlist" style="font-size: 12px; color: var(--color-accent); text-decoration: none;">Manage →</a>
          </div>
          @for (sym of primaryWatchlistSymbols(); track sym) {
            @if (market.stocksMap()[sym]; as st) {
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                <div>
                  <a [routerLink]="['/stocks', st.symbol]" class="mono" style="font-weight: 600; color: var(--text-primary); text-decoration: none;">
                    {{ st.symbol }}
                  </a>
                  <span style="font-size: 11.5px; color: var(--text-muted); margin-left: 6px;">{{ st.sector }}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="mono" [class.gain]="st.change >= 0" [class.loss]="st.change < 0">
                    ₹{{ st.ltp | number: '1.2-2' }} ({{ st.change >= 0 ? '+' : '' }}{{ st.changePct | number: '1.2-2' }}%)
                  </span>
                  <button
                    type="button"
                    class="pp-btn pp-btn-buy"
                    style="padding: 4px 8px; font-size: 11px;"
                    (click)="market.openOrderDrawer(st.symbol, 'BUY')"
                  >
                    B
                  </button>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly market = inject(MarketStompService);
  private readonly api = inject(ApiService);

  readonly recentOrders = signal<OrderDto[]>([]);
  readonly watchlists = signal<WatchlistDto[]>([]);

  @ViewChild('sectorCanvas') sectorCanvasRef?: ElementRef<HTMLCanvasElement>;
  private donutChart: Chart | null = null;

  readonly primaryWatchlistSymbols = computed(() =>
    (this.watchlists()[0]?.symbols ?? ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK']).slice(0, 6)
  );

  readonly heroSparkline = computed(() => {
    const first = this.market.portfolio()?.holdings?.[0]?.sparkline;
    return first && first.length > 2 ? first : [100, 101.2, 100.8, 102.4, 103.1, 102.9, 104.2];
  });

  constructor() {
    effect(() => {
      const alloc = this.market.portfolio()?.sectorAllocation;
      if (alloc && this.sectorCanvasRef?.nativeElement) {
        this.renderDonut(alloc);
      }
    });
  }

  ngOnInit(): void {
    this.api.listOrders('ALL', 0, 6).subscribe({
      next: (page) => this.recentOrders.set(page.content),
      error: () => {},
    });
    this.api.getWatchlists().subscribe({
      next: (res) => this.watchlists.set(res.watchlists),
      error: () => {},
    });
  }

  ngAfterViewInit(): void {
    const alloc = this.market.portfolio()?.sectorAllocation;
    if (alloc) this.renderDonut(alloc);
  }

  private renderDonut(alloc: { sector: string; value: number; weightPct: number }[]): void {
    const canvas = this.sectorCanvasRef?.nativeElement;
    if (!canvas) return;
    if (this.donutChart) {
      this.donutChart.destroy();
    }
    const labels = alloc.length ? alloc.map((a) => a.sector) : ['Cash (Uninvested)'];
    const values = alloc.length ? alloc.map((a) => a.weightPct) : [100];
    this.donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: [
              '#10b981',
              '#38bdf8',
              '#6366f1',
              '#f59e0b',
              '#ec4899',
              '#14b8a6',
              '#8b5cf6',
              '#f43f5e',
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } },
        },
      },
    });
  }

  ngOnDestroy(): void {
    this.donutChart?.destroy();
  }
}
