import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { apiFetch, formatINR } from '../services/api';
import type { RiskSummary } from '../types';

export const RiskView: React.FC = () => {
  const { portfolio, refreshPortfolioAll, pushToast, navigate } = usePortfolio();
  const [risk, setRisk] = useState<RiskSummary | null>(null);
  const [edits, setEdits] = useState<Record<string, { sl: string; tp: string }>>({});
  const [savingSym, setSavingSym] = useState<string | null>(null);

  const loadRisk = useCallback(async () => {
    try {
      const data = await apiFetch<RiskSummary>('/api/risk/summary');
      setRisk(data);
      const nextEdits: Record<string, { sl: string; tp: string }> = {};
      for (const p of data.positions) {
        nextEdits[p.symbol] = {
          sl: p.stopLossPrice ? String(p.stopLossPrice) : '',
          tp: p.targetPrice ? String(p.targetPrice) : '',
        };
      }
      setEdits(nextEdits);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadRisk();
  }, [loadRisk, portfolio?.holdingsCount]);

  const handleSavePositionRisk = async (symbol: string) => {
    const row = edits[symbol];
    if (!row) return;
    setSavingSym(symbol);
    try {
      await apiFetch(`/api/portfolio/holdings/${symbol}/risk`, {
        method: 'PUT',
        body: JSON.stringify({
          stopLossPrice: row.sl ? Number(row.sl) : null,
          targetPrice: row.tp ? Number(row.tp) : null,
        }),
      });
      await Promise.all([loadRisk(), refreshPortfolioAll()]);
      pushToast({
        title: `Updated Triggers — ${symbol}`,
        message: 'Auto Stop-Loss & Target updated.',
        variant: 'success',
      });
    } catch (err: unknown) {
      pushToast({
        title: 'Invalid trigger price',
        message: err instanceof Error ? err.message : 'Check price inputs.',
        variant: 'error',
      });
    } finally {
      setSavingSym(null);
    }
  };

  if (!risk) {
    return <div className="p-10 text-center text-xs text-slate-500">Computing portfolio risk model...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Portfolio Risk &amp; Guardrails</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Parametric 95% Value-at-Risk (VaR), beta sensitivity, concentration diagnostics, and automated Stop-Loss / Target triggers
        </p>
      </div>

      {/* Top Quantitative Risk KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Composite Risk Score</div>
          <div className="text-2xl font-bold font-mono-num text-slate-900 dark:text-white mt-1">
            {risk.riskScore} <span className="text-xs font-normal text-slate-500">/ 100</span>
          </div>
          <div
            className={`text-xs font-semibold mt-0.5 ${
              risk.riskScore < 45
                ? 'text-emerald-600 dark:text-emerald-400'
                : risk.riskScore < 72
                  ? 'text-amber-500'
                  : 'text-rose-500'
            }`}
          >
            {risk.riskLabel} Profile
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">1-Day VaR (95% Conf.)</div>
          <div className="text-xl font-bold font-mono-num text-rose-600 dark:text-rose-400 mt-1">
            {formatINR(risk.dailyVar95, 0)}
          </div>
          <div className="text-xs font-mono-num text-slate-500 mt-0.5">
            {risk.dailyVar95Pct.toFixed(2)}% of equity value
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Portfolio Beta &amp; Vol</div>
          <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-white mt-1">
            {risk.weightedBeta.toFixed(2)}β
          </div>
          <div className="text-xs font-mono-num text-slate-500 mt-0.5">
            {risk.annualizedVolatilityPct.toFixed(1)}% annualized vol
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Est. 60D Max Drawdown</div>
          <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-white mt-1">
            -{risk.estimatedMaxDrawdownPct.toFixed(2)}%
          </div>
          <div className="text-xs font-mono-num text-slate-500 mt-0.5">
            HHI Index: {risk.hhiConcentration}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Stop-Loss Coverage</div>
          <div
            className={`text-xl font-bold font-mono-num mt-1 ${
              risk.stopLossCoveragePct >= 80
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-500'
            }`}
          >
            {risk.stopLossCoveragePct.toFixed(0)}%
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Max pos: {risk.maxPositionWeightPct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Plain-Language Risk Alerts */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Plain-Language Risk Diagnostics</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {risk.alerts.map((al, i) => (
            <div
              key={i}
              className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-start gap-3"
            >
              {al.severity === 'HIGH' ? (
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              ) : al.severity === 'MEDIUM' ? (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              ) : al.severity === 'LOW' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">{al.title}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{al.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Position-by-Position Stop-Loss & Target Trigger Matrix */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Automated Stop-Loss &amp; Target Manager
          </h2>
          <span className="text-xs text-slate-500">Auto-executes Market Sell when live NSE price hits trigger</span>
        </div>

        {risk.positions.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">No active positions to monitor.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="py-3 px-4">Position</th>
                  <th className="py-3 px-3 text-right">Weight</th>
                  <th className="py-3 px-3 text-right">Beta</th>
                  <th className="py-3 px-3 text-right">Live LTP</th>
                  <th className="py-3 px-3 text-right">Stop-Loss (₹)</th>
                  <th className="py-3 px-3 text-right">Target (₹)</th>
                  <th className="py-3 px-4 text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {risk.positions.map((p) => {
                  const edit = edits[p.symbol] || { sl: '', tp: '' };
                  return (
                    <tr key={p.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => navigate('stock', p.symbol)}
                          className="font-semibold text-sm text-slate-900 dark:text-white hover:underline cursor-pointer"
                        >
                          {p.symbol}
                        </button>
                        <div className="text-[11px] text-slate-500">
                          {p.quantity} qty · {p.sector}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num">
                        <span className={p.oversizedWarning ? 'text-rose-500 font-bold' : 'font-semibold'}>
                          {p.weightPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-500">
                        {p.beta.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-white">
                        {formatINR(p.ltp)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <input
                          type="number"
                          step="0.5"
                          placeholder="None"
                          value={edit.sl}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [p.symbol]: { ...edit, sl: e.target.value },
                            }))
                          }
                          className="w-28 px-2.5 py-1.5 text-right font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <input
                          type="number"
                          step="0.5"
                          placeholder="None"
                          value={edit.tp}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [p.symbol]: { ...edit, tp: e.target.value },
                            }))
                          }
                          className="w-28 px-2.5 py-1.5 text-right font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={savingSym === p.symbol}
                          onClick={() => handleSavePositionRisk(p.symbol)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                        >
                          {savingSym === p.symbol ? 'Saving...' : 'Update'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
