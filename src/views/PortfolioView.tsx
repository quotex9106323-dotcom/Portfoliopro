import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Download, Shield, ArrowUpDown } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { apiFetch, downloadCsv, formatINR } from '../services/api';
import { Sparkline } from '../components/Sparkline';
import type { HoldingItem } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type HoldSort = 'currentValue' | 'totalPnl' | 'totalPnlPct' | 'dayPnl' | 'symbol';

export const PortfolioView: React.FC = () => {
  const { portfolio, tickFlash, theme, navigate, openOrderDrawer, refreshPortfolioAll, pushToast } =
    usePortfolio();
  const [sortBy, setSortBy] = useState<HoldSort>('currentValue');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [editingRisk, setEditingRisk] = useState<HoldingItem | null>(null);
  const [slInput, setSlInput] = useState<string>('');
  const [tpInput, setTpInput] = useState<string>('');

  const holdings = useMemo(() => {
    const list = [...(portfolio?.holdings || [])];
    return list.sort((a, b) => {
      if (sortBy === 'symbol') {
        return sortAsc ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
      }
      return sortAsc ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy];
    });
  }, [portfolio?.holdings, sortBy, sortAsc]);

  const toggleSort = (col: HoldSort) => {
    if (sortBy === col) setSortAsc((v) => !v);
    else {
      setSortBy(col);
      setSortAsc(col === 'symbol');
    }
  };

  const pnlBarData = useMemo(() => {
    return {
      labels: holdings.map((h) => h.symbol),
      datasets: [
        {
          label: 'Total P&L (₹)',
          data: holdings.map((h) => h.totalPnl),
          backgroundColor: holdings.map((h) =>
            h.totalPnl >= 0 ? 'rgba(16, 185, 129, 0.78)' : 'rgba(244, 63, 94, 0.78)'
          ),
          borderRadius: 5,
        },
      ],
    };
  }, [holdings]);

  const handleSaveRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRisk) return;
    try {
      await apiFetch(`/api/portfolio/holdings/${editingRisk.symbol}/risk`, {
        method: 'PUT',
        body: JSON.stringify({
          stopLossPrice: slInput ? Number(slInput) : null,
          targetPrice: tpInput ? Number(tpInput) : null,
        }),
      });
      await refreshPortfolioAll();
      pushToast({
        title: `Risk Triggers Saved — ${editingRisk.symbol}`,
        message: `SL ${slInput ? formatINR(Number(slInput)) : 'Off'} · Target ${tpInput ? formatINR(Number(tpInput)) : 'Off'}`,
        variant: 'success',
      });
      setEditingRisk(null);
    } catch (err: unknown) {
      pushToast({
        title: 'Failed to update triggers',
        message: err instanceof Error ? err.message : 'Invalid price levels.',
        variant: 'error',
      });
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      'portfoliopro_holdings.csv',
      [
        'Symbol',
        'Sector',
        'Qty',
        'Avg Buy Price',
        'LTP',
        'Invested',
        'Current Value',
        'Day P&L',
        'Total P&L',
        'Total Return %',
        'Stop-Loss',
        'Target',
      ],
      holdings.map((h) => [
        h.symbol,
        h.sector,
        h.quantity,
        h.avgBuyPrice,
        h.ltp,
        h.investedAmount,
        h.currentValue,
        h.dayPnl,
        h.totalPnl,
        h.totalPnlPct,
        h.stopLossPrice ?? '',
        h.targetPrice ?? '',
      ])
    );
  };

  const totalPnl = portfolio?.totalPnl ?? 0;
  const dayPnl = portfolio?.dayPnl ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Portfolio Holdings</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time mark-to-market valuation, XIRR annualized return, and automated position triggers
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Export Holdings CSV
        </button>
      </div>

      {/* Returns Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Invested Capital</div>
          <div className="text-lg font-bold font-mono-num text-slate-900 dark:text-white mt-1">
            {formatINR(portfolio?.totalInvested ?? 0, 0)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Current Market Value</div>
          <div className="text-lg font-bold font-mono-num text-slate-900 dark:text-white mt-1">
            {formatINR(portfolio?.currentValue ?? 0, 0)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total P&amp;L</div>
          <div
            className={`text-lg font-bold font-mono-num mt-1 ${
              totalPnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {totalPnl >= 0 ? '+' : ''}
            {formatINR(totalPnl, 0)} ({totalPnl >= 0 ? '+' : ''}
            {(portfolio?.totalPnlPct ?? 0).toFixed(2)}%)
          </div>
        </div>
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Day P&amp;L</div>
          <div
            className={`text-lg font-bold font-mono-num mt-1 ${
              dayPnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {dayPnl >= 0 ? '+' : ''}
            {formatINR(dayPnl)}
          </div>
        </div>
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Portfolio XIRR</div>
          <div
            className={`text-lg font-bold font-mono-num mt-1 ${
              (portfolio?.xirrPct ?? 0) >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {(portfolio?.xirrPct ?? 0) >= 0 ? '+' : ''}
            {(portfolio?.xirrPct ?? 0).toFixed(2)}% p.a.
          </div>
        </div>
      </div>

      {/* Position P&L Chart.js Bar Chart */}
      {holdings.length > 0 && (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Position-wise Unrealized P&amp;L (₹)
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {holdings.length} active equities
            </span>
          </div>
          <div className="h-48">
            <Bar
              data={pnlBarData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: {
                    ticks: { color: theme === 'dark' ? '#94a3b8' : '#475569', font: { size: 11 } },
                    grid: { display: false },
                  },
                  y: {
                    ticks: { color: theme === 'dark' ? '#94a3b8' : '#475569', font: { size: 11 } },
                    grid: {
                      color: theme === 'dark' ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.06)',
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Holdings Data Table */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {holdings.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Your equity portfolio is currently empty.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Deploy your virtual wallet across 30 live NSE stocks with Market or Limit orders.
            </p>
            <button
              type="button"
              onClick={() => navigate('markets')}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
            >
              Browse Markets
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => toggleSort('symbol')}
                      className="inline-flex items-center gap-1 cursor-pointer"
                    >
                      Stock <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">Qty</th>
                  <th className="py-3 px-3 text-right">Avg Buy</th>
                  <th className="py-3 px-3 text-right">LTP</th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('currentValue')}
                      className="inline-flex items-center gap-1 cursor-pointer"
                    >
                      Cur. Value <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('dayPnl')}
                      className="inline-flex items-center gap-1 cursor-pointer"
                    >
                      Day P&amp;L <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('totalPnl')}
                      className="inline-flex items-center gap-1 cursor-pointer"
                    >
                      Total P&amp;L <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 hidden lg:table-cell text-center">Trend</th>
                  <th className="py-3 px-3 text-right">SL / Target</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {holdings.map((h) => {
                  const flash = tickFlash[h.symbol];
                  const up = h.totalPnl >= 0;
                  return (
                    <tr
                      key={h.id}
                      onClick={() => navigate('stock', h.symbol)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                        flash === 'UP' ? 'tick-flash-up' : flash === 'DOWN' ? 'tick-flash-down' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">{h.symbol}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{h.sector}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-medium text-slate-800 dark:text-slate-200">
                        {h.quantity}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-600 dark:text-slate-400">
                        {formatINR(h.avgBuyPrice)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-white">
                        {formatINR(h.ltp)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-white">
                        {formatINR(h.currentValue, 0)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono-num ${
                          h.dayPnl >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {h.dayPnl >= 0 ? '+' : ''}
                        {formatINR(h.dayPnl)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono-num font-semibold ${
                          up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        <div>
                          {up ? '+' : ''}
                          {formatINR(h.totalPnl)}
                        </div>
                        <div className="text-[11px]">
                          ({up ? '+' : ''}
                          {h.totalPnlPct.toFixed(2)}%)
                        </div>
                      </td>
                      <td className="py-3 px-3 hidden lg:table-cell">
                        <div className="flex justify-center">
                          <Sparkline data={h.sparkline} positive={up} width={72} height={22} />
                        </div>
                      </td>
                      <td
                        className="py-3 px-3 text-right font-mono-num text-[11px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRisk(h);
                            setSlInput(h.stopLossPrice ? String(h.stopLossPrice) : '');
                            setTpInput(h.targetPrice ? String(h.targetPrice) : '');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          <Shield className="w-3 h-3 text-emerald-500" />
                          {h.stopLossPrice || h.targetPrice
                            ? `${h.stopLossPrice ? `₹${h.stopLossPrice}` : '—'} / ${h.targetPrice ? `₹${h.targetPrice}` : '—'}`
                            : 'Set SL/TP'}
                        </button>
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openOrderDrawer(h.symbol, 'BUY', 'MARKET')}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                          >
                            +Add
                          </button>
                          <button
                            type="button"
                            onClick={() => openOrderDrawer(h.symbol, 'SELL', 'MARKET')}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                          >
                            Exit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline SL / Target Modal */}
      {editingRisk && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingRisk(null)}
        >
          <form
            onSubmit={handleSaveRisk}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Position Risk Triggers · {editingRisk.symbol}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Current LTP: {formatINR(editingRisk.ltp)} · Avg Buy: {formatINR(editingRisk.avgBuyPrice)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Auto Stop-Loss Price (₹)
              </label>
              <input
                type="number"
                step="0.5"
                placeholder={(editingRisk.ltp * 0.94).toFixed(0)}
                value={slInput}
                onChange={(e) => setSlInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Auto Target Price (₹)
              </label>
              <input
                type="number"
                step="0.5"
                placeholder={(editingRisk.ltp * 1.12).toFixed(0)}
                value={tpInput}
                onChange={(e) => setTpInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRisk(null)}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                Save Triggers
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
