# PortfolioPro — GitHub Monorepo & 24/7 Live Vercel Deployment

Configure **PortfolioPro** so a single GitHub repository hosts both the full academic enterprise codebase (Java 17 Spring Boot 3.3, Angular 17, MySQL 8, and HCLTech submission PDFs) and a zero-downtime live web application that deploys cleanly to **Vercel** via a one-command PowerShell automation workflow and visual dashboard guide.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and deployment choices reflect your confirmed preferences before code changes begin:

- **Confirmed Repository & Live Target**: Package a unified GitHub monorepo containing the complete Java Spring Boot + Angular 17 enterprise project alongside the Vercel-ready live interactive trading application and submission PDFs.
- **Confirmed Deployment Workflow**: Provide a downloadable GitHub & Vercel monorepo bundle paired with a one-command Windows PowerShell deployment script and a step-by-step Vercel dashboard import guide inside the app.
- **Confirmed Submission PDF Links**: Preserve the existing verified Live App URL inside both HCLTech Career Shaper PDFs for immediate submission readiness until your personal Vercel domain is live.

---

## 1. Overview & Core Concept

- **What It Does**: Prepares PortfolioPro for permanent public hosting on Vercel and source inspection on GitHub. Visitors opening your Vercel live URL experience real-time 1.5-second NSE price streaming, interactive candlestick and technical indicator charts, statutory brokerage estimation, simulated Market and Limit order execution, Stop-Loss/Target automation, and parametric Value-at-Risk analytics—even without a dedicated cloud Java or WebSocket VM. Simultaneously, mentors inspecting your GitHub repository see the complete Spring Boot 3.3, Angular 17, Docker MySQL 8, JUnit 5 test suite, and HCLTech report deliverables.
- **Target Audience / Persona**: HCLTech Career Shaper evaluators, faculty mentors (ABES Engineering College), technical recruiters reviewing the GitHub codebase and clicking the live demo URL, and the learner deploying from a Windows machine.
- **Key Value**: Eliminates the classic serverless failure mode where Vercel deployments break due to missing WebSocket servers or cold-start memory resets, while giving you a repeatable single-command path from download to live GitHub + Vercel URLs.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Opening the Submission & Cloud Deploy Hub**: From either the sign-in header or the main trading workspace top bar, clicking the primary deliverables/deploy button opens a structured tabbed modal with two focused workspaces: **HCLTech Deliverables** (both PDFs + enterprise archive) and **GitHub & Vercel Deploy**.
  2. **Customizing & Copying the One-Command Deploy Workflow**: In the **GitHub & Vercel Deploy** tab, entering a GitHub username and repository name dynamically updates the PowerShell commands and repository remote URLs in real time. Users download the unified monorepo bundle, copy or download the PowerShell automation script, and run a single command to initialize Git, push to GitHub, and trigger Vercel production deployment (or import the pushed repo in two clicks via the Vercel web dashboard).
  3. **Experiencing the Live App on Vercel**: When anyone visits the deployed `*.vercel.app` link, the application automatically detects serverless static hosting, seamlessly activates the client-side live NSE market and execution engine, lights up the live stream telemetry indicator, persists accounts, holdings, orders, watchlists, and wallet ledgers in browser storage, and serves both HCLTech PDFs directly from Vercel's global CDN.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-density institutional fintech SaaS terminal following flat single-elevation surface architecture with crisp 1px structural dividers (`border-slate-200` in light mode, `border-slate-800` in dark mode) and zero nested card clutter.
  - *Color Palette & Mood*: Disciplined 60-30-10 distribution—60% neutral slate canvas (`#0B1120` dark / `#F8FAFC` light), 30% subdued structural panels (`#111827` dark / `#FFFFFF` light), and 10% semantic emerald (`#10B981`) and crimson (`#EF4444`) accents reserved strictly for primary actions, live stream state, and market direction.
  - *Typography & Hierarchy*: Crisp geometric sans-serif headings and navigation paired with strict monospace tabular numerals (`tabular-nums`) across all prices, P&L figures, archive sizes, port numbers, and terminal snippets so numerical columns never jitter. Static metadata rows use clean unboxed text separated by `·` rather than decorative pill badges.
  - *Component Styling & Layout*: Desktop-first 1440px sidebar-plus-header trading layout; single-line interactive controls (`whitespace-nowrap shrink-0`) with balanced button padding (`py-2 px-4`); clean segmented tab switchers inside the deliverables and deployment modal; full light/dark theme parity with zero contrast split-brain.

