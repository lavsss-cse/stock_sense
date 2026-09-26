import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { SEED_STATE } from './src/store.js';
import { AppStateSchema, LoginSchema, SignupSchema, OtpRequestSchema, ResetPasswordSchema, StatePayloadSchema, OperationPayloadSchema } from './src/domain.js';
import { saveOperation } from './src/inventory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'stocksense.db');
const db = new DatabaseSync(DB_PATH);

const DEMO_USERS = [
  {
    id: 'usr-demo-inventory',
    email: 'inventory@stocksense.demo',
    name: 'Inventory Manager',
    workspace: 'StockSense Demo',
    role: 'Inventory Manager',
    password: 'demo1234',
  },
  {
    id: 'usr-demo-warehouse',
    email: 'warehouse@stocksense.demo',
    name: 'Warehouse Operator',
    workspace: 'StockSense Demo',
    role: 'Warehouse Operator',
    password: 'demo1234',
  },
];

// Setup database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS workspace_state (
    id INTEGER PRIMARY KEY,
    payload TEXT NOT NULL,
    revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    workspace TEXT NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
`);

// Add the two always-available demo personas once. Existing user accounts are
// intentionally left alone, so a restart never overwrites a real password.
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

for (const demoUser of DEMO_USERS) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(demoUser.email);
  if (!existing) {
    const salt = crypto.randomBytes(16).toString('hex');
    db.prepare(`
      INSERT INTO users (id, email, name, workspace, role, password_hash, salt, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      demoUser.id, demoUser.email, demoUser.name, demoUser.workspace, demoUser.role,
      hashPassword(demoUser.password, salt), salt, new Date().toISOString(),
    );
  }
}

// Seed initial state if empty
const stateCheck = db.prepare('SELECT id, payload, revision, updated_at FROM workspace_state WHERE id = 1').get();
if (!stateCheck) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO workspace_state (id, payload, revision, updated_at)
    VALUES (1, ?, 1, ?)
  `).run(JSON.stringify(SEED_STATE), now);
  console.log('StockSense database initialized with SEED_STATE.');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper: Get active state snapshot
function getWorkspaceSnapshot() {
  const row = db.prepare('SELECT id, payload, revision, updated_at FROM workspace_state WHERE id = 1').get();
  if (!row) {
    throw new Error('Workspace state not found');
  }
  return {
    state: JSON.parse(row.payload),
    revision: Number(row.revision),
    updatedAt: row.updated_at,
  };
}

// Helper: Update workspace state with revision check
function updateWorkspaceSnapshot(newState, expectedRevision) {
  const validated = AppStateSchema.parse(newState);
  const current = getWorkspaceSnapshot();

  if (expectedRevision !== undefined && expectedRevision !== null && Number(expectedRevision) !== current.revision) {
    const conflictErr = new Error(`Revision conflict. Client expected revision ${expectedRevision} but server is at revision ${current.revision}.`);
    conflictErr.statusCode = 409;
    conflictErr.code = 'REVISION_CONFLICT';
    throw conflictErr;
  }

  const nextRevision = current.revision + 1;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE workspace_state
    SET payload = ?, revision = ?, updated_at = ?
    WHERE id = 1
  `).run(JSON.stringify(validated), nextRevision, now);

  return {
    state: validated,
    revision: nextRevision,
    updatedAt: now,
  };
}

// Auth Middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.slice(7).trim();
  const session = db.prepare('SELECT token, user_id, email, role, expires_at FROM sessions WHERE token = ?').get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  req.user = {
    id: session.user_id,
    email: session.email,
    role: session.role,
  };
  next();
}

// --- Routes ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'stocksense-core-api',
    time: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Auth Signup
