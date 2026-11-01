# PortfolioPro — Stock Trading, Quantitative Analysis & Portfolio Risk Management Platform

**PortfolioPro** is an NSE stock trading, technical/fundamental equity analysis, and parametric Value-at-Risk (VaR) portfolio management platform.

## Key Capabilities

- **Live NSE Equities & Market Execution**: Real-time tick streaming across 30 NSE equities (`RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `ICICIBANK`, etc.) with 5-year historical OHLCV candlesticks, Market & Limit order execution, statutory SEBI/STT/GST brokerage breakdown, and automated Stop-Loss / Target execution.
- **Quantitative Technical & Fundamental Analytics**: Computed SMA (20/50/200), EMA, Bollinger Bands, RSI (14), MACD (12/26/9), volume overlays, and sector-relative P/E, P/B, ROE, ROCE, and Debt/Equity screening.
- **Parametric Portfolio Risk Engine**: 95% / 99% Parametric Value-at-Risk (VaR), Sharpe Ratio, Portfolio Beta against NIFTY 50, Maximum Drawdown, XIRR annualized return calculation, and sector concentration diagnostics.
- **Isomorphic Runtime**: Runs with an Express + WebSocket (`/ws`) server during local development and automatically engages a built-in browser live market & execution engine for zero-setup static cloud hosting on Vercel.

## Demo Sign-In

- **Email**: `demo@portfoliopro.in`
- **Password**: `Demo@1234`

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploying on Vercel

Import the repository directly in Vercel (`Framework Preset: Vite`, `Build Command: npm run build`, `Output Directory: dist`). No environment variables or external database setup are required.
