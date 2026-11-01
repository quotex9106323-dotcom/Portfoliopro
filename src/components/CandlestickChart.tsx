import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import type { UTCTimestamp, IChartApi } from 'lightweight-charts';
import type { TechnicalAnalysisData, TimeframeKey } from '../types';

interface CandlestickChartProps {
  data: TechnicalAnalysisData | null;
  loading?: boolean;
  theme: 'light' | 'dark';
  timeframe: TimeframeKey;
  onTimeframeChange: (tf: TimeframeKey) => void;
  liveLtp?: number;
  height?: number;
}

const TIMEFRAMES: TimeframeKey[] = ['1D', '1W', '1M', '1Y', '5Y'];

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  loading = false,
  theme,
  timeframe,
  onTimeframeChange,
  liveLtp,
  height = 380,
}) => {
  const mainRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const macdRef = useRef<HTMLDivElement | null>(null);

  const mainChartApi = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleSeriesRef = useRef<any>(null);

  const [showSma, setShowSma] = useState(true);
  const [showEma, setShowEma] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);

  const [hoverBar, setHoverBar] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  } | null>(null);

  // Render main candlestick + overlays + volume
  useEffect(() => {
    if (!mainRef.current || !data || data.candles.length === 0) return;

    const isDark = theme === 'dark';
    const bg = isDark ? '#111827' : '#ffffff';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.07)' : 'rgba(15, 23, 42, 0.05)';
    const borderColor = isDark ? '#1e293b' : '#e2e8f0';

    const chart = createChart(mainRef.current, {
      width: mainRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor,
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.08 },
      },
      timeScale: {
        borderColor,
        timeVisible: timeframe === '1D' || timeframe === '1W',
        secondsVisible: false,
      },
    });

    mainChartApi.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    const sortedCandles = [...data.candles]
      .sort((a, b) => a.time - b.time)
      .filter((c, i, arr) => i === 0 || c.time > arr[i - 1].time);

    candleSeries.setData(
      sortedCandles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    candleSeriesRef.current = candleSeries;

    if (showVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });
      volSeries.setData(
        sortedCandles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.28)' : 'rgba(244, 63, 94, 0.28)',
        }))
      );
    }

    if (showSma) {
      if (data.sma20.length > 0) {
        const sma20Series = chart.addSeries(LineSeries, {
          color: '#3b82f6',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        sma20Series.setData(
          data.sma20.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
        );
      }
      if (data.sma50.length > 0) {
        const sma50Series = chart.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        sma50Series.setData(
          data.sma50.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
        );
      }
    }

    if (showEma) {
      if (data.ema12.length > 0) {
        const ema12Series = chart.addSeries(LineSeries, {
          color: '#06b6d4',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        ema12Series.setData(
          data.ema12.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
        );
      }
      if (data.ema26.length > 0) {
        const ema26Series = chart.addSeries(LineSeries, {
          color: '#a855f7',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        ema26Series.setData(
          data.ema26.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
        );
      }
    }

    if (showBollinger && data.bollinger.length > 0) {
      const upper = chart.addSeries(LineSeries, {
        color: 'rgba(99, 102, 241, 0.7)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const lower = chart.addSeries(LineSeries, {
        color: 'rgba(99, 102, 241, 0.7)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      upper.setData(data.bollinger.map((b) => ({ time: b.time as UTCTimestamp, value: b.upper })));
      lower.setData(data.bollinger.map((b) => ({ time: b.time as UTCTimestamp, value: b.lower })));
    }

    const volLookup = new Map(sortedCandles.map((c) => [c.time, c.volume]));
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHoverBar(null);
        return;
      }
      const d = param.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (d) {
        setHoverBar({
          ...d,
          volume: volLookup.get(Number(param.time)),
        });
      }
    });

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      if (entries[0] && mainRef.current) {
        chart.applyOptions({ width: mainRef.current.clientWidth });
      }
    });
    ro.observe(mainRef.current);

    return () => {
      ro.disconnect();
      candleSeriesRef.current = null;
      mainChartApi.current = null;
      chart.remove();
    };
  }, [data, theme, timeframe, height, showSma, showEma, showBollinger, showVolume]);

  // Live tick updates on the latest candle bar
  useEffect(() => {
    if (!liveLtp || !candleSeriesRef.current || !data || data.candles.length === 0) return;
    const last = data.candles[data.candles.length - 1];
    try {
      candleSeriesRef.current.update({
        time: last.time as UTCTimestamp,
        open: last.open,
        high: Math.max(last.high, liveLtp),
        low: Math.min(last.low, liveLtp),
        close: liveLtp,
      });
    } catch {
      // Safe guard during timeframe switch
    }
  }, [liveLtp, data]);

  // Render RSI(14) sub-chart
  useEffect(() => {
    if (!showRsi || !rsiRef.current || !data || data.rsi14.length === 0) return;
    const isDark = theme === 'dark';
    const chart = createChart(rsiRef.current, {
      width: rsiRef.current.clientWidth,
      height: 115,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#111827' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.04)' },
        horzLines: { color: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.04)' },
      },
      rightPriceScale: { borderColor: isDark ? '#1e293b' : '#e2e8f0' },
      timeScale: { visible: false },
    });

    const rsiLine = chart.addSeries(LineSeries, {
      color: '#14b8a6',
      lineWidth: 2,
      priceLineVisible: false,
    });
    rsiLine.setData(data.rsi14.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (rsiRef.current) chart.applyOptions({ width: rsiRef.current.clientWidth });
    });
    ro.observe(rsiRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [showRsi, data, theme]);

  // Render MACD(12,26,9) sub-chart
  useEffect(() => {
    if (!showMacd || !macdRef.current || !data || data.macd.length === 0) return;
    const isDark = theme === 'dark';
    const chart = createChart(macdRef.current, {
      width: macdRef.current.clientWidth,
      height: 125,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#111827' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.04)' },
        horzLines: { color: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.04)' },
      },
      rightPriceScale: { borderColor: isDark ? '#1e293b' : '#e2e8f0' },
      timeScale: { visible: false },
    });

    const hist = chart.addSeries(HistogramSeries, { priceLineVisible: false });
    hist.setData(
      data.macd.map((m) => ({
        time: m.time as UTCTimestamp,
        value: m.histogram,
        color: m.histogram >= 0 ? 'rgba(16, 185, 129, 0.55)' : 'rgba(244, 63, 94, 0.55)',
      }))
    );

    const macdLine = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    macdLine.setData(data.macd.map((m) => ({ time: m.time as UTCTimestamp, value: m.macd })));

    const sigLine = chart.addSeries(LineSeries, {
      color: '#f97316',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    sigLine.setData(data.macd.map((m) => ({ time: m.time as UTCTimestamp, value: m.signal })));

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (macdRef.current) chart.applyOptions({ width: macdRef.current.clientWidth });
    });
    ro.observe(macdRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [showMacd, data, theme]);

  const activeBar =
    hoverBar ||
    (data?.candles.length ? data.candles[data.candles.length - 1] : null);

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Toolbar: Timeframe + Indicator Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                timeframe === tf
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { label: 'SMA 20/50', active: showSma, toggle: () => setShowSma((v) => !v), dot: '#3b82f6' },
            { label: 'EMA 12/26', active: showEma, toggle: () => setShowEma((v) => !v), dot: '#06b6d4' },
            { label: 'Bollinger', active: showBollinger, toggle: () => setShowBollinger((v) => !v), dot: '#6366f1' },
            { label: 'Volume', active: showVolume, toggle: () => setShowVolume((v) => !v), dot: '#10b981' },
            { label: 'RSI (14)', active: showRsi, toggle: () => setShowRsi((v) => !v), dot: '#14b8a6' },
            { label: 'MACD', active: showMacd, toggle: () => setShowMacd((v) => !v), dot: '#f97316' },
          ].map((ind) => (
            <button
              key={ind.label}
              type="button"
              onClick={ind.toggle}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                ind.active
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {ind.label}
            </button>
          ))}
        </div>
      </div>

      {/* OHLCV Live Legend Strip */}
      {activeBar && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-2 text-xs font-mono-num text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/60">
          <span>
            O <strong className="text-slate-800 dark:text-slate-200">{activeBar.open.toFixed(2)}</strong>
          </span>
          <span>
            H <strong className="text-emerald-600 dark:text-emerald-400">{activeBar.high.toFixed(2)}</strong>
          </span>
          <span>
            L <strong className="text-rose-600 dark:text-rose-400">{activeBar.low.toFixed(2)}</strong>
          </span>
          <span>
            C <strong className="text-slate-800 dark:text-slate-200">{activeBar.close.toFixed(2)}</strong>
          </span>
          {activeBar.volume !== undefined && (
            <span>
              Vol <strong className="text-slate-700 dark:text-slate-300">{activeBar.volume.toLocaleString('en-IN')}</strong>
            </span>
          )}
          {showSma && (
            <span className="text-blue-500">SMA20 · <span className="text-amber-500">SMA50</span></span>
          )}
          {showEma && (
            <span className="text-cyan-500">EMA12 · <span className="text-purple-400">EMA26</span></span>
          )}
        </div>
      )}

      {/* Main Chart Viewport */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/70 dark:bg-[#111827]/70 backdrop-blur-[1px] flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        )}
        <div ref={mainRef} className="w-full" style={{ minHeight: height }} />
      </div>

      {/* RSI Sub-pane */}
      {showRsi && (
        <div className="border-t border-slate-200 dark:border-slate-800">
          <div className="px-4 py-1 text-[11px] font-mono-num text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>RSI (14) — Momentum Oscillator (70 Overbought · 30 Oversold)</span>
            {data?.summary && <span className="text-teal-500 font-semibold">{data.summary.rsiValue}</span>}
          </div>
          <div ref={rsiRef} className="w-full" />
        </div>
      )}

      {/* MACD Sub-pane */}
      {showMacd && (
        <div className="border-t border-slate-200 dark:border-slate-800">
          <div className="px-4 py-1 text-[11px] font-mono-num text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>MACD (12, 26, 9) — Blue: MACD · Orange: Signal · Bars: Histogram</span>
            {data?.summary && (
              <span className={data.summary.macdHistogram >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                Hist {data.summary.macdHistogram >= 0 ? '+' : ''}
                {data.summary.macdHistogram}
              </span>
            )}
          </div>
          <div ref={macdRef} className="w-full" />
        </div>
      )}
    </div>
  );
};
