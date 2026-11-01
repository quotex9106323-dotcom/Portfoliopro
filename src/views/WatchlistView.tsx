import React, { useEffect, useState } from 'react';
import { GripVertical, Plus, Trash2, Bell, ArrowUp, ArrowDown } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { apiFetch, formatINR } from '../services/api';
import { Sparkline } from '../components/Sparkline';

export const WatchlistView: React.FC = () => {
  const {
    watchlists,
    alerts,
    stocks,
    stocksMap,
    tickFlash,
    refreshPortfolioAll,
    navigate,
    openOrderDrawer,
    pushToast,
  } = usePortfolio();

  const [activeId, setActiveId] = useState<string>('');
  const [newListName, setNewListName] = useState<string>('');
  const [addSymbol, setAddSymbol] = useState<string>('BAJFINANCE');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [alertSymbol, setAlertSymbol] = useState<string>('RELIANCE');
  const [alertCond, setAlertCond] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [alertTarget, setAlertTarget] = useState<string>('');

  useEffect(() => {
    if (!activeId && watchlists.length > 0) {
      setActiveId(watchlists[0].id);
    } else if (activeId && !watchlists.some((w) => w.id === activeId) && watchlists[0]) {
      setActiveId(watchlists[0].id);
    }
  }, [watchlists, activeId]);

  const activeList = watchlists.find((w) => w.id === activeId) || watchlists[0];

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const created = await apiFetch<{ id: string }>('/api/watchlists', {
        method: 'POST',
        body: JSON.stringify({ name: newListName.trim() }),
      });
      setNewListName('');
      await refreshPortfolioAll();
      setActiveId(created.id);
      pushToast({ title: 'Watchlist Created', message: newListName.trim(), variant: 'success' });
    } catch (err: unknown) {
      pushToast({
        title: 'Cannot create watchlist',
        message: err instanceof Error ? err.message : 'Error creating list',
        variant: 'error',
      });
    }
  };

  const handleDeleteList = async (id: string) => {
    try {
      await apiFetch(`/api/watchlists/${id}`, { method: 'DELETE' });
      await refreshPortfolioAll();
      pushToast({ title: 'Watchlist Deleted', message: 'Removed watchlist.', variant: 'info' });
    } catch (err: unknown) {
      pushToast({
        title: 'Cannot delete list',
        message: err instanceof Error ? err.message : 'Keep at least one list.',
        variant: 'error',
      });
    }
  };

  const handleAddStock = async () => {
    if (!activeList || !addSymbol) return;
    try {
      await apiFetch(`/api/watchlists/${activeList.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ symbol: addSymbol }),
      });
      await refreshPortfolioAll();
      pushToast({
        title: 'Stock Added',
        message: `${addSymbol} added to ${activeList.name}.`,
        variant: 'success',
      });
    } catch {
      // Ignore
    }
  };

  const handleRemoveStock = async (symbol: string) => {
    if (!activeList) return;
    await apiFetch(`/api/watchlists/${activeList.id}/items/${symbol}`, { method: 'DELETE' });
    await refreshPortfolioAll();
  };

  const reorderSymbols = async (fromIdx: number, toIdx: number) => {
    if (!activeList || fromIdx === toIdx || toIdx < 0 || toIdx >= activeList.symbols.length) return;
    const next = [...activeList.symbols];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    await apiFetch(`/api/watchlists/${activeList.id}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ symbols: next }),
    });
    await refreshPortfolioAll();
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(alertTarget);
    if (!alertSymbol || !target || target <= 0) return;
    try {
      await apiFetch('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({ symbol: alertSymbol, condition: alertCond, targetPrice: target }),
      });
      setAlertTarget('');
      await refreshPortfolioAll();
      pushToast({
        title: `Price Alert Created — ${alertSymbol}`,
        message: `${alertCond === 'ABOVE' ? 'Above' : 'Below'} ${formatINR(target)}`,
        variant: 'success',
      });
    } catch {
      // Ignore
    }
  };

  const handleDeleteAlert = async (id: string) => {
    await apiFetch(`/api/alerts/${id}`, { method: 'DELETE' });
    await refreshPortfolioAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Watchlists &amp; Price Alerts</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organize multiple custom lists, drag rows to reorder priority, and set real-time price triggers
          </p>
        </div>

        <form onSubmit={handleCreateList} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="New watchlist name..."
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white w-48 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Create List
          </button>
        </form>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Watchlist Manager (Left 8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {watchlists.map((wl) => (
                <button
                  key={wl.id}
                  type="button"
                  onClick={() => setActiveId(wl.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeList?.id === wl.id
                      ? 'bg-slate-900 text-white dark:bg-emerald-600'
                      : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {wl.name} ({wl.symbols.length})
                </button>
              ))}
            </div>

            {activeList && (
              <div className="flex items-center gap-2">
                <select
                  value={addSymbol}
                  onChange={(e) => setAddSymbol(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                >
                  {stocks.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} — {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddStock}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                >
                  + Add Symbol
                </button>
                {watchlists.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteList(activeList.id)}
                    aria-label="Delete watchlist"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {!activeList || activeList.symbols.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No stocks in this watchlist yet. Select a symbol above to add.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {activeList.symbols.map((sym, idx) => {
                  const s = stocksMap[sym];
                  if (!s) return null;
                  const flash = tickFlash[sym];
                  const up = s.changePct >= 0;
                  return (
                    <div
                      key={sym}
                      draggable
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null) {
                          reorderSymbols(dragIndex, idx);
                          setDragIndex(null);
                        }
                      }}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        flash === 'UP' ? 'tick-flash-up' : flash === 'DOWN' ? 'tick-flash-down' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <span
                          className="text-slate-400 cursor-grab active:cursor-grabbing"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => reorderSymbols(idx, idx - 1)}
                            disabled={idx === 0}
                            aria-label="Move up"
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => reorderSymbols(idx, idx + 1)}
                            disabled={idx === activeList.symbols.length - 1}
                            aria-label="Move down"
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('stock', sym)}
                          className="text-left min-w-0 cursor-pointer"
                        >
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{s.symbol}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {s.name} · {s.sector}
                          </div>
                        </button>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="hidden sm:block">
                          <Sparkline data={s.sparkline} positive={up} width={76} height={24} />
                        </div>
                        <div className="text-right font-mono-num w-24">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatINR(s.ltp)}
                          </div>
                          <div
                            className={`text-xs ${
                              up
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {up ? '+' : ''}
                            {s.changePct.toFixed(2)}%
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openOrderDrawer(sym, 'BUY', 'MARKET')}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                          >
                            B
                          </button>
                          <button
                            type="button"
                            onClick={() => openOrderDrawer(sym, 'SELL', 'MARKET')}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-600 text-white hover:bg-rose-500 cursor-pointer"
                          >
                            S
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStock(sym)}
                            aria-label={`Remove ${sym}`}
                            className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Price Alerts Panel (Right 4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Live Price Alerts</h2>
          </div>

          <form onSubmit={handleCreateAlert} className="space-y-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Symbol</label>
              <select
                value={alertSymbol}
                onChange={(e) => {
                  const sym = e.target.value;
                  setAlertSymbol(sym);
                  const st = stocksMap[sym];
                  if (st) setAlertTarget((st.ltp * 1.02).toFixed(0));
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {stocks.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} ({formatINR(s.ltp)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Condition</label>
                <select
                  value={alertCond}
                  onChange={(e) => setAlertCond(e.target.value as 'ABOVE' | 'BELOW')}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="ABOVE">Crosses Above</option>
                  <option value="BELOW">Drops Below</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Target Price (₹)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  placeholder={stocksMap[alertSymbol]?.ltp.toFixed(0) || '1000'}
                  value={alertTarget}
                  onChange={(e) => setAlertTarget(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              Create Price Alert
            </button>
          </form>

          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No price alerts configured.</p>
            ) : (
              alerts.map((a) => {
                const cur = stocksMap[a.symbol]?.ltp ?? a.currentLtp;
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {a.symbol}{' '}
                        <span className="font-normal text-slate-500">
                          {a.condition === 'ABOVE' ? '≥' : '≤'} {formatINR(a.targetPrice)}
                        </span>
                      </div>
                      <div className="font-mono-num text-[11px] text-slate-500 mt-0.5">
                        LTP {formatINR(cur)} ·{' '}
                        <span className={a.triggered ? 'text-emerald-500 font-semibold' : 'text-amber-500'}>
                          {a.triggered ? 'Triggered' : 'Armed'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAlert(a.id)}
                      aria-label="Delete alert"
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
