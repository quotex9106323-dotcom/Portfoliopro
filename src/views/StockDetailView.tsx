import React, { useEffect, useState } from 'react';
import { ArrowLeft, Star, BellPlus, Check } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { apiFetch, formatINR } from '../services/api';
import { CandlestickChart } from '../components/CandlestickChart';
import { OrderTicketPanel } from '../components/OrderDrawer';
import type {
  FundamentalAnalysisData,
  TechnicalAnalysisData,
  TimeframeKey,
} from '../types';

export const StockDetailView: React.FC = () => {
  const {
    selectedSymbol,
    stocksMap,
    tickFlash,
    theme,
    watchlists,
    refreshPortfolioAll,
    pushToast,
    navigate,
  } = usePortfolio();

  const [timeframe, setTimeframe] = useState<TimeframeKey>('1Y');
  const [activeTab, setActiveTab] = useState<'overview' | 'technicals' | 'fundamentals' | 'insights'>('overview');
  const [techData, setTechData] = useState<TechnicalAnalysisData | null>(null);
  const [fundData, setFundData] = useState<FundamentalAnalysisData | null>(null);
  const [loadingChart, setLoadingChart] = useState<boolean>(true);
  const [alertPrice, setAlertPrice] = useState<string>('');
  const [showAlertInput, setShowAlertInput] = useState<boolean>(false);

  const stock = stocksMap[selectedSymbol];
  const flash = tickFlash[selectedSymbol];

  useEffect(() => {
    setLoadingChart(true);
    apiFetch<TechnicalAnalysisData>(
      `/api/analysis/${encodeURIComponent(selectedSymbol)}/technicals?timeframe=${timeframe}`
    )
      .then((res) => setTechData(res))
      .catch(() => {})
      .finally(() => setLoadingChart(false));
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    apiFetch<FundamentalAnalysisData>(
      `/api/analysis/${encodeURIComponent(selectedSymbol)}/fundamentals`
    )
      .then((res) => setFundData(res))
      .catch(() => {});
  }, [selectedSymbol]);

  const primaryWl = watchlists[0];
  const inWatchlist = Boolean(primaryWl?.symbols.includes(selectedSymbol));

  const handleToggleWatchlist = async () => {
    if (!primaryWl) return;
    try {
      if (inWatchlist) {
        await apiFetch(`/api/watchlists/${primaryWl.id}/items/${selectedSymbol}`, { method: 'DELETE' });
        pushToast({
          title: 'Removed from Watchlist',
          message: `${selectedSymbol} removed from ${primaryWl.name}.`,
          variant: 'info',
        });
      } else {
        await apiFetch(`/api/watchlists/${primaryWl.id}/items`, {
          method: 'POST',
          body: JSON.stringify({ symbol: selectedSymbol }),
        });
        pushToast({
          title: 'Added to Watchlist',
          message: `${selectedSymbol} added to ${primaryWl.name}.`,
          variant: 'success',
        });
      }
      await refreshPortfolioAll();
    } catch {
      // Ignore
    }
  };

  const handleCreateQuickAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(alertPrice);
    if (!stock || !target || target <= 0) return;
    const condition = target >= stock.ltp ? 'ABOVE' : 'BELOW';
    try {
      await apiFetch('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({ symbol: selectedSymbol, condition, targetPrice: target }),
      });
      await refreshPortfolioAll();
      setShowAlertInput(false);
      setAlertPrice('');
      pushToast({
        title: `Price Alert Armed — ${selectedSymbol}`,
        message: `Will notify when ${selectedSymbol} moves ${condition.toLowerCase()} ${formatINR(target)}.`,
        variant: 'success',
      });
    } catch {
      // Ignore
    }
  };

  if (!stock) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Loading {selectedSymbol} market feed...
      </div>
    );
  }

  const up = stock.changePct >= 0;
  const dayRangePct =
    stock.dayHigh > stock.dayLow
      ? Math.min(100, Math.max(0, ((stock.ltp - stock.dayLow) / (stock.dayHigh - stock.dayLow)) * 100))
      : 50;

  return (
    <div className="space-y-5">
      {/* Sticky Live Instrument Header */}
      <div className="sticky top-14 z-20 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('markets')}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            aria-label="Back to Markets"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{stock.symbol}</h1>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                NSE · {stock.sector}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{stock.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className={`px-3 py-1 rounded-lg font-mono-num text-right ${
              flash === 'UP' ? 'tick-flash-up' : flash === 'DOWN' ? 'tick-flash-down' : ''
            }`}
          >
            <div className="text-xl font-bold text-slate-900 dark:text-white">{formatINR(stock.ltp)}</div>
            <div
              className={`text-xs font-semibold ${
                up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {up ? '▲ +' : '▼ '}
              {stock.change.toFixed(2)} ({up ? '+' : ''}
              {stock.changePct.toFixed(2)}%)
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleWatchlist}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                inWatchlist
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
              {inWatchlist ? 'Watching' : 'Watchlist'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAlertInput((v) => !v);
                setAlertPrice((stock.ltp * 1.02).toFixed(0));
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <BellPlus className="w-3.5 h-3.5" />
              Alert
            </button>
          </div>
        </div>
      </div>

      {showAlertInput && (
        <form
          onSubmit={handleCreateQuickAlert}
          className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="text-xs text-slate-600 dark:text-slate-300">
            Notify me when <strong>{stock.symbol}</strong> crosses price (current {formatINR(stock.ltp)}):
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              required
              value={alertPrice}
              onChange={(e) => setAlertPrice(e.target.value)}
              className="w-32 px-3 py-1.5 text-xs font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
            >
              Set Alert
            </button>
          </div>
        </form>
      )}

      {/* Main 2-Column Split: Left Chart + Tabs | Right Sticky Trade Ticket (Kite / Groww style) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          <CandlestickChart
            data={techData}
            loading={loadingChart}
            theme={theme}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            liveLtp={stock.ltp}
            height={390}
          />

          {/* Analysis Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg w-fit">
            {(
              [
                { id: 'overview', label: 'Overview' },
                { id: 'technicals', label: 'Technicals' },
                { id: 'fundamentals', label: 'Fundamentals' },
                { id: 'insights', label: 'Catalysts & Insights' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-mono-num">
                    <span>Day Low: {formatINR(stock.dayLow)}</span>
                    <span>Day High: {formatINR(stock.dayHigh)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${dayRangePct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-mono-num">
                    <span>52W Low: {formatINR(stock.low52w)}</span>
                    <span>52W High: {formatINR(stock.high52w)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${fundData?.range52wPositionPct ?? 55}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                {[
                  { label: 'Open Price', val: formatINR(stock.open) },
                  { label: 'Prev. Close', val: formatINR(stock.prevClose) },
                  { label: 'Day Volume', val: stock.volume.toLocaleString('en-IN') },
                  { label: 'Market Cap', val: `₹${stock.marketCapCr.toLocaleString('en-IN')} Cr` },
                  { label: 'P/E Ratio', val: `${stock.peRatio.toFixed(2)}x` },
                  { label: 'P/B Ratio', val: `${stock.pbRatio.toFixed(2)}x` },
                  { label: 'Return on Equity', val: `${stock.roe.toFixed(1)}%` },
                  { label: 'Stock Beta', val: `${stock.beta.toFixed(2)}` },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</div>
                    <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-white mt-0.5">
                      {stat.val}
                    </div>
                  </div>
                ))}
              </div>

              {fundData?.about && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                    Business Profile
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {fundData.about}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'technicals' && techData && (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Server-Computed Technical Posture ({timeframe})
                  </span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    Signal:{' '}
                    <span
                      className={
                        techData.summary.signal === 'Bullish'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : techData.summary.signal === 'Bearish'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-500'
                      }
                    >
                      {techData.summary.signal}
                    </span>
                  </div>
                </div>
                <div className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                  Support {formatINR(techData.summary.supportLevel)} · Resistance{' '}
                  {formatINR(techData.summary.resistanceLevel)}
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {techData.summary.commentary}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs text-slate-500">SMA (20) / SMA (50)</div>
                  <div className="text-sm font-mono-num font-semibold text-slate-900 dark:text-white mt-0.5">
                    {techData.sma20[techData.sma20.length - 1]?.value.toFixed(2) ?? '—'} /{' '}
                    {techData.sma50[techData.sma50.length - 1]?.value.toFixed(2) ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">EMA (12) / EMA (26)</div>
                  <div className="text-sm font-mono-num font-semibold text-slate-900 dark:text-white mt-0.5">
                    {techData.ema12[techData.ema12.length - 1]?.value.toFixed(2) ?? '—'} /{' '}
                    {techData.ema26[techData.ema26.length - 1]?.value.toFixed(2) ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">RSI (14)</div>
                  <div className="text-sm font-mono-num font-semibold text-slate-900 dark:text-white mt-0.5">
                    {techData.summary.rsiValue}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">MACD Histogram</div>
                  <div className="text-sm font-mono-num font-semibold text-slate-900 dark:text-white mt-0.5">
                    {techData.summary.macdHistogram >= 0 ? '+' : ''}
                    {techData.summary.macdHistogram}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Bollinger Upper / Lower</div>
                  <div className="text-sm font-mono-num font-semibold text-slate-900 dark:text-white mt-0.5">
                    {techData.bollinger[techData.bollinger.length - 1]?.upper.toFixed(1) ?? '—'} /{' '}
                    {techData.bollinger[techData.bollinger.length - 1]?.lower.toFixed(1) ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Price vs SMA20</div>
                  <div
                    className={`text-sm font-mono-num font-semibold mt-0.5 ${
                      techData.summary.priceVsSma20Pct >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {techData.summary.priceVsSma20Pct >= 0 ? '+' : ''}
                    {techData.summary.priceVsSma20Pct}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fundamentals' && fundData && (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Ratio-Derived Fundamental Verdict
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {fundData.rating} Fundamentals{' '}
                    <span className="font-mono-num text-sm font-normal text-slate-500">
                      ({fundData.fundamentalScore}/100)
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Sector Benchmark: <strong>{fundData.sector}</strong>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {fundData.analystSummary}
              </p>

              {/* Sector Comparison Table */}
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2 text-left">Metric</th>
                      <th className="py-2 text-right">{fundData.symbol}</th>
                      <th className="py-2 text-right">{fundData.sector} Avg</th>
                      <th className="py-2 text-right">Comparison</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono-num">
                    <tr>
                      <td className="py-2.5 font-sans text-slate-700 dark:text-slate-300">P/E Multiple</td>
                      <td className="py-2.5 text-right font-semibold">{fundData.metrics.peRatio}x</td>
                      <td className="py-2.5 text-right text-slate-500">{fundData.sectorBenchmark.avgPe}x</td>
                      <td className="py-2.5 text-right">
                        {fundData.metrics.peRatio <= fundData.sectorBenchmark.avgPe ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Discount</span>
                        ) : (
                          <span className="text-amber-500">Premium</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans text-slate-700 dark:text-slate-300">Price / Book (P/B)</td>
                      <td className="py-2.5 text-right font-semibold">{fundData.metrics.pbRatio}x</td>
                      <td className="py-2.5 text-right text-slate-500">{fundData.sectorBenchmark.avgPb}x</td>
                      <td className="py-2.5 text-right">
                        {fundData.metrics.pbRatio <= fundData.sectorBenchmark.avgPb ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Value</span>
                        ) : (
                          <span className="text-slate-500">Rich</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans text-slate-700 dark:text-slate-300">Return on Equity (ROE)</td>
                      <td className="py-2.5 text-right font-semibold">{fundData.metrics.roe}%</td>
                      <td className="py-2.5 text-right text-slate-500">{fundData.sectorBenchmark.avgRoe}%</td>
                      <td className="py-2.5 text-right">
                        {fundData.metrics.roe >= fundData.sectorBenchmark.avgRoe ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Outperform</span>
                        ) : (
                          <span className="text-rose-500">Lagging</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans text-slate-700 dark:text-slate-300">Debt to Equity</td>
                      <td className="py-2.5 text-right font-semibold">{fundData.metrics.debtToEquity}x</td>
                      <td className="py-2.5 text-right text-slate-500">{fundData.sectorBenchmark.avgDebtToEquity}x</td>
                      <td className="py-2.5 text-right">
                        {fundData.metrics.debtToEquity <= fundData.sectorBenchmark.avgDebtToEquity ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Conservative</span>
                        ) : (
                          <span className="text-rose-500">Leveraged</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans text-slate-700 dark:text-slate-300">Dividend Yield</td>
                      <td className="py-2.5 text-right font-semibold">{fundData.metrics.dividendYield}%</td>
                      <td className="py-2.5 text-right text-slate-500">{fundData.sectorBenchmark.avgDivYield}%</td>
                      <td className="py-2.5 text-right">
                        EPS ₹{fundData.metrics.eps.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'insights' && fundData && (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Key Fundamental Catalysts &amp; Earnings Drivers
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  {fundData.catalysts.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="font-mono-num text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        0{idx + 1}.
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid sm:grid-cols-2 gap-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                    Balance Sheet &amp; Ratio Positives
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {fundData.strengths.map((st, i) => (
                      <li key={i}>• {st}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">
                    Key Risk Watchouts
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {fundData.watchouts.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Right Order Panel (Zerodha Kite / Groww style) */}
        <div className="lg:col-span-4 lg:sticky lg:top-32">
          <OrderTicketPanel symbol={selectedSymbol} embedded />
        </div>
      </div>
    </div>
  );
};
