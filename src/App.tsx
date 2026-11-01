/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  ListOrdered,
  Star,
  Activity,
  ShieldAlert,
  Wallet,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  FileText,
  Undo2,
  X,
} from 'lucide-react';
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext';
import { AuthScreen } from './components/AuthScreen';
import { CommandPalette } from './components/CommandPalette';
import { OrderDrawer } from './components/OrderDrawer';
import { DashboardView } from './views/DashboardView';
import { MarketsView } from './views/MarketsView';
import { StockDetailView } from './views/StockDetailView';
import { PortfolioView } from './views/PortfolioView';
import { OrdersView } from './views/OrdersView';
import { WatchlistView } from './views/WatchlistView';
import { AnalysisView } from './views/AnalysisView';
import { RiskView } from './views/RiskView';
import { WalletView } from './views/WalletView';
import { apiFetch } from './services/api';
import {
  ProjectDownloadModal,
  triggerZipBlobDownload,
} from './components/ProjectDownloadModal';
import type { PageRoute } from './types';

const SIDEBAR_ITEMS: Array<{ route: PageRoute; label: string; icon: React.ReactNode }> = [
  { route: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
  { route: 'markets', label: 'Markets', icon: <TrendingUp className="w-4 h-4 shrink-0" /> },
  { route: 'portfolio', label: 'Portfolio', icon: <Briefcase className="w-4 h-4 shrink-0" /> },
  { route: 'orders', label: 'Orders', icon: <ListOrdered className="w-4 h-4 shrink-0" /> },
  { route: 'watchlist', label: 'Watchlist', icon: <Star className="w-4 h-4 shrink-0" /> },
  { route: 'analysis', label: 'Analysis', icon: <Activity className="w-4 h-4 shrink-0" /> },
  { route: 'risk', label: 'Risk', icon: <ShieldAlert className="w-4 h-4 shrink-0" /> },
  { route: 'wallet', label: 'Wallet', icon: <Wallet className="w-4 h-4 shrink-0" /> },
];

function WorkspaceShell() {
  const {
    user,
    authLoading,
    theme,
    toggleTheme,
    route,
    navigate,
    wsConnected,
    notifications,
    unreadCount,
    markNotificationsRead,
    logout,
    setCommandOpen,
    toasts,
    dismissToast,
    refreshPortfolioAll,
    pushToast,
  } = usePortfolio();

  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [zipModalOpen, setZipModalOpen] = useState(false);

  const openPdfDownload = () => {
    setZipModalOpen(true);
  };

  const openZipDownload = () => {
    void triggerZipBlobDownload();
    setZipModalOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleUndoLimitOrder = async (orderId: string, toastId: string) => {
    dismissToast(toastId);
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      await refreshPortfolioAll();
      pushToast({
        title: 'Limit Order Undone',
        message: 'Pending limit order cancelled and margin restored.',
        variant: 'info',
      });
    } catch {
      // Already executed or cancelled
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex">
      {/* Collapsible Desktop Left Sidebar */}
      <aside
        className={`hidden md:flex flex-col justify-between bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 h-screen transition-all duration-150 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div>
          <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            {!collapsed && (
              <button
                type="button"
                onClick={() => navigate('dashboard')}
                className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap cursor-pointer"
              >
                PortfolioPro
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer mx-auto md:mx-0"
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          <nav className="p-2.5 space-y-1" aria-label="Main Navigation">
            {SIDEBAR_ITEMS.map((item) => {
              const active = route === item.route || (route === 'stock' && item.route === 'markets');
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => navigate(item.route)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-emerald-600/12 text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
          <button
            type="button"
            onClick={openPdfDownload}
            title="Download HCLTech Synopsis & Code Output PDFs"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>Submission PDFs</span>}
          </button>
          <button
            type="button"
            onClick={openZipDownload}
            title="Download Complete Spring Boot + Angular Project ZIP"
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>Download ZIP</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="md:hidden text-base font-bold text-slate-900 dark:text-white">
              PortfolioPro
            </span>
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex items-center justify-between gap-4 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg w-52 sm:w-80 cursor-pointer"
            >
              <span className="inline-flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Search stocks or pages...</span>
              </span>
              <kbd className="hidden sm:inline-block font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openPdfDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Submission PDFs</span>
            </button>
            <button
              type="button"
              onClick={openZipDownload}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Download ZIP</span>
            </button>

            {/* Real WebSocket Live Feed Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mr-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>{wsConnected ? 'NSE Live' : 'Reconnecting'}</span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  setProfileOpen(false);
                  if (next && unreadCount > 0) markNotificationsRead();
                }}
                aria-label="Notifications"
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Activity &amp; Alerts
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">No notifications yet.</div>
                    ) : (
                      notifications.slice(0, 12).map((n) => (
                        <div key={n.id} className="px-4 py-3 text-xs">
                          <div className="font-semibold text-slate-900 dark:text-white">{n.title}</div>
                          <p className="text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline max-w-28 truncate">{user.fullName}</span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-40 text-xs">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {user.fullName}
                    </div>
                    <div className="text-slate-500 truncate">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      openPdfDownload();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> Download Submission PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      openZipDownload();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PortfolioPro.zip
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Active Route Viewport */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
          {route === 'dashboard' && <DashboardView />}
          {route === 'markets' && <MarketsView />}
          {route === 'stock' && <StockDetailView />}
          {route === 'portfolio' && <PortfolioView />}
          {route === 'orders' && <OrdersView />}
          {route === 'watchlist' && <WatchlistView />}
          {route === 'analysis' && <AnalysisView />}
          {route === 'risk' && <RiskView />}
          {route === 'wallet' && <WalletView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white dark:bg-[#111827] border-t border-slate-200 dark:border-slate-800 grid grid-cols-5"
      >
        {[
          SIDEBAR_ITEMS[0],
          SIDEBAR_ITEMS[1],
          SIDEBAR_ITEMS[2],
          SIDEBAR_ITEMS[3],
          SIDEBAR_ITEMS[4],
        ].map((item) => {
          const active = route === item.route;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => navigate(item.route)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
                active
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Global Overlays */}
      <CommandPalette />
      <OrderDrawer />
      <ProjectDownloadModal open={zipModalOpen} onClose={() => setZipModalOpen(false)} />

      {/* Toast Stack with Undo Window for Pending Limit Orders */}
      <div className="fixed bottom-16 md:bottom-5 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3.5 flex items-start justify-between gap-3 text-xs"
          >
            <div>
              <div
                className={`font-semibold ${
                  t.variant === 'success'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : t.variant === 'error'
                      ? 'text-rose-600 dark:text-rose-400'
                      : t.variant === 'warning'
                        ? 'text-amber-500'
                        : 'text-slate-900 dark:text-white'
                }`}
              >
                {t.title}
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">{t.message}</p>
              {t.undoOrderId && (
                <button
                  type="button"
                  onClick={() => handleUndoLimitOrder(t.undoOrderId!, t.id)}
                  className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold hover:bg-amber-500/25 cursor-pointer"
                >
                  <Undo2 className="w-3 h-3" /> Undo Limit Order
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <PortfolioProvider>
      <WorkspaceShell />
    </PortfolioProvider>
  );
}
