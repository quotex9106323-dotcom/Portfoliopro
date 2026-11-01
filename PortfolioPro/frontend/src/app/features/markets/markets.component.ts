import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ApiService } from '../../core/services/api.service';
import { MarketStompService } from '../../core/services/market-stomp.service';
import { SparklineComponent } from '../../shared/sparkline/sparkline.component';

type SortKey = 'symbol' | 'ltp' | 'changePct' | 'volume' | 'marketCapCr' | 'peRatio';

@Component({
  selector: 'app-markets',
  standalone: true,
  imports: [DecimalPipe, FormsModule, RouterLink, ScrollingModule, SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .filter-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 14px;
      }
      .sector-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .viewport {
        height: 560px;
        width: 100%;
      }
      .virtual-row {
        display: grid;
        grid-template-columns: 1.4fr 1fr 0.9fr 0.9fr 0.9fr 0.8fr 96px 120px;
        align-items: center;
        height: 52px;
        padding: 0 12px;
        border-bottom: 1px solid var(--border-color);
        font-size: 12.5px;
      }
      .virtual-header {
        background: var(--bg-muted);
        font-weight: 600;
        font-size: 11px;
        color: var(--text-secondary);
        height: 40px;
      }
      .sort-btn {
        background: none;
        border: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
        padding: 0;
        text-align: left;
      }
    `,
  ],
  template: `
    <div>
      <div class="filter-bar">
        <div class="sector-tabs">
          <button
            type="button"
            class="pp-btn"
            [class.pp-btn-buy]="selectedSector() === 'ALL'"
            (click)="selectedSector.set('ALL')"
          >
            All Sectors
          </button>
          @for (sec of market.sectors(); track sec) {
            <button
              type="button"
              class="pp-btn"
              [class.pp-btn-buy]="selectedSector() === sec"
              (click)="selectedSector.set(sec)"
            >
              {{ sec }}
            </button>
          }
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <input
            type="text"
            class="pp-input"
            style="width: 220px;"
            placeholder="Filter symbol or company..."
            [ngModel]="search()"
            (ngModelChange)="onSearchInput($event)"
          />
          <button type="button" class="pp-btn" (click)="exportCsv()">Export CSV</button>
        </div>
      </div>

      <div class="pp-card" style="padding: 0; overflow: hidden;">
        <div class="virtual-row virtual-header">
          <button type="button" class="sort-btn" (click)="toggleSort('symbol')">Instrument</button>
          <button type="button" class="sort-btn" (click)="toggleSort('ltp')">LTP (₹)</button>
          <button type="button" class="sort-btn" (click)="toggleSort('changePct')">24h Change</button>
          <button type="button" class="sort-btn" (click)="toggleSort('volume')">Volume</button>
          <button type="button" class="sort-btn" (click)="toggleSort('marketCapCr')">Mkt Cap (Cr)</button>
          <button type="button" class="sort-btn" (click)="toggleSort('peRatio')">P/E</button>
          <span>Trend</span>
          <span style="text-align: right;">Trade</span>
        </div>

        <cdk-virtual-scroll-viewport itemSize="52" class="viewport">
          <div
            *cdkVirtualFor="let st of filteredStocks(); trackBy: trackSymbol"
            class="virtual-row"
            [class.flash-up]="market.tickFlashes()[st.symbol] === 'UP'"
            [class.flash-down]="market.tickFlashes()[st.symbol] === 'DOWN'"
          >
            <div>
              <a
                [routerLink]="['/stocks', st.symbol]"
                class="mono"
                style="font-weight: 700; color: var(--text-primary); text-decoration: none;"
              >
                {{ st.symbol }}
              </a>
              <div style="font-size: 11px; color: var(--text-muted);">{{ st.name }}</div>
            </div>
            <div class="mono" style="font-weight: 600;">₹{{ st.ltp | number: '1.2-2' }}</div>
            <div class="mono" [class.gain]="st.change >= 0" [class.loss]="st.change < 0">
              {{ st.change >= 0 ? '+' : '' }}{{ st.changePct | number: '1.2-2' }}%
            </div>
            <div class="mono">{{ st.volume | number }}</div>
            <div class="mono">₹{{ st.marketCapCr | number: '1.0-0' }}</div>
            <div class="mono">{{ st.peRatio | number: '1.1-1' }}x</div>
            <div>
              <app-sparkline [data]="st.sparkline" [positive]="st.change >= 0" [width]="82" [height]="26" />
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 6px;">
              <button
                type="button"
                class="pp-btn pp-btn-buy"
                style="padding: 4px 10px;"
                (click)="market.openOrderDrawer(st.symbol, 'BUY')"
              >
                B
              </button>
              <button
                type="button"
                class="pp-btn pp-btn-sell"
                style="padding: 4px 10px;"
                (click)="market.openOrderDrawer(st.symbol, 'SELL')"
              >
                S
              </button>
            </div>
          </div>
        </cdk-virtual-scroll-viewport>
      </div>
    </div>
  `,
})
export class MarketsComponent {
  readonly market = inject(MarketStompService);
  private readonly api = inject(ApiService);

  readonly selectedSector = signal<string>('ALL');
  readonly search = signal<string>('');
  readonly debouncedSearch = signal<string>('');
  readonly sortKey = signal<SortKey>('marketCapCr');
  readonly sortAsc = signal<boolean>(false);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly filteredStocks = computed(() => {
    const sec = this.selectedSector();
    const q = this.debouncedSearch().trim().toLowerCase();
    const key = this.sortKey();
    const asc = this.sortAsc();

    return this.market
      .stocksList()
      .filter((s) => (sec === 'ALL' ? true : s.sector === sec))
      .filter((s) =>
        !q ? true : s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (typeof av === 'string' && typeof bv === 'string') {
          return asc ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return asc ? Number(av) - Number(bv) : Number(bv) - Number(av);
      });
  });

  onSearchInput(val: string): void {
    this.search.set(val);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.debouncedSearch.set(val), 180);
  }

  toggleSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortAsc.update((v) => !v);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(false);
    }
  }

  trackSymbol(_: number, item: { symbol: string }): string {
    return item.symbol;
  }

  exportCsv(): void {
    const rows = this.filteredStocks().map((s) => [
      s.symbol,
      s.name,
      s.sector,
      s.ltp,
      s.changePct,
      s.volume,
      s.marketCapCr,
      s.peRatio,
    ]);
    this.api.exportCsv(
      'portfoliopro-nse-markets.csv',
      ['Symbol', 'Company', 'Sector', 'LTP', 'ChangePct', 'Volume', 'MarketCapCr', 'PE'],
      rows
    );
  }
}
