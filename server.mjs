import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LoginSchema, OperationWriteSchema, OtpRequestSchema, StateWriteSchema, zodMessage } from './src/domain.js';
import { InventoryError, saveOperation } from './src/inventory.js';
import { seedState } from './src/store.js';

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = join(root, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'stocksense.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS workspace_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
`);

const sessionColumns = db.prepare('PRAGMA table_info(sessions)').all().map((column) => column.name);
if (!sessionColumns.includes('user_id') || !sessionColumns.includes('expires_at')) {
  db.exec('DROP TABLE sessions; CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);');
}

const legacy = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_state'").get();
if (!db.prepare('SELECT id FROM workspace_state WHERE id = 1').get()) {
  const legacyRow = legacy ? db.prepare('SELECT payload, updated_at FROM app_state WHERE id = 1').get() : null;
  db.prepare('INSERT INTO workspace_state (id, payload, revision, updated_at) VALUES (1, ?, 1, ?)').run(legacyRow?.payload || JSON.stringify(seedState), legacyRow?.updated_at || new Date().toISOString());
}

function readState() {
  const row = db.prepare('SELECT payload, revision, updated_at FROM workspace_state WHERE id = 1').get();
  return { state: JSON.parse(row.payload), revision: row.revision, updatedAt: row.updated_at };
}
function writeState(state, expectedRevision) {
  const updatedAt = new Date().toISOString();
  const result = db.prepare('UPDATE workspace_state SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?').run(JSON.stringify(state), updatedAt, expectedRevision);
  if (!result.changes) throw new InventoryError('Inventory changed in another session. Refresh and try again.', 409);
  return { state, revision: expectedRevision + 1, updatedAt };
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

app.get('/api/health', (_request, response) => response.json({ status: 'ok', database: 'connected', validation: 'zod', timestamp: new Date().toISOString() }));
app.post('/api/auth/login', (request, response) => {
  const parsed = LoginSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: zodMessage(parsed.error), details: parsed.error.flatten() });
  const token = crypto.randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 12 * 60 * 60 * 1000);
  db.prepare('INSERT INTO sessions (token, user_id, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(token, `local:${parsed.data.email}`, parsed.data.email.toLowerCase(), createdAt.toISOString(), expiresAt.toISOString());
  response.json({ token, expiresAt: expiresAt.toISOString(), user: { name: 'Maya Chen', email: parsed.data.email, role: 'Inventory Manager', workspace: 'Arbor & Co.' } });
});
app.post('/api/auth/request-otp', (request, response) => {
  const parsed = OtpRequestSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ message: zodMessage(parsed.error), details: parsed.error.flatten() });
  response.json({ sent: true, prototypeOtp: '482913', expiresInSeconds: 600 });
});

app.use('/api', (request, _response, next) => {
  if (request.path === '/health' || request.path === '/auth/login' || request.path === '/auth/request-otp') return next();
  const auth = request.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const session = token ? db.prepare('SELECT user_id, email, expires_at FROM sessions WHERE token = ?').get(token) : null;
  if (!session || Date.parse(session.expires_at) <= Date.now()) return next(new InventoryError('Your session has expired. Sign in again.', 401));
  request.session = session;
  request.sessionToken = token;
  next();
});

app.post('/api/auth/logout', (request, response) => { db.prepare('DELETE FROM sessions WHERE token = ?').run(request.sessionToken); response.json({ ok: true }); });
app.get('/api/state', (_request, response) => response.json(readState()));
app.put('/api/state', (request, response, next) => {
  try {
    const parsed = StateWriteSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: zodMessage(parsed.error), details: parsed.error.flatten() });
    response.json(writeState(parsed.data.state, parsed.data.expectedRevision));
  } catch (error) { next(error); }
});
app.post('/api/operations', (request, response, next) => {
  try {
    const parsed = OperationWriteSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: zodMessage(parsed.error), details: parsed.error.flatten() });
    response.json(writeState(saveOperation(parsed.data.state, parsed.data.operation, parsed.data.validate, 'Maya Chen'), parsed.data.expectedRevision));
  } catch (error) { next(error); }
});
app.post('/api/reset', (request, response, next) => {
  try {
    if (!Number.isInteger(request.body?.expectedRevision) || request.body.expectedRevision < 1) throw new InventoryError('A valid revision is required.', 400);
    response.json(writeState(structuredClone(seedState), request.body.expectedRevision));
  } catch (error) { next(error); }
});

const distDir = join(root, 'dist', 'client');
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