- **Interactive Feedback & Motion**:
  - Instant (<150ms) tab transitions and copy-confirmation states (`Copied Script` / `Archive Downloaded`) paired with explicit text labels alongside icons.
  - Selectable read-only PowerShell preview block with automatic focus selection as a fallback for strict iframe clipboard policies.
  - Seamless live tick flashes (subtle emerald/crimson row highlights) every 1.5 seconds in both full-stack server mode and Vercel standalone mode.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Isomorphic Dual-Runtime Engine for Vercel Live Hosting**
  - *Chosen Approach*: Keep the Express + WebSocket server active for local and AI Studio execution, while embedding an automatic client-side market simulation, technical/fundamental calculation, and order-execution fallback engine that activates transparently whenever deployed to Vercel static/serverless hosting.
  - *Why*: Vercel does not maintain persistent Node WebSocket daemons or permanent local disk state across serverless cold starts. A browser-backed isomorphic engine guarantees 100% uptime, zero latency on 1.5-second live NSE ticks, working registration/login, persistent trades/wallets per visitor, and zero monthly cloud database bills.
  - *Alternatives Considered*: Deploying only Vercel serverless `/api` routes without a client-side engine (rejected because serverless cold starts wipe in-memory trades and break `/ws` live streaming) or requiring an external paid Railway/Render MySQL + Spring Boot host before Vercel works (rejected because free-tier sleep states break mentor grading demos).

- **Decision 2: Unified Monorepo Packaging for GitHub + Vercel**
  - *Chosen Approach*: Structure the downloadable GitHub repository archive so root-level Vercel configuration builds and serves the live interactive trading web app automatically, while preserving the complete Java 17 Spring Boot 3.3 backend, Angular 17 frontend, Docker MySQL configuration, and HCLTech PDFs in dedicated repository directories documented in a comprehensive `README.md`.
  - *Why*: Connecting a single GitHub repository to Vercel works out-of-the-box with zero Root Directory confusion, while faculty mentors browsing GitHub immediately see the complete Java/Angular source code and project documentation.
  - *Alternatives Considered*: Splitting into two separate GitHub repositories (rejected because academic submission forms typically provide a single GitHub/Project URL field).

- **Decision 3: Dual-Path Deployment Automation (PowerShell CLI + Dashboard Import Guide)**
  - *Chosen Approach*: Provide an automated PowerShell script that supports both GitHub CLI (`gh`) / standard `git push` and `npx vercel --prod`, paired with a visual 3-step Vercel Dashboard guide if the user prefers browser-based GitHub import over terminal login.
  - *Why*: Avoids asking for sensitive GitHub or Vercel API tokens inside the web UI while making deployment effortless whether or not global CLI tools are pre-installed on the user's PC.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED GITHUB MONOREPO & VERCEL BUILD                   │
├──────────────────────────────────────┬───────────────────────────────────────┤
│   Enterprise Academic Stack          │   Vercel 24/7 Live Web Platform       │
│  ┌────────────────────────────────┐  │  ┌─────────────────────────────────┐  │
│  │ Spring Boot 3.3 + Java 17      │  │  │ Vite SPA + Vercel CDN Config    │  │
│  │ JWT + @Version + MySQL 8 +     │  │  │ SPA Rewrites + Static PDFs/ZIP  │  │
│  │ Angular 17 Signals + JUnit 5   │  │  └────────────────┬────────────────┘  │
│  └────────────────────────────────┘  │                   │                   │
└──────────────────────────────────────┴───────────────────┼───────────────────┘
                                                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     DUAL-RUNTIME CLIENT TRANSPORT LAYER                      │
