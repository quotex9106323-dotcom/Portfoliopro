import React, { useEffect, useState } from 'react';
import { X, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { apiFetch, formatINR } from '../services/api';
import type { ChargeEstimate, OrderItem, OrderSide, OrderType } from '../types';

interface OrderTicketProps {
  symbol: string;
  initialSide?: OrderSide;
  initialType?: OrderType;
  embedded?: boolean;
  onSuccess?: () => void;
}

export const OrderTicketPanel: React.FC<OrderTicketProps> = ({
  symbol,
  initialSide = 'BUY',
  initialType = 'MARKET',
  embedded = false,
  onSuccess,
}) => {
  const { stocksMap, portfolio, refreshPortfolioAll, pushToast } = usePortfolio();
  const stock = stocksMap[symbol];

  const [side, setSide] = useState<OrderSide>(initialSide);
  const [orderType, setOrderType] = useState<OrderType>(initialType);
  const [quantity, setQuantity] = useState<string>('10');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const [showChargesDetail, setShowChargesDetail] = useState<boolean>(false);
  const [confirmStep, setConfirmStep] = useState<boolean>(false);
  const [estimate, setEstimate] = useState<ChargeEstimate | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [inlineError, setInlineError] = useState<string>('');

  useEffect(() => {
    setSide(initialSide);
    setOrderType(initialType);
    setConfirmStep(false);
    setInlineError('');
  }, [symbol, initialSide, initialType]);

  useEffect(() => {
    if (stock && !limitPrice) {
      setLimitPrice(stock.ltp.toFixed(2));
    }
  }, [stock, limitPrice]);

  const parsedQty = Math.max(0, Math.floor(Number(quantity) || 0));
  const effectivePrice =
    orderType === 'LIMIT' && Number(limitPrice) > 0 ? Number(limitPrice) : stock?.ltp || 0;

  // Fetch server-side charge estimate
  useEffect(() => {
    if (!stock || parsedQty <= 0 || effectivePrice <= 0) {
      setEstimate(null);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<ChargeEstimate>('/api/orders/estimate', {
        method: 'POST',
        body: JSON.stringify({
          symbol,
          side,
          orderType,
          quantity: parsedQty,
          limitPrice: orderType === 'LIMIT' ? Number(limitPrice) : undefined,
        }),
      })
        .then(setEstimate)
        .catch(() => {});
    }, 140);
    return () => clearTimeout(timer);
  }, [symbol, side, orderType, parsedQty, effectivePrice, limitPrice, stock]);

  if (!stock) return null;

  const holdingQty = portfolio?.holdings.find((h) => h.symbol === symbol)?.quantity ?? 0;
  const availableCash = portfolio?.walletBalance ?? 0;

  const applyAllocationPct = (pct: number) => {
    if (side === 'BUY') {
      const unit = effectivePrice * 1.0015;
      if (unit <= 0) return;
      const maxQ = Math.max(1, Math.floor((availableCash * pct) / unit));
      setQuantity(String(maxQ));
    } else {
      const maxQ = Math.max(1, Math.floor(holdingQty * pct));
      setQuantity(String(maxQ));
    }
    setConfirmStep(false);
  };

  const validateBeforeConfirm = (): boolean => {
    setInlineError('');
    if (parsedQty <= 0) {
      setInlineError('Enter a valid quantity of at least 1 share.');
      return false;
    }
    if (orderType === 'LIMIT' && (!Number(limitPrice) || Number(limitPrice) <= 0)) {
      setInlineError('Enter a valid positive limit price.');
      return false;
    }
    if (side === 'BUY' && estimate && estimate.netAmount > availableCash) {
      setInlineError(
        `Required ${formatINR(estimate.netAmount)} exceeds available margin ${formatINR(availableCash)}.`
      );
      return false;
    }
    if (side === 'SELL' && parsedQty > holdingQty) {
      setInlineError(`You hold ${holdingQty} sellable shares of ${symbol}.`);
      return false;
    }
    return true;
  };

  const handleSubmitOrder = async () => {
    if (!validateBeforeConfirm()) return;
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    setSubmitting(true);
    setInlineError('');
    try {
      const placed = await apiFetch<OrderItem>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          symbol,
          side,
          orderType,
          quantity: parsedQty,
          limitPrice: orderType === 'LIMIT' ? Number(limitPrice) : null,
          stopLossPrice: stopLoss ? Number(stopLoss) : null,
          targetPrice: target ? Number(target) : null,
        }),
      });

      await refreshPortfolioAll();
      setConfirmStep(false);

      if (placed.status === 'PENDING') {
        pushToast({
          title: `Limit ${side} Queued — ${symbol}`,
          message: `${parsedQty} qty @ ₹${Number(placed.limitPrice).toFixed(2)}. Undo available for 8s.`,
          variant: 'info',
          undoOrderId: placed.id,
        });
      } else {
        pushToast({
          title: `${side === 'BUY' ? 'Bought' : 'Sold'} ${parsedQty} ${symbol}`,
          message: `Executed at ${formatINR(placed.executedPrice || stock.ltp)} · Charges ${formatINR(placed.charges)}`,
          variant: 'success',
        });
      }
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Order rejected.';
      setInlineError(msg);
      pushToast({
        title: `Order Rejected — ${symbol}`,
        message: msg,
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isBuy = side === 'BUY';

  return (
    <div
      className={`${
        embedded
          ? 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-4'
          : 'p-5'
      }`}
    >
      {/* Buy / Sell Segmented Switch */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg mb-4">
        <button
          type="button"
          onClick={() => {
            setSide('BUY');
            setConfirmStep(false);
            setInlineError('');
          }}
          className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            isBuy
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          BUY {symbol}
        </button>
        <button
          type="button"
          onClick={() => {
            setSide('SELL');
            setConfirmStep(false);
            setInlineError('');
          }}
          className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            !isBuy
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          SELL {symbol}
        </button>
      </div>

      {/* Live Quote Header */}
      <div className="flex items-baseline justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">NSE Equity · Spot</div>
          <div className="text-lg font-bold font-mono-num text-slate-900 dark:text-white">
            {formatINR(stock.ltp)}
          </div>
        </div>
        <div className="text-right text-xs font-mono-num">
          <div
            className={
              stock.changePct >= 0
                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-rose-600 dark:text-rose-400 font-semibold'
            }
          >
            {stock.changePct >= 0 ? '▲ +' : '▼ '}
            {stock.change.toFixed(2)} ({stock.changePct.toFixed(2)}%)
          </div>
          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
            {isBuy ? `Avail ${formatINR(availableCash, 0)}` : `Holdings: ${holdingQty} qty`}
          </div>
        </div>
      </div>

      {/* Order Type: Market / Limit */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Order Type</span>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
          {(['MARKET', 'LIMIT'] as OrderType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setOrderType(t);
                if (t === 'LIMIT') setLimitPrice(stock.ltp.toFixed(2));
                setConfirmStep(false);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                orderType === t
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t === 'MARKET' ? 'Market' : 'Limit'}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity & Price Inputs */}
      <div className="grid grid-cols-2 gap-3 mb-2.5">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Quantity (Shares)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setConfirmStep(false);
            }}
            className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {orderType === 'MARKET' ? 'Execution Price' : 'Limit Price (₹)'}
          </label>
          {orderType === 'MARKET' ? (
            <div className="w-full px-3 py-2 text-sm font-mono-num bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 dark:text-slate-400">
              Market ({formatINR(stock.ltp)})
            </div>
          ) : (
            <input
              type="number"
              min={1}
              step="0.05"
              value={limitPrice}
              onChange={(e) => {
                setLimitPrice(e.target.value);
                setConfirmStep(false);
              }}
              className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          )}
        </div>
      </div>

      {/* Quick Sizing Buttons */}
      <div className="flex items-center gap-1.5 mb-4">
        {[
          { label: '10%', pct: 0.1 },
          { label: '25%', pct: 0.25 },
          { label: '50%', pct: 0.5 },
          { label: 'Max', pct: 0.98 },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => applyAllocationPct(b.pct)}
            className="flex-1 py-1 text-[11px] font-mono-num font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Stop-Loss & Target Protection (for BUY orders) */}
      {isBuy && (
        <div className="grid grid-cols-2 gap-3 mb-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Auto Stop-Loss (₹, opt)
            </label>
            <input
              type="number"
              step="0.5"
              placeholder={(stock.ltp * 0.94).toFixed(0)}
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Auto Target (₹, opt)
            </label>
            <input
              type="number"
              step="0.5"
              placeholder={(stock.ltp * 1.12).toFixed(0)}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono-num bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Estimated Cost & Statutory Charges Breakdown */}
      {estimate && (
        <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-4 text-xs">
          <div className="flex items-center justify-between font-mono-num mb-1.5">
            <span className="text-slate-500 dark:text-slate-400">
              {isBuy ? 'Est. Total Margin' : 'Est. Net Receivable'}
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {formatINR(estimate.netAmount)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowChargesDetail((v) => !v)}
            className="w-full flex items-center justify-between text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <span>Brokerage + Statutory Taxes: {formatINR(estimate.totalCharges)}</span>
            {showChargesDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showChargesDetail && (
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Order Value ({estimate.quantity} × ₹{estimate.referencePrice.toFixed(2)})</span>
                <span>{formatINR(estimate.turnover)}</span>
              </div>
              <div className="flex justify-between">
                <span>Brokerage (0.03% or ₹20 max)</span>
                <span>{formatINR(estimate.brokerage)}</span>
              </div>
              <div className="flex justify-between">
                <span>STT (0.1% Delivery)</span>
                <span>{formatINR(estimate.stt)}</span>
              </div>
              <div className="flex justify-between">
                <span>NSE Txn + SEBI + Stamp Duty</span>
                <span>{formatINR(estimate.exchangeTxnCharge + estimate.sebiTurnoverFee + estimate.stampDuty)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (18%)</span>
                <span>{formatINR(estimate.gst)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {inlineError && (
        <div className="flex items-start gap-2 p-2.5 mb-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{inlineError}</span>
        </div>
      )}

      {confirmStep ? (
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
            Confirm {side} {parsedQty} {symbol} ({orderType}) for{' '}
            <strong className="font-mono-num">{estimate ? formatINR(estimate.netAmount) : ''}</strong>?
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmStep(false)}
              className="py-2.5 px-3 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitOrder}
              className={`py-2.5 px-3 text-xs font-semibold rounded-lg text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99] transition-transform ${
                isBuy ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Executing...' : `Confirm ${side}`}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSubmitOrder}
          className={`w-full py-2.5 px-4 text-sm font-semibold rounded-lg text-white transition-all active:scale-[0.99] cursor-pointer ${
            isBuy
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-rose-600 hover:bg-rose-500'
          }`}
        >
          {isBuy ? 'Buy' : 'Sell'} {symbol} · {orderType === 'MARKET' ? 'Market' : `Limit ₹${limitPrice}`}
        </button>
      )}
    </div>
  );
};

export const OrderDrawer: React.FC = () => {
  const { orderDrawer, closeOrderDrawer, stocksMap, navigate } = usePortfolio();
  if (!orderDrawer.open) return null;
  const stock = stocksMap[orderDrawer.symbol];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex justify-end"
      onClick={closeOrderDrawer}
      role="dialog"
      aria-modal="true"
      aria-label="Order Ticket Drawer"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#111827] h-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{orderDrawer.symbol}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stock?.name || 'NSE Equity'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  closeOrderDrawer();
                  navigate('stock', orderDrawer.symbol);
                }}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Open Chart
              </button>
              <button
                type="button"
                onClick={closeOrderDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <OrderTicketPanel
            symbol={orderDrawer.symbol}
            initialSide={orderDrawer.side}
            initialType={orderDrawer.orderType}
            onSuccess={closeOrderDrawer}
          />
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          Limit orders auto-execute on live NSE price ticks when target price is reached.
        </div>
      </div>
    </div>
  );
};
