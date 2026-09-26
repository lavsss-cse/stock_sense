# StockSense

A complete inventory-management prototype based on the supplied StockSense brief. It includes a responsive React interface, a Node/Express API, and persistent SQLite storage.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173` and use:

- Email: `manager@stocksense.demo`
- Password: `demo1234`

For the production build:

```bash
npm run build
npm start
```

Then open `http://127.0.0.1:8787`.

## Included workflows

- Demo authentication, sign-up, and OTP reset experience
- Dashboard KPIs, alerts, filters, notifications, and quick actions
- Product catalogue with SKU, category, unit, reorder rules, and location stock
- Receipts, deliveries, internal transfers, and physical-count adjustments
- Stock validation rules and automatic balance updates
- Immutable movement ledger
- Multi-warehouse and location management
- Profile, settings, light/dark themes, responsive layouts, and accessibility support
- SQLite-backed API persistence with offline browser fallback
- WebMCP tools for inventory summaries and starting stock workflows
