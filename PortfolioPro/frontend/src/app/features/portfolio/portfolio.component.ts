import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { HoldingDto } from '../../core/models/portfolio.models';
import { ApiService } from '../../core/services/api.service';
import { MarketStompService } from '../../core/services/market-stomp.service';
import { SparklineComponent } from '../../shared/sparkline/sparkline.component';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [DecimalPipe, FormsModule, RouterLink, SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      @if (market.portfolio(); as pf) {
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 18px;">
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Invested Capital</div>
            <div class="mono" style="font-size: 20px; font-weight: 700; margin-top: 4px;">₹{{ pf.totalInvested | number: '1.2-2' }}</div>
          </div>
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Current Value</div>
            <div class="mono" style="font-size: 20px; font-weight: 700; margin-top: 4px;">₹{{ pf.currentValue | number: '1.2-2' }}</div>
          </div>
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Total P&amp;L</div>
            <div class="mono" style="font-size: 20px; font-weight: 700; margin-top: 4px;" [class.gain]="pf.totalPnl >= 0" [class.loss]="pf.totalPnl < 0">
              {{ pf.totalPnl >= 0 ? '+' : '' }}₹{{ pf.totalPnl | number: '1.2-2' }} ({{ pf.totalPnlPct | number: '1.2-2' }}%)
            </div>
          </div>
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Portfolio XIRR</div>
            <div class="mono" style="font-size: 20px; font-weight: 700; margin-top: 4px;" [class.gain]="pf.xirrPct >= 0" [class.loss]="pf.xirrPct < 0">
              {{ pf.xirrPct | number: '1.2-2' }}%
            </div>
          </div>
        </div>

        <div class="pp-card" style="margin-bottom: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="font-size: 14px;">Position P&amp;L Attribution (₹)</strong>
            <button type="button" class="pp-btn" (click)="exportHoldingsCsv(pf.holdings)">Export CSV</button>
          </div>
          <div style="height: 190px;">
            <canvas #pnlCanvas></canvas>
          </div>
        </div>

        <div class="pp-card" style="padding: 0; overflow-x: auto;">
          @if (pf.holdings.length === 0) {
            <div style="padding: 32px; text-align: center;">
              <p style="color: var(--text-secondary);">Your equity portfolio has no open positions yet.</p>
              <a routerLink="/markets" class="pp-btn pp-btn-buy" style="text-decoration: none;">Explore NSE Markets</a>
            </div>
          } @else {
            <table class="pp-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Avg Buy</th>
                  <th>LTP</th>
                  <th>Current Value</th>
                  <th>Day P&amp;L</th>
                  <th>Total P&amp;L</th>
                  <th>SL / Target</th>
                  <th>Trend</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (h of pf.holdings; track h.symbol) {
                  <tr>
                    <td>
                      <a [routerLink]="['/stocks', h.symbol]" class="mono" style="font-weight: 700; color: var(--text-primary); text-decoration: none;">
                        {{ h.symbol }}
                      </a>
                      <div style="font-size: 11px; color: var(--text-muted);">{{ h.sector }}</div>
                    </td>
                    <td class="mono">{{ h.quantity }}</td>
                    <td class="mono">₹{{ h.avgBuyPrice | number: '1.2-2' }}</td>
                    <td class="mono" style="font-weight: 600;">₹{{ h.ltp | number: '1.2-2' }}</td>
                    <td class="mono">₹{{ h.currentValue | number: '1.2-2' }}</td>
                    <td class="mono" [class.gain]="h.dayPnl >= 0" [class.loss]="h.dayPnl < 0">
                      {{ h.dayPnl >= 0 ? '+' : '' }}₹{{ h.dayPnl | number: '1.2-2' }}
                    </td>
                    <td class="mono" [class.gain]="h.totalPnl >= 0" [class.loss]="h.totalPnl < 0">
                      {{ h.totalPnl >= 0 ? '+' : '' }}₹{{ h.totalPnl | number: '1.2-2' }} ({{ h.totalPnlPct | number: '1.2-2' }}%)
                    </td>
                    <td class="mono" style="font-size: 11.5px;">
                      @if (editingSymbol() === h.symbol) {
                        <div style="display: flex; gap: 4px; align-items: center;">
                          <input type="number" class="pp-input mono" style="width: 76px; padding: 4px;" placeholder="SL" [ngModel]="editSl()" (ngModelChange)="editSl.set($event)" />
                          <input type="number" class="pp-input mono" style="width: 76px; padding: 4px;" placeholder="TP" [ngModel]="editTp()" (ngModelChange)="editTp.set($event)" />
                          <button type="button" class="pp-btn pp-btn-buy" style="padding: 4px 8px;" (click)="saveRisk(h.symbol)">Save</button>
                        </div>
                      } @else {
                        <span style="cursor: pointer;" (click)="startEditRisk(h)">
                          SL: {{ h.stopLossPrice ? '₹' + h.stopLossPrice : '—' }} / TP: {{ h.targetPrice ? '₹' + h.targetPrice : '—' }}
                        </span>
                      }
                    </td>
                    <td><app-sparkline [data]="h.sparkline" [positive]="h.totalPnl >= 0" [width]="76" [height]="24" /></td>
                    <td>
                      <div style="display: flex; gap: 6px;">
                        <button type="button" class="pp-btn pp-btn-buy" style="padding: 4px 8px;" (click)="market.openOrderDrawer(h.symbol, 'BUY')">Add</button>
                        <button type="button" class="pp-btn pp-btn-sell" style="padding: 4px 8px;" (click)="market.openOrderDrawer(h.symbol, 'SELL')">Exit</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    </div>
  `,
})
export class PortfolioComponent implements AfterViewInit, OnDestroy {
  readonly market = inject(MarketStompService);
  private readonly api = inject(ApiService);

  readonly editingSymbol = signal<string | null>(null);
  readonly editSl = signal<number | null>(null);
  readonly editTp = signal<number | null>(null);

  @ViewChild('pnlCanvas') pnlCanvasRef?: ElementRef<HTMLCanvasElement>;
  private barChart: Chart | null = null;

  constructor() {
    effect(() => {
      const holdings = this.market.portfolio()?.holdings;
      if (holdings && this.pnlCanvasRef?.nativeElement) {
        this.renderBarChart(holdings);
      }
    });
  }

  ngAfterViewInit(): void {
    const holdings = this.market.portfolio()?.holdings;
    if (holdings) this.renderBarChart(holdings);
  }

  startEditRisk(h: HoldingDto): void {
    this.editingSymbol.set(h.symbol);
    this.editSl.set(h.stopLossPrice);
    this.editTp.set(h.targetPrice);
  }

  saveRisk(symbol: string): void {
    this.api.updatePositionRisk(symbol, this.editSl(), this.editTp()).subscribe({
      next: () => {
        this.editingSymbol.set(null);
        this.market.refreshPortfolio();
        this.market.pushToast({
          type: 'success',
          title: 'Position Triggers Updated',
          message: `Auto Stop-Loss / Target saved for ${symbol}.`,
        });
      },
    });
  }

  exportHoldingsCsv(holdings: HoldingDto[]): void {
    this.api.exportCsv(
      'portfoliopro-holdings.csv',
      ['Symbol', 'Sector', 'Qty', 'AvgBuyPrice', 'LTP', 'CurrentValue', 'DayPnL', 'TotalPnL', 'TotalPnLPct'],
      holdings.map((h) => [
        h.symbol,
        h.sector,
        h.quantity,
        h.avgBuyPrice,
        h.ltp,
        h.currentValue,
        h.dayPnl,
        h.totalPnl,
        h.totalPnlPct,
      ])
    );
  }

  private renderBarChart(holdings: HoldingDto[]): void {
    const canvas = this.pnlCanvasRef?.nativeElement;
    if (!canvas) return;
    this.barChart?.destroy();
    this.barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: holdings.map((h) => h.symbol),
        datasets: [
          {
            data: holdings.map((h) => h.totalPnl),
            backgroundColor: holdings.map((h) => (h.totalPnl >= 0 ? '#10b981' : '#f43f5e')),
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    });
  }

  ngOnDestroy(): void {
    this.barChart?.destroy();
  }
}
