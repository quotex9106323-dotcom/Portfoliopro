import React, { useEffect, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { apiFetch, formatINR } from '../services/api';
import { CandlestickChart } from '../components/CandlestickChart';
import type {
  FundamentalAnalysisData,
  TechnicalAnalysisData,
  TimeframeKey,
} from '../types';

export const AnalysisView: React.FC = () => {
  const { stocks, selectedSymbol, theme, openOrderDrawer } = usePortfolio();
  const [symbol, setSymbol] = useState<string>(selectedSymbol || 'RELIANCE');
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1Y');
  const [tech, setTech] = useState<TechnicalAnalysisData | null>(null);
  const [fund, setFund] = useState<FundamentalAnalysisData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<TechnicalAnalysisData>(`/api/analysis/${symbol}/technicals?timeframe=${timeframe}`),
      apiFetch<FundamentalAnalysisData>(`/api/analysis/${symbol}/fundamentals`),
    ])
      .then(([t, f]) => {
        setTech(t);
        setFund(f);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol, timeframe]);

  const liveStock = stocks.find((s) => s.symbol === symbol);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Technical &amp; Fundamental Research Workbench
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Server-side SMA, EMA, RSI, MACD, Bollinger Bands, and ratio-driven valuation scoring
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="px-3.5 py-2 text-xs font-semibold bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
          >
            {stocks.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} — {s.name} ({formatINR(s.ltp)})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => openOrderDrawer(symbol, 'BUY', 'MARKET')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer whitespace-nowrap"
          >
            Trade {symbol}
          </button>
        </div>
      </div>

      {/* Candlestick + Indicators */}
      <CandlestickChart
        data={tech}
        loading={loading}
        theme={theme}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        liveLtp={liveStock?.ltp}
        height={370}
      />

      {/* Side-by-Side Technical Summary & Fundamental Scorecard */}
      {tech && fund && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Technical Oscillator Summary
              </h2>
              <span
                className={`text-xs font-bold ${
                  tech.summary.signal === 'Bullish'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : tech.summary.signal === 'Bearish'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-500'
                }`}
              >
                {tech.summary.signal}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {tech.summary.commentary}
            </p>

            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-mono-num">
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">RSI (14-Period)</span>
                <span className="font-semibold text-slate-900 dark:text-white">{tech.summary.rsiValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">MACD Histogram</span>
                <span
                  className={
                    tech.summary.macdHistogram >= 0
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-rose-600 dark:text-rose-400 font-semibold'
                  }
                >
                  {tech.summary.macdHistogram >= 0 ? '+' : ''}
                  {tech.summary.macdHistogram}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">20-Bar Support / Resistance</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {formatINR(tech.summary.supportLevel)} / {formatINR(tech.summary.resistanceLevel)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-500">52-Week Range</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {formatINR(fund.low52w)} – {formatINR(fund.high52w)}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Fundamental Ratio Verdict · {fund.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{fund.sector}</p>
              </div>
              <div className="text-right">
                <span
                  className={`text-sm font-bold ${
                    fund.rating === 'Strong'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : fund.rating === 'Weak'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-500'
                  }`}
                >
                  {fund.rating} ({fund.fundamentalScore}/100)
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {fund.analystSummary}
            </p>

            {/* 4 Fundamental Pillars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                { label: 'Valuation', score: fund.pillars.valuationScore, max: 25 },
                { label: 'Profitability', score: fund.pillars.profitabilityScore, max: 30 },
                { label: 'Balance Sheet', score: fund.pillars.balanceSheetScore, max: 25 },
                { label: 'Growth', score: fund.pillars.growthScore, max: 20 },
              ].map((p) => (
                <div
                  key={p.label}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800"
                >
                  <div className="text-[11px] text-slate-500">{p.label}</div>
                  <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-white mt-0.5">
                    {p.score} / {p.max}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <div className="text-slate-500">P/E</div>
                <div className="font-mono-num font-semibold mt-0.5">{fund.metrics.peRatio}x</div>
              </div>
              <div>
                <div className="text-slate-500">P/B</div>
                <div className="font-mono-num font-semibold mt-0.5">{fund.metrics.pbRatio}x</div>
              </div>
              <div>
                <div className="text-slate-500">EPS</div>
                <div className="font-mono-num font-semibold mt-0.5">₹{fund.metrics.eps}</div>
              </div>
              <div>
                <div className="text-slate-500">ROE</div>
                <div className="font-mono-num font-semibold mt-0.5">{fund.metrics.roe}%</div>
              </div>
              <div>
                <div className="text-slate-500">D/E</div>
                <div className="font-mono-num font-semibold mt-0.5">{fund.metrics.debtToEquity}x</div>
              </div>
              <div>
                <div className="text-slate-500">Div Yield</div>
                <div className="font-mono-num font-semibold mt-0.5">{fund.metrics.dividendYield}%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
