import React, { useMemo, useState, useEffect } from 'react';
import { Search, Download, ArrowUpDown } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { downloadCsv, formatINR } from '../services/api';
import { Sparkline } from '../components/Sparkline';

type SortKey = 'symbol' | 'ltp' | 'changePct' | 'volume' | 'marketCapCr' | 'peRatio' | 'roe';

export const MarketsView: React.FC = () => {
  const { stocks, tickFlash, navigate, openOrderDrawer } = usePortfolio();
  const [rawSearch, setRawSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sector, setSector] = useState('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('marketCapCr');
  const [sortAsc, setSortAsc] = useState(false);

  // Debounce search input (180ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(rawSearch.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [rawSearch]);

  const sectors = useMemo(
    () => ['ALL', ...Array.from(new Set(stocks.map((s) => s.sector)))],
    [stocks]
  );

  const filtered = useMemo(() => {
    return stocks
      .filter((s) => {
        if (sector !== 'ALL' && s.sector !== sector) return false;
        if (
          debouncedSearch &&
          !s.symbol.toLowerCase().includes(debouncedSearch) &&
          !s.name.toLowerCase().includes(debouncedSearch) &&
          !s.sector.toLowerCase().includes(debouncedSearch)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        if (typeof va === 'string' && typeof vb === 'string') {
          return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
      });
  }, [stocks, sector, debouncedSearch, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === 'symbol');
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      'nse_markets_snapshot.csv',
      ['Symbol', 'Company', 'Sector', 'LTP (INR)', 'Change %', 'Volume', 'Market Cap (Cr)', 'P/E', 'ROE %'],
      filtered.map((s) => [
        s.symbol,
        s.name,
        s.sector,
        s.ltp,
        s.changePct,
        s.volume,
        s.marketCapCr,
        s.peRatio,
        s.roe,
      ])
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">NSE Equities Market</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {stocks.length} stocks streaming real-time simulated ticks · Click any row for charts &amp; fundamentals
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="Filter symbol or company..."
              className="pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white w-56 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Sector Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {sectors.map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => setSector(sec)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              sector === sec
                ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {sec === 'ALL' ? 'All Sectors' : sec}
          </button>
        ))}
      </div>

      {/* High-Density Sortable Market Table */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('symbol')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Instrument <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('ltp')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    LTP <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('changePct')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Day Chg <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 hidden md:table-cell text-center">Intraday</th>
                <th className="py-3 px-3 text-right hidden lg:table-cell">
                  <button
                    type="button"
                    onClick={() => handleSort('volume')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Volume <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right hidden sm:table-cell">
                  <button
                    type="button"
                    onClick={() => handleSort('marketCapCr')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Mkt Cap <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right hidden xl:table-cell">
                  <button
                    type="button"
                    onClick={() => handleSort('peRatio')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    P/E <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right hidden xl:table-cell">
                  <button
                    type="button"
                    onClick={() => handleSort('roe')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    ROE <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No NSE stocks matched "{rawSearch}".
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const flash = tickFlash[s.symbol];
                  const up = s.changePct >= 0;
                  return (
                    <tr
                      key={s.symbol}
                      onClick={() => navigate('stock', s.symbol)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                        flash === 'UP' ? 'tick-flash-up' : flash === 'DOWN' ? 'tick-flash-down' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-sm text-slate-900 dark:text-white">{s.symbol}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {s.name} · {s.sector}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-sm text-slate-900 dark:text-white">
                        {formatINR(s.ltp)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono-num font-semibold ${
                          up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {up ? '▲ +' : '▼ '}
                        {s.changePct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 hidden md:table-cell">
                        <div className="flex justify-center">
                          <Sparkline data={s.sparkline} positive={up} width={84} height={24} />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-600 dark:text-slate-400 hidden lg:table-cell">
                        {s.volume.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-700 dark:text-slate-300 hidden sm:table-cell">
                        ₹{(s.marketCapCr / 1000).toFixed(1)}k Cr
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-600 dark:text-slate-400 hidden xl:table-cell">
                        {s.peRatio.toFixed(1)}x
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-600 dark:text-slate-400 hidden xl:table-cell">
                        {s.roe.toFixed(1)}%
                      </td>
                      <td
                        className="py-2.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openOrderDrawer(s.symbol, 'BUY', 'MARKET')}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                          >
                            B
                          </button>
                          <button
                            type="button"
                            onClick={() => openOrderDrawer(s.symbol, 'SELL', 'MARKET')}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                          >
                            S
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
