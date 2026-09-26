import { AppStateSchema, LoginSchema, OtpRequestSchema, StatePayloadSchema, OperationPayloadSchema } from '../src/domain.js';
import { saveOperation } from '../src/inventory.js';
import { SEED_STATE } from '../src/store.js';

const DEMO_USERS = {
  'inventory@stocksense.demo': { id: 'usr-demo-inventory', name: 'Inventory Manager', role: 'Inventory Manager', workspace: 'StockSense Demo' },
  'warehouse@stocksense.demo': { id: 'usr-demo-warehouse', name: 'Warehouse Operator', role: 'Warehouse Operator', workspace: 'StockSense Demo' },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

async function ensureDbInitialized(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_state (
      id INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL
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

  const existing = await db.prepare('SELECT id FROM workspace_state WHERE id = 1').first();
  if (!existing) {
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO workspace_state (id, payload, revision, updated_at)
      VALUES (1, ?, 1, ?)
    `).bind(JSON.stringify(SEED_STATE), now).run();
  }
}

async function getWorkspaceSnapshot(db) {
  const row = await db.prepare('SELECT id, payload, revision, updated_at FROM workspace_state WHERE id = 1').first();
  if (!row) throw new Error('Workspace state not found');
  return {
    state: JSON.parse(row.payload),
    revision: Number(row.revision),
    updatedAt: row.updated_at,
  };
}

async function updateWorkspaceSnapshot(db, newState, expectedRevision) {
  const validated = AppStateSchema.parse(newState);
  const current = await getWorkspaceSnapshot(db);

  if (expectedRevision !== undefined && expectedRevision !== null && Number(expectedRevision) !== current.revision) {
    const conflictErr = new Error(`Revision conflict. Expected revision ${expectedRevision}, but server revision is ${current.revision}`);
    conflictErr.statusCode = 409;
    throw conflictErr;
  }

  const nextRevision = current.revision + 1;
  const now = new Date().toISOString();

  await db.prepare(`
    UPDATE workspace_state
    SET payload = ?, revision = ?, updated_at = ?
    WHERE id = 1
  `).bind(JSON.stringify(validated), nextRevision, now).run();

  return {
    state: validated,
    revision: nextRevision,
    updatedAt: now,
  };
}

async function verifyAuth(request, db) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();

  const session = await db.prepare('SELECT token, user_id, email, role, expires_at FROM sessions WHERE token = ?').bind(token).first();
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }

  return {
    id: session.user_id,
    email: session.email,
    role: session.role,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return jsonResponse({ ok: true });
    }

    // Health check
    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', runtime: 'edge-worker-d1', time: new Date().toISOString() });
    }

    if (!env.DB) {
      return jsonResponse({ error: 'Database binding (DB) not configured.' }, 500);
    }

    await ensureDbInitialized(env.DB);

    // Auth Login
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const parsed = LoginSchema.parse(body);
        const email = parsed.email.toLowerCase().trim();
        const demoUser = DEMO_USERS[email];
        if (!demoUser || parsed.password !== 'demo1234') {
          return jsonResponse({ error: 'Invalid email or password.' }, 401);
        }
        const token = crypto.randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
        const { id: userId, name, role, workspace } = demoUser;

        await env.DB.prepare(`
          INSERT INTO sessions (token, user_id, email, role, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(token, userId, email, role, now.toISOString(), expiresAt).run();

        return jsonResponse({
          token,
          expiresAt,
          user: { id: userId, email, name, role, workspace },
        });
      } catch (err) {
        return jsonResponse({ error: err.message }, 400);
      }
    }

    // Prototype OTP
    if (url.pathname === '/api/auth/request-otp' && request.method === 'POST') {
      return jsonResponse({ sent: true, prototypeOtp: '482913', expiresInSeconds: 600 });
    }

    // Protected Routes
    const user = await verifyAuth(request, env.DB);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized. Valid Bearer token required.' }, 401);
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.slice(7).trim();
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      }
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/state' && request.method === 'GET') {
      try {
        const snapshot = await getWorkspaceSnapshot(env.DB);
        return jsonResponse(snapshot);
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    if (url.pathname === '/api/state' && request.method === 'PUT') {
      try {
        const body = await request.json();
        const { state, expectedRevision } = StatePayloadSchema.parse(body);
        const updated = await updateWorkspaceSnapshot(env.DB, state, expectedRevision);
        return jsonResponse(updated);
      } catch (err) {
        return jsonResponse({ error: err.message }, err.statusCode || 500);
      }
    }

    if (url.pathname === '/api/operations' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { state, operation, validate, expectedRevision } = OperationPayloadSchema.parse(body);
        if (user.role === 'Warehouse Operator' && operation.type === 'Receipt') {
          return jsonResponse({ error: 'Warehouse Staff cannot post incoming receipts.' }, 403);
        }
        const actorName = `${user.role} (${user.email})`;
        const nextState = saveOperation(state, operation, validate, actorName);
        const updated = await updateWorkspaceSnapshot(env.DB, nextState, expectedRevision);
        return jsonResponse(updated);
      } catch (err) {
        return jsonResponse({ error: err.message }, err.statusCode || 500);
      }
    }

    if (url.pathname === '/api/reset' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const updated = await updateWorkspaceSnapshot(env.DB, SEED_STATE, body.expectedRevision);
        return jsonResponse(updated);
      } catch (err) {
        return jsonResponse({ error: err.message }, err.statusCode || 500);
      }
    }

    return jsonResponse({ error: 'Endpoint not found' }, 404);
  },
};
