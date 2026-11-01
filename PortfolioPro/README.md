# PortfolioPro — Stock Trading & Portfolio Management Platform

Full-stack stock trading, live market simulation, technical & fundamental analysis, and portfolio risk management platform built with **Spring Boot 3 (Java 17+)**, **MySQL 8** (with automatic local embedded fallback), and **Angular 17+**.

## Prerequisites
- **Java 17+** (verified on Java 17, 21, and 25+) & **Maven 3.9+**
- **Node.js 20+** & **npm 10+**
- **Docker Desktop** *(optional — MySQL 8 maps to `127.0.0.1:3307` so it never conflicts with a local MySQL server on `3306`; if Docker is not running, the backend automatically switches to an embedded file database in `./backend/data`)*

---

## Quick Run — Windows (Command Prompt / PowerShell)

**Option A — One-Click Launcher (with Docker MySQL 8 on port `3307`):**
Double-click `start-windows.bat` (waits until MySQL 8 passes its TCP healthcheck before starting Spring Boot, or automatically falls back if Docker is closed).

**Option B — One-Click Launcher (Zero Docker Needed):**
Double-click `start-windows-nodocker.bat` to boot immediately with the embedded MySQL-compatible local database.

**Option C — Manual Terminals (Windows `cmd.exe`):**

Terminal 1 (Start MySQL 8 + Spring Boot Backend on `http://localhost:8080`):
```bat
copy /Y .env.example .env
docker compose up -d --wait
cd backend
mvn spring-boot:run
```
*(Or without Docker: `cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=h2`)*

Terminal 2 (Open a new CMD window inside `PortfolioPro`, start Angular Frontend on `http://localhost:4200`):
```bat
cd frontend
npm install
npx ng serve --open
```

---

## Quick Run — macOS / Linux

Terminal 1 (MySQL 8 + Spring Boot Backend):
```bash
cp .env.example .env
docker compose up -d --wait
cd backend
mvn spring-boot:run
```
*(Or without Docker: `cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=h2`)*

Terminal 2 (Angular Frontend):
```bash
cd frontend
npm install
npx ng serve --open
```

---

## Run Backend Unit & Integration Tests
```bash
cd backend
mvn test
```

## Demo Login Credentials
- **Email**: `demo@portfoliopro.in`
- **Password**: `Demo@1234`
- **Swagger / OpenAPI UI**: `http://localhost:8080/swagger-ui.html`
- *(Registering any new user automatically provisions a **₹10,00,000** virtual wallet.)*

## REST API Summary (`/api`)
| Area | Endpoints |
| :--- | :--- |
| **Auth** | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `PUT /api/auth/theme` |
| **Market Data** | `GET /api/market/stocks`, `GET /api/market/indices`, `GET /api/market/stocks/{symbol}`, `GET /api/market/stocks/{symbol}/candles?timeframe=1D\|1W\|1M\|1Y\|5Y` |
| **Trade & Orders** | `POST /api/orders/estimate`, `POST /api/orders`, `GET /api/orders?status=&page=&size=`, `POST /api/orders/{id}/cancel` |
| **Portfolio** | `GET /api/portfolio/summary`, `PUT /api/portfolio/holdings/{symbol}/risk` |
| **Risk Engine** | `GET /api/risk/summary` (Risk score, HHI concentration, Beta, 95% VaR, Max Drawdown, SL/TP alerts) |
| **Analysis** | `GET /api/analysis/{symbol}/technicals?timeframe=`, `GET /api/analysis/{symbol}/fundamentals` |
| **Watchlists & Alerts** | `GET /api/watchlists`, `POST /api/watchlists`, `DELETE /api/watchlists/{id}`, `POST /api/watchlists/{id}/items`, `DELETE /api/watchlists/{id}/items/{symbol}`, `PUT /api/watchlists/{id}/reorder`, `POST /api/alerts`, `DELETE /api/alerts/{id}` |
| **Wallet & Notifications** | `GET /api/wallet`, `POST /api/wallet/deposit`, `POST /api/wallet/withdraw`, `GET /api/notifications`, `POST /api/notifications/read-all` |
