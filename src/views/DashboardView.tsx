import React, { useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { ArrowUpRight, ArrowDownRight, Plus, ArrowRight } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { apiFetch, formatINR, formatCompactINR } from '../services/api';
import { Sparkline } from '../components/Sparkline';
import type { OrderItem } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend);

const SECTOR_COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#f97316',
  '#64748b',
];

export const DashboardView: React.FC = () => {
  const {
    indices,
    stocks,
    portfolio,
    watchlists,
    tickFlash,
    theme,
    navigate,
    openOrderDrawer,
  } = usePortfolio();

  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);

  useEffect(() => {
    apiFetch<{ items: OrderItem[] }>('/api/orders?size=6')
      .then((res) => setRecentOrders(res.items))
      .catch(() => {});
  }, [portfolio]);

  const gainers = useMemo(
    () => [...stocks].sort((a, b) => b.changePct - a.changePct).slice(0, 5),
    [stocks]
  );
  const losers = useMemo(
    () => [...stocks].sort((a, b) => a.changePct - b.changePct).slice(0, 5),
    [stocks]
  );

  // Synthetic equity curve for portfolio hero sparkline anchored to current account equity
  const equitySparkline = useMemo(() => {
    const base = portfolio?.totalAccountEquity || 1000000;
    const rel = stocks[0]?.sparkline || [100, 101, 102, 101.5, 103];
    const last = rel[rel.length - 1] || 1;
    return rel.map((v) => (v / last) * base);
  }, [portfolio?.totalAccountEquity, stocks]);

  const donutData = useMemo(() => {
    const sectors = portfolio?.sectorAllocation || [];
    return {
      labels: sectors.map((s) => s.sector),
      datasets: [
        {
          data: sectors.map((s) => s.value),
          backgroundColor: SECTOR_COLORS.slice(0, sectors.length),
          borderColor: theme === 'dark' ? '#111827' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    };
  }, [portfolio?.sectorAllocation, theme]);

  const primaryWatchlist = watchlists[0];

  if (!portfolio && stocks.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800/70" />
          ))}
        </div>
        <div className="h-52 rounded-xl bg-slate-200 dark:bg-slate-800/70" />
      </div>
    );
  }

  const totalPnl = portfolio?.totalPnl ?? 0;
  const dayPnl = portfolio?.dayPnl ?? 0;

  return (
    <div className="space-y-6">
      {/* Live Benchmark Indices Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {indices.map((idx) => {
          const up = idx.change >= 0;
          return (
            <div
              key={idx.name}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{idx.name}</div>
                <div className="text-base font-bold font-mono-num text-slate-900 dark:text-white mt-0.5">
                  {idx.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div
                className={`text-right text-xs font-mono-num font-semibold ${
                  up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                <div>
                  {up ? '▲ +' : '▼ '}
                  {idx.change.toFixed(2)}
                </div>
                <div>
                  ({up ? '+' : ''}
                  {idx.changePct.toFixed(2)}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Portfolio Hero Card + Sector Allocation Donut */}
      <div className="grid lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Portfolio Net Worth (Holdings + Cash)
              </p>
              <div className="text-3xl sm:text-4xl font-bold font-mono-num text-slate-900 dark:text-white mt-1">
                {formatINR(portfolio?.totalAccountEquity ?? 1000000)}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono-num">
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    dayPnl >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {dayPnl >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  Day P&amp;L: {dayPnl >= 0 ? '+' : ''}
                  {formatINR(dayPnl)} ({dayPnl >= 0 ? '+' : ''}
                  {(portfolio?.dayPnlPct ?? 0).toFixed(2)}%)
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-slate-500 dark:text-slate-400">
                  XIRR:{' '}
                  <strong
                    className={
                      (portfolio?.xirrPct ?? 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {(portfolio?.xirrPct ?? 0) >= 0 ? '+' : ''}
                    {(portfolio?.xirrPct ?? 0).toFixed(2)}%
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Sparkline
                data={equitySparkline}
                positive={totalPnl >= 0}
                width={150}
                height={52}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/80">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Invested Capital</div>
              <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-white mt-0.5">
                {formatINR(portfolio?.totalInvested ?? 0, 0)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Holdings Value</div>
              <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-white mt-0.5">
                {formatINR(portfolio?.currentValue ?? 0, 0)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Total P&amp;L</div>
              <div
                className={`text-sm font-bold font-mono-num mt-0.5 ${
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
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Available Margin</div>
              <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
                <span>{formatCompactINR(portfolio?.walletBalance ?? 0)}</span>
                <button
                  type="button"
                  onClick={() => navigate('wallet')}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-sans font-semibold cursor-pointer"
                >
                  +Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sector Allocation Donut */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sector Allocation</h2>
            <button
              type="button"
              onClick={() => navigate('portfolio')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Holdings
            </button>
          </div>

          {portfolio && portfolio.sectorAllocation.length > 0 ? (
            <div className="grid grid-cols-12 gap-3 items-center my-auto">
              <div className="col-span-5 h-36 flex items-center justify-center">
                <Doughnut
                  data={donutData}
                  options={{
                    cutout: '68%',
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => ` ${ctx.label}: ${formatCompactINR(Number(ctx.raw))}`,
                        },
                      },
                    },
                    maintainAspectRatio: false,
                  }}
                />
              </div>
              <div className="col-span-7 space-y-1.5">
                {portfolio.sectorAllocation.slice(0, 5).map((s, i) => (
                  <div key={s.sector} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                      />
                      <span className="text-slate-600 dark:text-slate-300 truncate">{s.sector}</span>
                    </div>
                    <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                      {s.weightPct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center space-y-2">
              <p className="text-xs text-slate-500">No active holdings yet.</p>
              <button
                type="button"
                onClick={() => navigate('markets')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white cursor-pointer"
              >
                Explore NSE Stocks
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top Gainers & Top Losers */}
      <div className="grid md:grid-cols-2 gap-6">
        {[
          { title: 'Top NSE Gainers', list: gainers, isGain: true },
          { title: 'Top NSE Pullbacks', list: losers, isGain: false },
        ].map((grp) => (
          <div
            key={grp.title}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{grp.title}</h2>
              <button
                type="button"
                onClick={() => navigate('markets')}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {grp.list.map((s) => {
                const flash = tickFlash[s.symbol];
                return (
                  <div
                    key={s.symbol}
                    onClick={() => navigate('stock', s.symbol)}
                    className={`flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                      flash === 'UP' ? 'tick-flash-up' : flash === 'DOWN' ? 'tick-flash-down' : ''
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{s.symbol}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.name}</div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <Sparkline data={s.sparkline} positive={s.changePct >= 0} width={68} height={22} />
                      <div className="text-right font-mono-num w-24">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {formatINR(s.ltp)}
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            s.changePct >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {s.changePct >= 0 ? '+' : ''}
                          {s.changePct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Watchlist Snapshot + Recent Orders */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Watchlist · {primaryWatchlist?.name || 'Core Stocks'}
            </h2>
            <button
              type="button"
              onClick={() => navigate('watchlist')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Manage Lists
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {(primaryWatchlist?.items || []).slice(0, 6).map((item) => {
              const live = stocks.find((st) => st.symbol === item.symbol) || item;
              return (
                <div
                  key={live.symbol}
                  className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <button
                    type="button"
                    onClick={() => navigate('stock', live.symbol)}
                    className="text-left min-w-0 pr-3 cursor-pointer"
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{live.symbol}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{live.sector}</div>
                  </button>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right font-mono-num">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatINR(live.ltp)}
                      </div>
                      <div
                        className={`text-xs ${
                          live.changePct >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {live.changePct >= 0 ? '+' : ''}
                        {live.changePct.toFixed(2)}%
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openOrderDrawer(live.symbol, 'BUY', 'MARKET')}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 inline -mt-0.5" /> Buy
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Orders</h2>
            <button
              type="button"
              onClick={() => navigate('orders')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Order Book
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No orders placed yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {recentOrders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => navigate('stock', o.symbol)}
                  className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      <span
                        className={
                          o.side === 'BUY'
                            ? 'text-emerald-600 dark:text-emerald-400 mr-1.5'
                            : 'text-rose-600 dark:text-rose-400 mr-1.5'
                        }
                      >
                        {o.side}
                      </span>
                      {o.symbol} · <span className="font-mono-num font-normal text-xs">{o.quantity} qty</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {o.orderType} · {o.status} · {new Date(o.createdAt).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div className="text-right font-mono-num">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatINR(o.executedPrice || o.limitPrice || o.requestedPrice)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Val {formatCompactINR(o.totalValue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
