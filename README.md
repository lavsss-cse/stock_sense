# StockSense

### A modern workspace for confident, multi-location inventory operations

StockSense brings products, warehouse locations, stock movements, and daily inventory work into one focused application. It is built for teams that need to receive stock, fulfil orders, transfer items between locations, and reconcile physical counts without losing sight of what changed and why.

---

## ✨ What you can do

| Area | Highlights |
| --- | --- |
| **Inventory visibility** | Browse products, SKUs, categories, locations, stock levels, valuation, and low-stock alerts. |
| **Daily operations** | Create and post receipts, deliveries, internal transfers, and physical count adjustments. |
| **Movement history** | Keep a traceable ledger of every completed stock movement. |
| **Safety rules** | Prevent duplicate operation posting, invalid locations, orphaned balances, and negative stock. |
| **Productive interface** | Use search, filters, CSV export, notifications, light/dark themes, and the `Ctrl + K` command palette. |
| **Two deployment paths** | Run locally with Express + SQLite or bundle the edge worker for Cloudflare/D1-compatible environments. |

---

## 🧰 Built with

- **React 18** and **Vite** for the interface
- **Express** for the local API
- **SQLite** for local persistence
- **Zod** for validation and domain invariants
- **Cloudflare Worker / D1-compatible** edge runtime

---

## ✅ Before you begin

Install the following on your computer:

- [Node.js 24 or later](https://nodejs.org/) — the local server uses Node's built-in SQLite module
- Git

Check your Node.js version:

```bash
node --version
```

> **Tip:** If the version is lower than 24, upgrade Node.js before starting the local server.

---

## 🚀 Get the project and run it

### 1. Clone the repository

```bash
git clone https://github.com/lavsss-cse/stock_sense.git
cd stock_sense
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start StockSense

```bash
npm run dev
```

This starts both services:

- Web application: **http://localhost:5173**
- Local API: **http://localhost:8787**

Open **http://localhost:5173** in your browser. Stop the development servers at any time with `Ctrl + C` in the terminal.

---

## 🔐 Demo access

Use either of the included demo accounts on the sign-in screen.

| Role | Email | Password |
| --- | --- | --- |
| Inventory Manager | `inventory@stocksense.demo` | `demo1234` |
| Warehouse Operator | `warehouse@stocksense.demo` | `demo1234` |

**Prototype OTP:** `482913`

The Inventory Manager can work across the catalogue, reports, audits, and operations. The Warehouse Operator is intended for warehouse-focused tasks and has more limited permissions.

---

## 🔄 Pull the latest changes

When you already have a copy of the project, use these commands before you start working:

```bash
git checkout main
git pull origin main
npm install
```

Then run the application normally:

```bash
npm run dev
```

### Helpful update tips

- Run `git status` before pulling. Commit or temporarily save your own work first if Git reports local changes.
- Run `npm install` after pulling whenever `package.json` or `package-lock.json` has changed.
- If the browser appears to show an older interface, stop the dev server, start it again, and refresh the page with `Ctrl + Shift + R`.
- Local demo data is saved in `data/stocksense.db`. It is not committed to Git, so each developer keeps their own local data.

---

## 🧪 Quality checks

Run the domain tests with:

```bash
npm test
```

Create a production build with:

```bash
npm run build
```

After building, start the production server:

```bash
npm start
```

The production server serves the built web app from **http://localhost:8787**.

---

## 📁 Project map

```text
stock_sense/
├── src/
│   ├── App.jsx              # Application screens, modals, and UI behaviour
│   ├── api.js               # Browser API client
│   ├── domain.js            # Zod schemas and validation rules
│   ├── inventory.js         # Inventory operations and movement-ledger logic
│   ├── main.jsx             # React entry point
│   ├── store.js             # Seed data, state helpers, and selectors
│   └── styles.css           # Themes and visual design system
├── worker/
│   └── index.js             # Edge-worker API implementation
├── db/schema.ts             # Database schema interfaces
├── scripts/build-worker.mjs # Production build pipeline
├── tests/inventory.test.js  # Domain test suite
├── dev.mjs                  # Starts the local API and Vite together
├── server.mjs               # Express + SQLite local server
├── package.json             # Commands and dependencies
└── vite.config.js           # Vite configuration
```

---

## 🧭 Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API and web application for development. |
| `npm test` | Run the inventory-domain tests. |
| `npm run build` | Build the React client and edge-worker bundle. |
| `npm start` | Run the production server after a build. |
| `git pull origin main` | Download the latest shared project changes. |

---

## 🛟 Troubleshooting

**Port already in use**  
Close another StockSense process, or start the server with a different API port:

```bash
PORT=8788 npm run dev
```

On Windows PowerShell:

```powershell
$env:PORT=8788; npm run dev
```

**`npm install` fails**  
Confirm that you are using a supported Node.js version, then remove the installed packages and install again:

```bash
rm -rf node_modules
npm install
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

**The application will not load**  
Confirm that the terminal reports both the API server and Vite client are running, then visit http://localhost:5173 directly.

---

## 👥 Contribution workflow

1. Pull the latest `main` branch.
2. Create a branch for your work.
3. Make and test your changes locally.
4. Commit a clear description of the update.
5. Push the branch and open a pull request.

```bash
git checkout -b your-change-name
git add .
git commit -m "Updated the project work"
git push -u origin your-change-name
```

---

Made for better stock control, clearer warehouse decisions, and calmer operations.
