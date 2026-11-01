import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { PriceAlertDto, WatchlistDto } from '../../core/models/portfolio.models';
import { ApiService } from '../../core/services/api.service';
import { MarketStompService } from '../../core/services/market-stomp.service';
import { SparklineComponent } from '../../shared/sparkline/sparkline.component';

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [DecimalPipe, FormsModule, RouterLink, DragDropModule, SparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .wl-grid {
        display: grid;
        grid-template-columns: 1.5fr 1fr;
        gap: 16px;
      }
      .drag-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-surface);
        cursor: grab;
      }
      @media (max-width: 960px) {
        .wl-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: `
    <div class="wl-grid">
      <div class="pp-card">
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px;">
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            @for (wl of watchlists(); track wl.id) {
              <button
                type="button"
                class="pp-btn"
                [class.pp-btn-buy]="activeListId() === wl.id"
                (click)="activeListId.set(wl.id)"
              >
                {{ wl.name }} ({{ wl.symbols.length }})
              </button>
            }
          </div>

          <div style="display: flex; gap: 6px;">
            <input
              type="text"
              class="pp-input"
              style="width: 150px;"
              placeholder="New list name..."
              [ngModel]="newListName()"
              (ngModelChange)="newListName.set($event)"
            />
            <button type="button" class="pp-btn" (click)="createList()">+ List</button>
          </div>
        </div>

        @if (activeWatchlist(); as list) {
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <select class="pp-input" [ngModel]="symbolToAdd()" (ngModelChange)="symbolToAdd.set($event)">
              @for (st of market.stocksList(); track st.symbol) {
                <option [value]="st.symbol">{{ st.symbol }} — {{ st.name }}</option>
              }
            </select>
            <button type="button" class="pp-btn pp-btn-buy" (click)="addSymbol(list.id)">Add Stock</button>
            @if (watchlists().length > 1) {
              <button type="button" class="pp-btn pp-btn-sell" (click)="deleteList(list.id)">Delete List</button>
            }
          </div>

          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
            Drag rows vertically to reorder symbols.
          </div>

          <div cdkDropList (cdkDropListDropped)="onDrop($event, list)">
            @for (sym of list.symbols; track sym) {
              @if (market.stocksMap()[sym]; as st) {
                <div class="drag-row" cdkDrag>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: var(--text-muted);">⋮⋮</span>
                    <div>
                      <a [routerLink]="['/stocks', st.symbol]" class="mono" style="font-weight: 700; color: var(--text-primary); text-decoration: none;">
                        {{ st.symbol }}
                      </a>
                      <div style="font-size: 11px; color: var(--text-muted);">{{ st.sector }}</div>
                    </div>
                  </div>

                  <app-sparkline [data]="st.sparkline" [positive]="st.change >= 0" [width]="74" [height]="24" />

                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="text-align: right;" class="mono">
                      <div style="font-weight: 600;">₹{{ st.ltp | number: '1.2-2' }}</div>
                      <div style="font-size: 11px;" [class.gain]="st.change >= 0" [class.loss]="st.change < 0">
                        {{ st.change >= 0 ? '+' : '' }}{{ st.changePct | number: '1.2-2' }}%
                      </div>
                    </div>
                    <button type="button" class="pp-btn pp-btn-buy" style="padding: 4px 8px;" (click)="market.openOrderDrawer(st.symbol, 'BUY')">B</button>
                    <button type="button" class="pp-btn" style="padding: 4px 8px;" (click)="removeSymbol(list.id, st.symbol)">✕</button>
                  </div>
                </div>
              }
            }
          </div>
        }
      </div>

      <!-- Price Alerts Panel -->
      <div class="pp-card">
        <strong style="font-size: 14px; display: block; margin-bottom: 12px;">Live Price Alerts</strong>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
          <select class="pp-input" [ngModel]="alertSymbol()" (ngModelChange)="onAlertSymbolChange($event)">
            @for (st of market.stocksList(); track st.symbol) {
              <option [value]="st.symbol">{{ st.symbol }} (LTP ₹{{ st.ltp }})</option>
            }
          </select>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <select class="pp-input" [ngModel]="alertCond()" (ngModelChange)="alertCond.set($event)">
              <option value="ABOVE">Crosses ABOVE</option>
              <option value="BELOW">Drops BELOW</option>
            </select>
            <input type="number" step="0.5" class="pp-input mono" [ngModel]="alertPrice()" (ngModelChange)="alertPrice.set($event)" placeholder="Target ₹" />
          </div>
          <button type="button" class="pp-btn pp-btn-buy" (click)="createAlert()">Set Price Alert</button>
        </div>

        @for (al of alerts(); track al.id) {
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color); font-size: 12.5px;">
            <div>
              <strong class="mono">{{ al.symbol }}</strong>
              <span style="margin-left: 6px;">{{ al.conditionType }} ₹{{ al.targetPrice | number: '1.2-2' }}</span>
              <span style="margin-left: 6px; font-size: 11px;" [class.gain]="al.triggered">
                {{ al.triggered ? 'Triggered' : 'Armed' }}
              </span>
            </div>
            <button type="button" class="pp-btn" style="padding: 3px 8px;" (click)="deleteAlert(al.id)">Remove</button>
          </div>
        }
      </div>
    </div>
  `,
})
export class WatchlistComponent implements OnInit {
  readonly market = inject(MarketStompService);
  private readonly api = inject(ApiService);

