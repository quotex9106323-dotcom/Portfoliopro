import React, { useState } from 'react';
import { Sun, Moon, ArrowRight, AlertCircle } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatINR } from '../services/api';

export const AuthScreen: React.FC = () => {
  const { login, register, theme, toggleTheme, stocks } = usePortfolio();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('demo@portfoliopro.in');
  const [password, setPassword] = useState('Demo@1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(fullName, email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoQuickSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await login('demo@portfoliopro.in', 'Demo@1234');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  const previewStocks = stocks.slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111827]">
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
          PortfolioPro
        </span>

        <div className="hidden md:flex items-center gap-6 text-xs font-mono-num text-slate-600 dark:text-slate-400 overflow-hidden">
          {previewStocks.map((s) => (
            <span key={s.symbol} className="whitespace-nowrap shrink-0">
              <strong className="text-slate-900 dark:text-slate-200">{s.symbol}</strong>{' '}
              {formatINR(s.ltp)}{' '}
              <span className={s.changePct >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                {s.changePct >= 0 ? '+' : ''}
                {s.changePct.toFixed(2)}%
              </span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            NSE Equities · Real-Time Execution · Portfolio Analytics
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Institutional-grade stock trading and risk analytics.
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
            Trade 30 live-streaming NSE equities with Market and Limit execution, server-computed technical
            indicators, fundamental sector ratios, XIRR tracking, and automated Stop-Loss &amp; Target risk controls.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
              <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-white">₹10,00,000</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Instant virtual capital on every new account
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
              <div className="text-xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400">30 NSE</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Live WebSocket price ticks &amp; 5Y OHLCV charts
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
              <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-white">Auto SL / TP</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Parametric VaR, drawdown &amp; limit fills
              </div>
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setEmail('');
                  setPassword('');
                  setError('');
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    placeholder="Manish Singh"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {mode === 'register'
                    ? 'Includes ₹10,00,000.00 default virtual wallet balance.'
                    : 'Demo login: demo@portfoliopro.in / Demo@1234'}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>{loading ? 'Please wait...' : mode === 'login' ? 'Sign In to Terminal' : 'Open Trading Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={loading}
                onClick={handleDemoQuickSignIn}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Instant Demo Login (demo@portfoliopro.in · Pre-seeded Portfolio)
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
