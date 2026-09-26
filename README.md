# StockSense — Intelligent Multi-Location Inventory Workspace

**StockSense** is an enterprise-grade multi-location inventory management workspace for tracking products, SKUs, warehouse storage locations, stock balances, movements ledger, and transactional operations (Receipts, Deliveries, Internal Transfers, and Physical Count Audits).

---

## 🚀 Key Features & Capabilities

- **Pure Inventory Domain Engine** ([`src/inventory.js`](file:///e:/Stock-Sense/src/inventory.js)):
  - **Inbound Receipts**: Inflow from suppliers with automatic location racking and ledger movement creation.
  - **Outbound Deliveries**: Order fulfillment with picked & packed quality verification, stock coverage checks, and negative-stock prevention.
  - **Internal Transfers**: Relocation between warehouse locations with real-time balance checks and immutable movement logs.
  - **Physical Count Audits**: Cyclic inventory reconciliation with signed delta tracking (`+` / `-`).
  - **Conflict & Re-post Protection**: Monotonic revision check and protection against duplicate operation completion (HTTP 409).
- **Zod Schema Invariants** ([`src/domain.js`](file:///e:/Stock-Sense/src/domain.js)): Strict entity validation, unique SKUs, valid location hierarchy, and orphaned balance prevention.
- **Dual Runtime Architecture**:
  - **Local Node.js**: Express server with SQLite native persistence ([`server.mjs`](file:///e:/Stock-Sense/server.mjs)).
  - **Edge Worker**: Cloudflare / D1 SQLite compatible edge runtime ([`worker/index.js`](file:///e:/Stock-Sense/worker/index.js)).
- **Modern UI & UX System** ([`src/App.jsx`](file:///e:/Stock-Sense/src/App.jsx), [`src/styles.css`](file:///e:/Stock-Sense/src/styles.css)):
  - Curated Dark & Light mode themes with obsidian surfaces, ambient glow, and micro-animations.
  - Real-time KPI stats: Total stock units, valuation $, low-stock alerts, and pending work orders.
  - Searchable product catalogue with category & stock level filters, location breakdown modals, and CSV export.
  - Interactive Command Palette (`Ctrl + K`).
  - Live sync indicator showing connection state and revision number.
  - Activity alerts notification drawer.

---

## 🛠️ Quick Start & Local Development

### 1. Start Development Environment
Starts both the backend Express API (Port `8787`) and Vite frontend dev server (Port `5173`) with live reload and proxy:
```bash
npm run dev
```

### 2. Demo Credentials
- **Inventory persona** — product catalogue, stock balances, audits, and reporting:
  - Email: `inventory@stocksense.demo`
  - Password: `demo1234`
- **Warehouse persona** — opens directly into the inventory workspace for receiving, transfers, fulfilment, and location work:
  - Email: `warehouse@stocksense.demo`
  - Password: `demo1234`
- **Prototype OTP**: `482913`

### 3. Run Automated Domain Tests
```bash
npm test
```

### 4. Build Production Bundle
Builds the optimized React client to `dist/client` and bundles the edge worker to `dist/server/index.js`:
```bash
npm run build
```

### 5. Start Production Server
```bash
npm start
```

---

## 📂 Project Structure

```text
STOCK-SENSE/
├── src/
│   ├── App.jsx              # React UI shell, views, modals, and client orchestration
│   ├── main.jsx             # React entry point
│   ├── api.js               # Browser API client with token injection & response parsing
│   ├── domain.js            # Shared Zod schemas and cross-record invariant validation
│   ├── inventory.js         # Central inventory domain engine & movement ledger logic
│   ├── store.js             # Realistic seed state, localStorage fallback, and selectors
│   └── styles.css           # Design tokens, themes (dark/light), modals, cards, & tables
├── server.mjs               # Local Express server with Node 24 native SQLite persistence
├── worker/index.js          # Cloudflare Edge Worker API with D1 database binding
├── db/schema.ts             # Database schema interfaces for workspace_state and sessions
├── scripts/build-worker.mjs # Build pipeline for Vite client and esbuild edge worker
├── dev.mjs                  # Concurrent launcher for API server and Vite client
├── tests/inventory.test.js  # Test suite verifying all domain invariants and rules
├── index.html               # Vite HTML entry with modern typography and metadata
├── vite.config.js           # Vite dev and build configuration
└── package.json             # Scripts and dependencies
```