  readonly watchlists = signal<WatchlistDto[]>([]);
  readonly alerts = signal<PriceAlertDto[]>([]);
  readonly activeListId = signal<number>(0);

  readonly newListName = signal<string>('');
  readonly symbolToAdd = signal<string>('RELIANCE');

  readonly alertSymbol = signal<string>('RELIANCE');
  readonly alertCond = signal<'ABOVE' | 'BELOW'>('ABOVE');
  readonly alertPrice = signal<number>(3050);

  readonly activeWatchlist = computed(
    () => this.watchlists().find((w) => w.id === this.activeListId()) ?? this.watchlists()[0]
  );

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.api.getWatchlists().subscribe({
      next: (res) => {
        this.watchlists.set(res.watchlists);
        this.alerts.set(res.alerts);
        if (!this.activeListId() && res.watchlists.length) {
          this.activeListId.set(res.watchlists[0].id);
        }
      },
    });
  }

  createList(): void {
    const name = this.newListName().trim();
    if (!name) return;
    this.api.createWatchlist(name).subscribe({
      next: (created) => {
        this.newListName.set('');
        this.watchlists.update((l) => [...l, created]);
        this.activeListId.set(created.id);
      },
    });
  }

  deleteList(id: number): void {
    this.api.deleteWatchlist(id).subscribe({
      next: () => {
        this.ActiveResetAndReload();
      },
    });
  }

  private ActiveResetAndReload(): void {
    this.activeListId.set(0);
    this.reload();
  }

  addSymbol(listId: number): void {
    this.api.addWatchlistSymbol(listId, this.symbolToAdd()).subscribe({
      next: (updated) => {
        this.watchlists.update((all) => all.map((w) => (w.id === listId ? updated : w)));
      },
    });
  }

  removeSymbol(listId: number, symbol: string): void {
    this.api.removeWatchlistSymbol(listId, symbol).subscribe({
      next: (updated) => {
        this.watchlists.update((all) => all.map((w) => (w.id === listId ? updated : w)));
      },
    });
  }

  onDrop(event: CdkDragDrop<string[]>, list: WatchlistDto): void {
    const copy = [...list.symbols];
    moveItemInArray(copy, event.previousIndex, event.currentIndex);
    this.watchlists.update((all) =>
      all.map((w) => (w.id === list.id ? { ...w, symbols: copy } : w))
    );
    this.api.reorderWatchlist(list.id, copy).subscribe();
  }

  onAlertSymbolChange(sym: string): void {
    this.alertSymbol.set(sym);
    const ltp = this.market.stocksMap()[sym]?.ltp;
    if (ltp) this.alertPrice.set(+(ltp * 1.03).toFixed(2));
  }

  createAlert(): void {
    this.api
      .createAlert(this.alertSymbol(), this.alertCond(), Number(this.alertPrice()))
      .subscribe({
        next: (created) => {
          this.alerts.update((a) => [created, ...a]);
          this.market.pushToast({
            type: 'success',
            title: 'Price Alert Armed',
            message: `${created.symbol} ${created.conditionType} ₹${created.targetPrice}`,
          });
        },
      });
  }

  deleteAlert(id: number): void {
    this.api.deleteAlert(id).subscribe({
      next: () => this.alerts.update((a) => a.filter((x) => x.id !== id)),
    });
  }
}
