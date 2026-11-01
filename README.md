# PortfolioPro — Stock Trading, Quantitative Analysis & Portfolio Risk Management Platform

**PortfolioPro** is an institutional-grade NSE stock trading, technical/fundamental equity analysis, and parametric Value-at-Risk (VaR) portfolio management platform.

## Key Capabilities

- **Live NSE Equities & Market Execution**: Real-time tick streaming across 30 NSE equities (`RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `ICICIBANK`, etc.) with 5-year historical OHLCV candlesticks, Market & Limit order execution, statutory SEBI/STT/GST brokerage breakdown, and automated Stop-Loss / Target execution.
- **Quantitative Technical & Fundamental Analytics**: Server-computed SMA (20/50/200), EMA, Bollinger Bands, RSI (14), MACD (12/26/9), volume overlays, and sector-relative P/E, P/B, ROE, ROCE, and Debt/Equity screening.
- **Parametric Portfolio Risk Engine**: 95% / 99% Parametric Value-at-Risk (VaR), Sharpe Ratio, Portfolio Beta against NIFTY 50, Maximum Drawdown, XIRR annualized return calculation, and sector concentration diagnostics.
- **Dual-Runtime Architecture**:
  - **Web Platform (`/src`, `/server`, `/vercel.json`)**: React + TypeScript + Vite SPA paired with an Express + WebSocket (`/ws`) server for local execution and an isomorphic browser market engine for zero-downtime serverless hosting on Vercel.
  - **Enterprise Java Stack (`/PortfolioPro`)**: Java 17, Spring Boot 3.3, Spring Security 6 Rotating JWT authentication, JPA `@Version` optimistic locking on `Wallet` and `Holding` entities, MySQL 8 (`docker-compose.yml`), Angular 17 Standalone Signals store, and JUnit 5 test suite.

## Demo Sign-In

- **Email**: `demo@portfoliopro.in`
- **Password**: `Demo@1234`

## Running Locally

### 1. Web & WebSocket Live Server (Port 3000)
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

### 2. Spring Boot 3.3 + Angular 17 + MySQL 8 Stack
```bash
cd PortfolioPro
docker compose up -d

# Terminal 1 — Spring Boot 3.3 Backend (Port 8080)
cd backend
mvn clean spring-boot:run

# Terminal 2 — Angular 17 Frontend (Port 4200)
cd ../frontend
npm install
npx ng serve --open
```
Open `http://localhost:4200` (or pass `-Dspring-boot.run.profiles=h2` to run Spring Boot with in-memory H2 without Docker).
