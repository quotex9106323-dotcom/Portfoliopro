import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletSummaryDto } from '../../core/models/portfolio.models';
import { ApiService } from '../../core/services/api.service';
import { MarketStompService } from '../../core/services/market-stomp.service';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [DecimalPipe, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      @if (wallet(); as w) {
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 18px;">
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Available Trading Balance</div>
            <div class="mono gain" style="font-size: 24px; font-weight: 700; margin-top: 4px;">
              ₹{{ w.balance | number: '1.2-2' }}
            </div>
          </div>
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Blocked Limit Margin</div>
            <div class="mono" style="font-size: 20px; font-weight: 700; margin-top: 4px;">
              ₹{{ w.blockedMargin | number: '1.2-2' }}
            </div>
          </div>
          <div class="pp-card">
            <div style="font-size: 11.5px; color: var(--text-muted);">Cumulative Deposits / Withdrawals</div>
            <div class="mono" style="font-size: 16px; font-weight: 600; margin-top: 6px;">
              +₹{{ w.totalDeposited | number: '1.0-0' }} / -₹{{ w.totalWithdrawn | number: '1.0-0' }}
            </div>
          </div>
        </div>

        <div class="pp-card" style="margin-bottom: 18px; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px;">
          <label style="font-size: 12px; font-weight: 600;">
            Amount (₹)
            <input type="number" min="100" step="500" class="pp-input mono" style="width: 180px; margin-top: 4px;" [ngModel]="amount()" (ngModelChange)="amount.set($event)" />
          </label>
          <div style="display: flex; gap: 6px;">
            @for (preset of [25000, 100000, 250000]; track preset) {
              <button type="button" class="pp-btn mono" (click)="amount.set(preset)">+₹{{ preset | number }}</button>
            }
          </div>
          <button type="button" class="pp-btn pp-btn-buy" (click)="deposit()">Add Virtual Funds</button>
          <button type="button" class="pp-btn pp-btn-sell" (click)="withdraw()">Withdraw Funds</button>
          <button type="button" class="pp-btn" style="margin-left: auto;" (click)="exportLedgerCsv()">Export Ledger CSV</button>
        </div>

        <div class="pp-card" style="padding: 0; overflow-x: auto;">
          <table class="pp-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Amount (₹)</th>
                <th>Balance After (₹)</th>
              </tr>
            </thead>
            <tbody>
              @for (tx of w.ledger.content; track tx.id) {
                <tr>
                  <td class="mono" style="font-size: 11.5px;">{{ tx.createdAt | date: 'dd MMM yyyy HH:mm' }}</td>
                  <td class="mono" style="font-weight: 600;">{{ tx.txType }}</td>
                  <td>{{ tx.referenceNote }}</td>
                  <td
                    class="mono"
                    [class.gain]="tx.txType === 'DEPOSIT' || tx.txType === 'SELL_CREDIT' || tx.txType === 'MARGIN_RELEASE'"
                    [class.loss]="tx.txType === 'WITHDRAWAL' || tx.txType === 'BUY_DEBIT' || tx.txType === 'MARGIN_BLOCK'"
                  >
                    ₹{{ tx.amount | number: '1.2-2' }}
                  </td>
                  <td class="mono">₹{{ tx.balanceAfter | number: '1.2-2' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class WalletComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly market = inject(MarketStompService);

  readonly wallet = signal<WalletSummaryDto | null>(null);
  readonly amount = signal<number>(50000);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.api.getWallet(0, 40).subscribe({ next: (w) => this.wallet.set(w) });
  }

  deposit(): void {
    const amt = Number(this.amount());
    if (amt <= 0) return;
    this.api.depositFunds(amt, 'Instant UPI Virtual Top-up').subscribe({
      next: () => {
        this.reload();
        this.market.refreshPortfolio();
        this.market.pushToast({
          type: 'success',
          title: 'Funds Added',
          message: `₹${amt.toLocaleString('en-IN')} credited to virtual wallet.`,
        });
      },
    });
  }

  withdraw(): void {
    const amt = Number(this.amount());
    if (amt <= 0) return;
    this.api.withdrawFunds(amt, 'Simulated Bank Payout').subscribe({
      next: () => {
        this.reload();
        this.market.refreshPortfolio();
        this.market.pushToast({
          type: 'info',
          title: 'Withdrawal Processed',
          message: `₹${amt.toLocaleString('en-IN')} debited from virtual wallet.`,
        });
      },
      error: (err) => {
        this.market.pushToast({
          type: 'error',
          title: 'Withdrawal Failed',
          message: err?.error?.message ?? 'Insufficient available wallet balance.',
        });
      },
    });
  }

  exportLedgerCsv(): void {
    const rows = (this.wallet()?.ledger.content ?? []).map((t) => [
      t.createdAt,
      t.txType,
      t.referenceNote,
      t.amount,
      t.balanceAfter,
    ]);
    this.api.exportCsv(
      'portfoliopro-wallet-ledger.csv',
      ['Timestamp', 'Type', 'Reference', 'Amount', 'BalanceAfter'],
      rows
    );
  }
}
