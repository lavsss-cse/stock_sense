import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedState } from './src/store.js';

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = join(root, 'data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, 'stocksense.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const readRow = db.prepare('SELECT payload, updated_at FROM app_state WHERE id = 1');
const writeRow = db.prepare(`
  INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
`);
if (!readRow.get()) writeRow.run(JSON.stringify(seedState), new Date().toISOString());

function readState() {
  const row = readRow.get();
  return { ...JSON.parse(row.payload), serverUpdatedAt: row.updated_at };
}

function validateState(value) {
  const required = ['products', 'warehouses', 'locations', 'balances', 'operations', 'movements', 'notifications'];
  if (!value || typeof value !== 'object' || required.some((key) => !Array.isArray(value[key]))) {
    const error = new Error('Invalid StockSense state payload.');
    error.status = 400;
    throw error;
  }
}

function persistState(value) {
  validateState(value);
  const clean = { ...value };
  delete clean.serverUpdatedAt;
  const updatedAt = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    writeRow.run(JSON.stringify(clean), updatedAt);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { ...clean, serverUpdatedAt: updatedAt };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', request.path.startsWith('/api/') ? 'no-store' : 'public, max-age=3600');
  next();
});

app.get('/api/health', (_request, response) => response.json({ status: 'ok', database: 'connected', service: 'StockSense API', timestamp: new Date().toISOString() }));

app.post('/api/auth/login', (request, response) => {
  const { email, password } = request.body || {};
  if (!email || !String(email).includes('@') || !password || String(password).length < 6) return response.status(400).json({ message: 'Enter a valid email and password.' });
  const token = crypto.randomUUID();
  db.prepare('INSERT INTO sessions (token, email, created_at) VALUES (?, ?, ?)').run(token, String(email).toLowerCase(), new Date().toISOString());
  response.json({ token, user: { name: 'Maya Chen', email, role: 'Inventory Manager', workspace: 'Arbor & Co.' } });
});

app.post('/api/auth/request-otp', (request, response) => {
  const { email } = request.body || {};
  if (!email || !String(email).includes('@')) return response.status(400).json({ message: 'Enter a valid email.' });
  response.json({ sent: true, prototypeOtp: '482913', expiresInSeconds: 600 });
});

app.get('/api/state', (_request, response) => response.json(readState()));
app.put('/api/state', (request, response, next) => { try { response.json(persistState(request.body)); } catch (error) { next(error); } });
app.post('/api/reset', (_request, response, next) => { try { response.json(persistState(structuredClone(seedState))); } catch (error) { next(error); } });

const distDir = join(root, 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('/{*path}', (_request, response) => response.sendFile(join(distDir, 'index.html')));
}

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status || 500).json({ message: error.status ? error.message : 'The StockSense service could not complete this request.' });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, '127.0.0.1', () => console.log(`StockSense API listening on http://127.0.0.1:${port}`));
