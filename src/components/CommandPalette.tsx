import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowRight, TrendingUp, LayoutDashboard, Briefcase, ListOrdered, Star, Activity, ShieldAlert, Wallet } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatINR } from '../services/api';
import type { PageRoute } from '../types';

const NAV_COMMANDS: Array<{ label: string; route: PageRoute; hint: string; icon: React.ReactNode }> = [
  { label: 'Go to Dashboard', route: 'dashboard', hint: 'Overview & indices', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Go to Markets', route: 'markets', hint: 'All 30 NSE stocks', icon: <TrendingUp className="w-4 h-4" /> },
  { label: 'Go to Portfolio', route: 'portfolio', hint: 'Holdings & XIRR', icon: <Briefcase className="w-4 h-4" /> },
  { label: 'Go to Orders', route: 'orders', hint: 'Order book & history', icon: <ListOrdered className="w-4 h-4" /> },
  { label: 'Go to Watchlist', route: 'watchlist', hint: 'Lists & price alerts', icon: <Star className="w-4 h-4" /> },
  { label: 'Go to Analysis', route: 'analysis', hint: 'Technicals & fundamentals', icon: <Activity className="w-4 h-4" /> },
  { label: 'Go to Risk Engine', route: 'risk', hint: 'VaR, beta & stop-loss', icon: <ShieldAlert className="w-4 h-4" /> },
  { label: 'Go to Wallet', route: 'wallet', hint: 'Funds & ledger', icon: <Wallet className="w-4 h-4" /> },
];

export const CommandPalette: React.FC = () => {
  const { commandOpen, setCommandOpen, stocks, navigate, openOrderDrawer } = usePortfolio();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (commandOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [commandOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchedStocks = stocks
      .filter(
        (s) =>
          !q ||
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((s) => ({
        kind: 'stock' as const,
        id: `stock_${s.symbol}`,
        symbol: s.symbol,
        title: s.symbol,
        subtitle: `${s.name} · ${s.sector}`,
        ltp: s.ltp,
        changePct: s.changePct,
      }));

    const matchedNav = NAV_COMMANDS.filter(
      (n) => !q || n.label.toLowerCase().includes(q) || n.hint.toLowerCase().includes(q)
    ).map((n) => ({
      kind: 'nav' as const,
      id: `nav_${n.route}`,
      route: n.route,
      title: n.label,
      subtitle: n.hint,
      icon: n.icon,
    }));

    return q ? [...matchedStocks, ...matchedNav] : [...matchedNav.slice(0, 4), ...matchedStocks.slice(0, 6)];
  }, [query, stocks]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!commandOpen) return null;

  const executeItem = (item: (typeof results)[number]) => {
    setCommandOpen(false);
    if (item.kind === 'stock') {
      navigate('stock', item.symbol);
    } else {
      navigate(item.route);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center pt-[12vh] px-4"
      onClick={() => setCommandOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette"
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setCommandOpen(false);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(results.length - 1, i + 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
          }
          if (e.key === 'Enter' && results[activeIndex]) {
            e.preventDefault();
            executeItem(results[activeIndex]);
          }
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search NSE stocks (RELIANCE, TCS, HDFCBANK...) or jump to page..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setCommandOpen(false)}
            className="text-xs font-mono-num text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 rounded cursor-pointer"
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
          {results.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No matching stocks or pages found for "{query}".
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => executeItem(item)}
                  className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-slate-100 dark:bg-slate-800/80' : ''
                  }`}
                >
                  <div className="min-w-0 pr-3 flex items-center gap-3">
                    {item.kind === 'nav' ? (
                      <span className="text-slate-500 dark:text-slate-400">{item.icon}</span>
                    ) : (
                      <span className="text-xs font-mono-num font-semibold text-emerald-600 dark:text-emerald-400 w-4">
                        EQ
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  {item.kind === 'stock' ? (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono-num">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatINR(item.ltp)}
                        </div>
                        <div
                          className={`text-xs ${
                            item.changePct >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {item.changePct >= 0 ? '▲ +' : '▼ '}
                          {item.changePct.toFixed(2)}%
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCommandOpen(false);
                          openOrderDrawer(item.symbol, 'BUY', 'MARKET');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white whitespace-nowrap cursor-pointer"
                      >
                        Buy
                      </button>
                    </div>
                  ) : (
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
