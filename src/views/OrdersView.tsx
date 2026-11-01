import React, { useCallback, useEffect, useState } from 'react';
import { Download, XCircle } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { apiFetch, downloadCsv, formatINR } from '../services/api';
import type { OrderItem, OrderStatus } from '../types';

export const OrdersView: React.FC = () => {
  const { portfolio, refreshPortfolioAll, pushToast, navigate } = usePortfolio();
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: OrderItem[] }>(`/api/orders?status=${statusFilter}&size=60`);
      setOrders(res.items);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders, portfolio]);

  const handleCancelOrder = async (orderId: string, symbol: string) => {
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      await Promise.all([loadOrders(), refreshPortfolioAll()]);
      pushToast({
        title: `Order Cancelled — ${symbol}`,
        message: 'Blocked limit margin has been refunded to your wallet.',
        variant: 'info',
      });
    } catch (err: unknown) {
      pushToast({
        title: 'Unable to cancel order',
        message: err instanceof Error ? err.message : 'Order already processed.',
        variant: 'error',
      });
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      'portfoliopro_order_history.csv',
      ['Order ID', 'Time', 'Symbol', 'Side', 'Type', 'Qty', 'Limit Price', 'Exec Price', 'Charges', 'Total Value', 'Status', 'Trigger'],
      orders.map((o) => [
        o.id,
        o.createdAt,
        o.symbol,
        o.side,
        o.orderType,
        o.quantity,
        o.limitPrice ?? '',
        o.executedPrice ?? '',
        o.charges,
        o.totalValue,
        o.status,
        o.triggerSource ?? 'MANUAL',
      ])
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Order Book &amp; Trade History</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track open Limit orders, executed fills, statutory brokerage charges, and automated SL/Target exits
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Export Orders CSV
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg w-fit overflow-x-auto">
        {(['ALL', 'PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              statusFilter === st
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {st === 'ALL' ? 'All Orders' : st.charAt(0) + st.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">Loading order book...</div>
        ) : orders.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">No orders in this filter.</p>
            <button
              type="button"
              onClick={() => navigate('markets')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white cursor-pointer"
            >
              Place Trade
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-3">Side / Type</th>
                  <th className="py-3 px-3">Instrument</th>
                  <th className="py-3 px-3 text-right">Qty</th>
                  <th className="py-3 px-3 text-right">Order / Fill Price</th>
                  <th className="py-3 px-3 text-right">Live LTP</th>
                  <th className="py-3 px-3 text-right">Charges</th>
                  <th className="py-3 px-3 text-right">Turnover</th>
                  <th className="py-3 px-4 text-right">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono-num text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          o.side === 'BUY'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {o.side}
                      </span>{' '}
                      <span className="text-slate-500">· {o.orderType}</span>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => navigate('stock', o.symbol)}
                        className="font-semibold text-sm text-slate-900 dark:text-white hover:underline cursor-pointer"
                      >
                        {o.symbol}
                      </button>
                      {o.triggerSource && o.triggerSource !== 'MANUAL' && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400">
                          Auto: {o.triggerSource.replace('_', ' ')}
                        </div>
                      )}
                      {o.rejectionReason && (
                        <div className="text-[11px] text-rose-500 max-w-xs truncate" title={o.rejectionReason}>
                          {o.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num font-medium">{o.quantity}</td>
                    <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-white">
                      {o.executedPrice
                        ? formatINR(o.executedPrice)
                        : o.limitPrice
                          ? `Lim ${formatINR(o.limitPrice)}`
                          : formatINR(o.requestedPrice)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-slate-500">
                      {o.currentLtp ? formatINR(o.currentLtp) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-slate-500">
                      {formatINR(o.charges)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-white">
                      {formatINR(o.totalValue, 0)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            o.status === 'EXECUTED'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : o.status === 'PENDING'
                                ? 'text-amber-600 dark:text-amber-400'
                                : o.status === 'REJECTED'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-500'
                          }`}
                        >
                          {o.status}
                        </span>
                        {o.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleCancelOrder(o.id, o.symbol)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
