import React, { useCallback, useEffect, useState } from 'react';
import { Download, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { apiFetch, downloadCsv, formatINR } from '../services/api';
import type { WalletSummary } from '../types';

export const WalletView: React.FC = () => {
  const { refreshPortfolioAll, pushToast } = usePortfolio();
  const [data, setData] = useState<WalletSummary | null>(null);
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<string>('100000');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadWallet = useCallback(async () => {
    try {
      const res = await apiFetch<WalletSummary>('/api/wallet?size=50');
      setData(res);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num < 100) return;
    setSubmitting(true);
    try {
      const endpoint = tab === 'deposit' ? '/api/wallet/deposit' : '/api/wallet/withdraw';
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ amount: num, note: note.trim() || undefined }),
      });
      await Promise.all([loadWallet(), refreshPortfolioAll()]);
      setNote('');
      pushToast({
        title: tab === 'deposit' ? 'Funds Added to Wallet' : 'Withdrawal Processed',
        message: `${formatINR(num)} ${tab === 'deposit' ? 'credited' : 'debited'} successfully.`,
        variant: 'success',
      });
    } catch (err: unknown) {
      pushToast({
        title: 'Transaction Failed',
        message: err instanceof Error ? err.message : 'Unable to process wallet request.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportLedger = () => {
    if (!data) return;
    downloadCsv(
      'portfoliopro_wallet_ledger.csv',
      ['Txn ID', 'Timestamp', 'Type', 'Description', 'Amount (INR)', 'Balance After (INR)'],
      data.transactions.map((t) => [t.id, t.createdAt, t.type, t.description, t.amount, t.balanceAfter])
    );
  };

  const wallet = data?.wallet;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Virtual Trading Wallet &amp; Ledger</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Simulated instant UPI/NetBanking margin top-ups, payouts, and full settlement audit trail
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportLedger}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Export Ledger CSV
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: Balances + Ledger */}
        <div className="lg:col-span-8 space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">Available Margin</div>
              <div className="text-xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1">
                {formatINR(wallet?.balance ?? 0)}
              </div>
            </div>
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">Blocked in Limit Orders</div>
              <div className="text-xl font-bold font-mono-num text-amber-500 mt-1">
                {formatINR(wallet?.blockedMargin ?? 0)}
              </div>
            </div>
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">Net Capital Deposited</div>
              <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-white mt-1">
                {formatINR((wallet?.totalDeposited ?? 0) - (wallet?.totalWithdrawn ?? 0), 0)}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Transaction Ledger</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Narration</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Closing Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {(data?.transactions || []).map((t) => {
                    const credit = t.amount >= 0;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono-num text-slate-500 whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                          {t.type.replace('_', ' ')}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{t.description}</td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono-num font-semibold ${
                            credit
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {credit ? '+' : ''}
                          {formatINR(t.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-num text-slate-900 dark:text-white">
                          {formatINR(t.balanceAfter)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Add / Withdraw Simulated Funds */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-5">
            <button
              type="button"
              onClick={() => setTab('deposit')}
              className={`py-2 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'deposit'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" /> Add Funds
            </button>
            <button
              type="button"
              onClick={() => setTab('withdraw')}
              className={`py-2 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'withdraw'
                  ? 'bg-slate-900 dark:bg-slate-700 text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Amount (₹ INR)
              </label>
              <input
                type="number"
                min={100}
                step={100}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 text-base font-bold font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[50000, 100000, 500000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className="py-1.5 text-xs font-mono-num font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  +₹{(preset / 1000).toFixed(0)}k
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Reference Note (Optional)
              </label>
              <input
                type="text"
                placeholder={tab === 'deposit' ? 'Virtual UPI Top-up' : 'Bank Payout'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
            >
              {submitting
                ? 'Processing...'
                : tab === 'deposit'
                  ? `Add ${formatINR(Number(amount) || 0, 0)} to Wallet`
                  : `Withdraw ${formatINR(Number(amount) || 0, 0)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
