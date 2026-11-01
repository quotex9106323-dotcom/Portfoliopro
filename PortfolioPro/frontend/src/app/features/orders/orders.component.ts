import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderDto } from '../../core/models/portfolio.models';
import { ApiService } from '../../core/services/api.service';
import { MarketStompService } from '../../core/services/market-stomp.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 14px;">
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          @for (tab of statuses; track tab) {
            <button
              type="button"
              class="pp-btn"
              [class.pp-btn-buy]="statusFilter() === tab"
              (click)="selectStatus(tab)"
            >
              {{ tab }}
            </button>
          }
        </div>
        <button type="button" class="pp-btn" (click)="exportCsv()">Export Order Book CSV</button>
      </div>

      <div class="pp-card" style="padding: 0; overflow-x: auto;">
        @if (orders().length === 0) {
          <div style="padding: 32px; text-align: center; color: var(--text-muted);">
            No orders match the {{ statusFilter() }} filter.
          </div>
        } @else {
          <table class="pp-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Timestamp</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Price (₹)</th>
                <th>Charges</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              @for (ord of orders(); track ord.id) {
                <tr>
                  <td class="mono">#{{ ord.id }}</td>
                  <td class="mono" style="font-size: 11.5px;">{{ ord.createdAt | date: 'dd MMM HH:mm:ss' }}</td>
                  <td>
                    <a [routerLink]="['/stocks', ord.symbol]" class="mono" style="font-weight: 700; color: var(--text-primary); text-decoration: none;">
                      {{ ord.symbol }}
                    </a>
                  </td>
                  <td style="font-weight: 600;" [class.gain]="ord.side === 'BUY'" [class.loss]="ord.side === 'SELL'">
                    {{ ord.side }}
                  </td>
                  <td class="mono">{{ ord.orderType }}</td>
                  <td class="mono">{{ ord.quantity }}</td>
                  <td class="mono">
                    ₹{{ (ord.executedPrice ?? ord.limitPrice ?? ord.requestedPrice) | number: '1.2-2' }}
                  </td>
                  <td class="mono">₹{{ ord.charges | number: '1.2-2' }}</td>
                  <td class="mono">{{ ord.status }}</td>
                  <td>
                    @if (ord.status === 'PENDING') {
                      <button
                        type="button"
                        class="pp-btn pp-btn-sell"
                        style="padding: 4px 10px; font-size: 11px;"
                        (click)="cancelOrder(ord.id)"
                      >
                        Cancel
                      </button>
                    } @else {
                      <span style="color: var(--text-muted);">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly market = inject(MarketStompService);

  readonly statuses = ['ALL', 'PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED'];
  readonly statusFilter = signal<string>('ALL');
  readonly orders = signal<OrderDto[]>([]);

  ngOnInit(): void {
    this.loadOrders();
  }

  selectStatus(status: string): void {
    this.statusFilter.set(status);
    this.loadOrders();
  }

  loadOrders(): void {
    this.api.listOrders(this.statusFilter(), 0, 50).subscribe({
      next: (res) => this.orders.set(res.content),
      error: () => {},
    });
  }

  cancelOrder(id: number): void {
    this.api.cancelOrder(id).subscribe({
      next: () => {
        this.loadOrders();
        this.market.refreshPortfolio();
        this.market.pushToast({
          type: 'info',
          title: 'Order Cancelled',
          message: `Pending limit order #${id} cancelled.`,
        });
      },
    });
  }

  exportCsv(): void {
    this.api.exportCsv(
      'portfoliopro-orders.csv',
      ['OrderID', 'CreatedAt', 'Symbol', 'Side', 'Type', 'Qty', 'ExecutedOrLimitPrice', 'Charges', 'Status'],
      this.orders().map((o) => [
        o.id,
        o.createdAt,
        o.symbol,
        o.side,
        o.orderType,
        o.quantity,
        o.executedPrice ?? o.limitPrice ?? o.requestedPrice,
        o.charges,
        o.status,
      ])
    );
  }
}
