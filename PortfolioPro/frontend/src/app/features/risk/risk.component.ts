import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RiskSummaryDto } from '../../core/models/portfolio.models';
import { ApiService } from '../../core/services/api.service';
import { MarketStompService } from '../../core/services/market-stomp.service';

@Component({
  selector: 'app-risk',
  standalone: true,
  imports: [DecimalPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      @if (risk(); as r) {
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 18px;">
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Portfolio Risk Score</div>
            <div class="mono" style="font-size: 24px; font-weight: 700; margin-top: 4px;">
              {{ r.riskScore }}/100 · {{ r.riskLabel }}
            </div>
          </div>
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Daily 95% Value-at-Risk (VaR)</div>
            <div class="mono loss" style="font-size: 22px; font-weight: 700; margin-top: 4px;">
              ₹{{ r.dailyVar95 | number: '1.2-2' }} ({{ r.dailyVar95Pct | number: '1.2-2' }}%)
            </div>
          </div>
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Portfolio Beta &amp; Volatility</div>
            <div class="mono" style="font-size: 20px; font-weight: 700; margin-top: 4px;">
              β {{ r.weightedBeta | number: '1.2-2' }} · {{ r.annualizedVolatilityPct | number: '1.1-1' }}% Vol
            </div>
          </div>
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Est. Drawdown / SL Coverage</div>
            <div class="mono" style="font-size: 20px; font-weight: 700; margin-top: 4px;">
              -{{ r.estimatedMaxDrawdownPct | number: '1.1-1' }}% · SL {{ r.stopLossCoveragePct | number: '1.0-0' }}%
            </div>
          </div>
        </div>

        <div class="pp-card" style="margin-bottom: 18px;">
          <strong style="font-size: 14px; display: block; margin-bottom: 10px;">Plain-Language Risk Alerts</strong>
          @for (al of r.alerts; track al.title) {
            <div
              style="padding: 10px 12px; border-radius: 8px; background: var(--bg-muted); margin-bottom: 8px; border-left: 3px solid;"
              [style.border-left-color]="al.severity === 'HIGH' ? 'var(--color-loss)' : al.severity === 'MEDIUM' ? '#f59e0b' : 'var(--color-gain)'"
            >
              <div style="font-weight: 600; font-size: 13px;">{{ al.title }}</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">{{ al.detail }}</div>
            </div>
          }
        </div>

        <div class="pp-card" style="padding: 0; overflow-x: auto;">
          <table class="pp-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Weight %</th>
                <th>Beta</th>
                <th>LTP</th>
                <th>Auto Stop-Loss (₹)</th>
                <th>Auto Target (₹)</th>
                <th>Save</th>
              </tr>
            </thead>
            <tbody>
              @for (pos of r.positions; track pos.symbol) {
                <tr>
                  <td>
                    <strong class="mono">{{ pos.symbol }}</strong>
                    @if (pos.oversizedWarning) {
                      <span class="loss" style="font-size: 11px; margin-left: 6px;">Oversized (&gt;25%)</span>
                    }
                  </td>
                  <td class="mono">{{ pos.weightPct | number: '1.2-2' }}%</td>
                  <td class="mono">{{ pos.beta | number: '1.2-2' }}</td>
                  <td class="mono">₹{{ pos.ltp | number: '1.2-2' }}</td>
                  <td>
                    <input
                      type="number"
                      step="0.5"
                      class="pp-input mono"
                      style="width: 110px;"
                      [ngModel]="slDrafts()[pos.symbol] ?? pos.stopLossPrice"
                      (ngModelChange)="setDraft('sl', pos.symbol, $event)"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.5"
                      class="pp-input mono"
                      style="width: 110px;"
                      [ngModel]="tpDrafts()[pos.symbol] ?? pos.targetPrice"
                      (ngModelChange)="setDraft('tp', pos.symbol, $event)"
                    />
                  </td>
                  <td>
                    <button type="button" class="pp-btn pp-btn-buy" (click)="savePositionTriggers(pos.symbol, pos.stopLossPrice, pos.targetPrice)">
                      Update
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class RiskComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly market = inject(MarketStompService);

  readonly risk = signal<RiskSummaryDto | null>(null);
  readonly slDrafts = signal<Record<string, number | null>>({});
  readonly tpDrafts = signal<Record<string, number | null>>({});

  ngOnInit(): void {
    this.loadRisk();
  }

  loadRisk(): void {
    this.api.getRiskSummary().subscribe({ next: (res) => this.risk.set(res) });
  }

  setDraft(kind: 'sl' | 'tp', symbol: string, val: number): void {
    const parsed = val ? Number(val) : null;
    if (kind === 'sl') {
      this.slDrafts.update((m) => ({ ...m, [symbol]: parsed }));
    } else {
      this.tpDrafts.update((m) => ({ ...m, [symbol]: parsed }));
    }
  }

  savePositionTriggers(symbol: string, currentSl: number | null, currentTp: number | null): void {
    const sl = symbol in this.slDrafts() ? this.slDrafts()[symbol] : currentSl;
    const tp = symbol in this.tpDrafts() ? this.tpDrafts()[symbol] : currentTp;
    this.api.updatePositionRisk(symbol, sl, tp).subscribe({
      next: () => {
        this.loadRisk();
        this.market.refreshPortfolio();
        this.market.pushToast({
          type: 'success',
          title: 'Protection Updated',
          message: `Stop-Loss & Target updated on ${symbol}.`,
        });
      },
    });
  }
}