app.post('/api/auth/signup', (req, res) => {
  const parseResult = SignupSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid signup data.', details: parseResult.error.format() });
  }
  const { name, workspace, email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Email already exists.' });
  }

  const userId = `usr-${crypto.randomBytes(4).toString('hex')}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const role = 'Manager';

  db.prepare(`
    INSERT INTO users (id, email, name, workspace, role, password_hash, salt, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, normalizedEmail, name, workspace, role, passwordHash, salt, new Date().toISOString());

  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO sessions (token, user_id, email, role, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(token, userId, normalizedEmail, role, now.toISOString(), expiresAt);

  res.json({ token, expiresAt, user: { id: userId, email: normalizedEmail, name, role, workspace } });
});

// Auth Login
app.post('/api/auth/login', (req, res) => {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid email or password format (min 6 chars).' });
  }
  const { email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  const user = db.prepare('SELECT id, name, role, workspace, password_hash, salt FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const hash = hashPassword(password, user.salt);
  if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.password_hash, 'hex'))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (token, user_id, email, role, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(token, user.id, normalizedEmail, user.role, now.toISOString(), expiresAt);

  res.json({ token, expiresAt, user: { id: user.id, email: normalizedEmail, name: user.name, role: user.role, workspace: user.workspace } });
});

// Auth Request OTP (Prototype demo endpoint)
app.post('/api/auth/request-otp', (req, res) => {
  const parseResult = OtpRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Valid email required for OTP request.' });
  }
  res.json({
    sent: true,
    prototypeOtp: '482913',
    expiresInSeconds: 600,
    message: 'Prototype demo OTP generated: 482913',
  });
});

// Demo password reset. Production deployments should replace the fixed demo
// code with a short-lived, email-delivered token.
app.post('/api/auth/reset-password', (req, res) => {
  const parseResult = ResetPasswordSchema.safeParse(req.body);
  if (!parseResult.success) return res.status(400).json({ error: 'Enter a valid email, six-digit reset code, and password.' });
  const { email, otp, password } = parseResult.data;
  if (otp !== '482913') return res.status(400).json({ error: 'Invalid reset code.' });
  const normalizedEmail = email.toLowerCase().trim();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) return res.status(404).json({ error: 'No account exists for that email.' });
  const salt = crypto.randomBytes(16).toString('hex');
  db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE email = ?').run(hashPassword(password, salt), salt, normalizedEmail);
  db.prepare('DELETE FROM sessions WHERE email = ?').run(normalizedEmail);
  res.json({ ok: true, message: 'Password updated. Please sign in.' });
});

// Auth Logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.slice(7).trim();
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ ok: true });
});

// Get Workspace State
app.get('/api/state', requireAuth, (req, res) => {
  try {
    const snapshot = getWorkspaceSnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save State (Debounced ordinary edit)
app.put('/api/state', requireAuth, (req, res) => {
  const parseResult = StatePayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid state structure', details: parseResult.error.format() });
  }

  try {
    const { state, expectedRevision } = parseResult.data;
    const updated = updateWorkspaceSnapshot(state, expectedRevision);
    res.json(updated);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  }
});

// Post Operation (Inventory execution & draft save)
app.post('/api/operations', requireAuth, (req, res) => {
  const parseResult = OperationPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid operation payload', details: parseResult.error.format() });
  }

  try {
    const { state, operation, validate, expectedRevision } = parseResult.data;
    if (req.user.role === 'Warehouse Operator' && operation.type === 'Receipt') {
      return res.status(403).json({ error: 'Warehouse Staff cannot post incoming receipts.' });
    }
    const actorName = req.user.email ? `${req.user.role} (${req.user.email})` : 'Authorized User';
    
    // Apply inventory logic
    const nextState = saveOperation(state, operation, validate, actorName);
    const updated = updateWorkspaceSnapshot(nextState, expectedRevision);
    res.json(updated);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  }
});

// Reset State
app.post('/api/reset', requireAuth, (req, res) => {
  try {
    const expectedRevision = req.body?.expectedRevision;
    const updated = updateWorkspaceSnapshot(SEED_STATE, expectedRevision);
    res.json(updated);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  }
});

// Serve frontend build in production
const CLIENT_DIST = path.join(__dirname, 'dist', 'client');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[StockSense API Server] running on http://127.0.0.1:${PORT}`);
});