│                                                                              │
│   Portfolio State & Market Context ──► Adaptive API & Stream Adapter         │
│                                           │                     │            │
│                      [Local / Dev Server] │                     │ [Vercel]   │
│                                           ▼                     ▼            │
│                             ┌───────────────────┐ ┌────────────────────────┐ │
│                             │ Express + WS /ws  │ │ Browser Live Engine    │ │
│                             │ Stateful Server   │ │ • 1.5s NSE Tick Loop   │ │
│                             │ + JSON File Store │ │ • Limit/SL/TP Matcher  │ │
│                             └───────────────────┘ │ • RSI/MACD/VaR Math    │ │
│                                                   │ • LocalStorage Ledger  │ │
│                                                   └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                                                           │
                                                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 DELIVERABLES & CLOUD DEPLOYMENT HUB MODAL                    │
│  ┌─────────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │ Tab 1: HCLTech Deliverables     │  │ Tab 2: GitHub & Vercel Deploy     │  │
│  │ • 7-Page Synopsis PDF           │  │ • Dynamic Repo URL Customizer     │  │
│  │ • 3-Page Code & Output PDF      │  │ • Full Monorepo ZIP Download      │  │
│  │ • Enterprise Source ZIP         │  │ • One-Command PowerShell Script   │  │
│  └─────────────────────────────────┘  │ • 3-Step Vercel Dashboard Guide   │  │
│                                       └───────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Browser Live Engine Store (Vercel Fallback)**: Mirrors the server store schema in versioned `localStorage` (`pp_vercel_db_v1`), storing seeded and registered users, active session tokens, ₹10,00,000 virtual wallets with blocked margin tracking, equity holdings with weighted average buy price and SL/TP thresholds, order history, custom watchlists, price alerts, and notifications.
  - **Live Market State**: In-memory map of seeded NSE equities and benchmark indices (`NIFTY 50`, `SENSEX`, `NIFTY BANK`, `NIFTY IT`) with 1D/1W/1M/1Y/5Y OHLCV candle caches updated every 1.5 seconds via correlated volatility random-walk ticks.
  - **Deployment Configurator State**: Client state inside the Deployment Hub tracking `githubUsername`, `repoName`, active modal tab (`deliverables` | `deploy`), download progress flags, and script clipboard/preview status.

- **Interactive Component & State Mapping**:
  - **Adaptive API Router**: Intercepts every `/api/*` request when backend connectivity is absent (on static Vercel hosting) and executes equivalent route handlers locally (auth login/register/me/theme, market stocks/candles, technical & fundamental analysis, charge estimation, market/limit order placement & cancellation, SL/TP updates, VaR risk summary, watchlists/alerts CRUD, wallet deposit/withdrawal, and notification read states).
  - **Adaptive Stream Connector**: Attempts standard WebSocket `/ws` connection first; if unavailable on static Vercel hosting, starts the internal 1.5-second tick broadcaster that emits `MARKET_SNAPSHOT`, `PRICE_TICKS`, `ORDER_EXECUTED`, `RISK_TRIGGERED`, and `ALERT_TRIGGERED` events directly to the portfolio context so `wsConnected` stays active and live order matching works identically.
  - **GitHub & Vercel Deployment Hub**: Validates sanitized GitHub username/repository inputs to dynamically interpolate personalized PowerShell/Bash commands, serves the complete GitHub+Vercel monorepo ZIP and `deploy-github-vercel.ps1` script via binary/text blob download routes, and provides one-click clipboard copy with inline selectable preview fallback.
