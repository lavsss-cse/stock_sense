import page from 'virtual:stocksense-html';
import favicon from 'virtual:stocksense-favicon';
import { LoginSchema, OperationWriteSchema, StateWriteSchema, zodMessage } from '../src/domain.js';
import { InventoryError, saveOperation } from '../src/inventory.js';
import { seedState } from '../src/store.js';

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: jsonHeaders }); }
async function body(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 5_000_000) throw new InventoryError('Request body is too large.', 413);
  try { return await request.json(); } catch { throw new InventoryError('Request body must be valid JSON.', 400); }
}
async function ensureState(db) {
  const now = new Date().toISOString();
  await db.prepare('INSERT OR IGNORE INTO workspace_state (id, payload, revision, updated_at) VALUES (1, ?, 1, ?)').bind(JSON.stringify(seedState), now).run();
}
async function readState(db) {
  await ensureState(db);
  const row = await db.prepare('SELECT payload, revision, updated_at FROM workspace_state WHERE id = 1').first();
  return { state: JSON.parse(row.payload), revision: row.revision, updatedAt: row.updated_at };
}
async function writeState(db, state, expectedRevision) {
  const updatedAt = new Date().toISOString();
  const result = await db.prepare('UPDATE workspace_state SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?').bind(JSON.stringify(state), updatedAt, expectedRevision).run();
  if (!result.meta?.changes) throw new InventoryError('Inventory changed in another session. Refresh and try again.', 409);
  return { state, revision: expectedRevision + 1, updatedAt };
}
function bearer(request) {
  const value = request.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}
async function requireSession(request, env) {
  const token = bearer(request);
  if (!token) throw new InventoryError('Your session has expired. Sign in again.', 401);
  const session = await env.DB.prepare('SELECT user_id, email, expires_at FROM sessions WHERE token = ?').bind(token).first();
  if (!session || Date.parse(session.expires_at) <= Date.now()) throw new InventoryError('Your session has expired. Sign in again.', 401);
  return session;
}
function userName(request, session) {
  const encoded = request.headers.get('oai-authenticated-user-full-name');
  if (encoded) { try { return decodeURIComponent(encoded); } catch { return encoded; } }
  return session.email.split('@')[0];
}
async function api(request, env, path) {
  if (!env.DB) throw new InventoryError('The StockSense database binding is unavailable.', 503);
  if (path === '/api/health' && request.method === 'GET') return json({ status: 'ok', database: 'connected', validation: 'zod', timestamp: new Date().toISOString() });
  if (path === '/api/auth/login' && request.method === 'POST') {
    const parsed = LoginSchema.safeParse(await body(request));
    if (!parsed.success) return json({ message: zodMessage(parsed.error), details: parsed.error.flatten() }, 400);
    const token = crypto.randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 12 * 60 * 60 * 1000);
    const forwardedId = request.headers.get('oai-authenticated-user-id') || `demo:${parsed.data.email}`;
    const forwardedEmail = request.headers.get('oai-authenticated-user-email') || parsed.data.email;
    await env.DB.prepare('INSERT INTO sessions (token, user_id, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(token, forwardedId, forwardedEmail.toLowerCase(), createdAt.toISOString(), expiresAt.toISOString()).run();
    return json({ token, expiresAt: expiresAt.toISOString(), user: { name: userName(request, { email: forwardedEmail }), email: forwardedEmail, role: 'Inventory Manager', workspace: 'Arbor & Co.' } });
  }
  const session = await requireSession(request, env);
  if (path === '/api/auth/logout' && request.method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(bearer(request)).run();
    return json({ ok: true });
  }
  if (path === '/api/state' && request.method === 'GET') return json(await readState(env.DB));
  if (path === '/api/state' && request.method === 'PUT') {
    const parsed = StateWriteSchema.safeParse(await body(request));
    if (!parsed.success) return json({ message: zodMessage(parsed.error), details: parsed.error.flatten() }, 400);
    return json(await writeState(env.DB, parsed.data.state, parsed.data.expectedRevision));
  }
  if (path === '/api/operations' && request.method === 'POST') {
    const parsed = OperationWriteSchema.safeParse(await body(request));
    if (!parsed.success) return json({ message: zodMessage(parsed.error), details: parsed.error.flatten() }, 400);
    const next = saveOperation(parsed.data.state, parsed.data.operation, parsed.data.validate, userName(request, session));
    return json(await writeState(env.DB, next, parsed.data.expectedRevision));
  }
  if (path === '/api/reset' && request.method === 'POST') {
    const payload = await body(request);
    if (!Number.isInteger(payload.expectedRevision) || payload.expectedRevision < 1) throw new InventoryError('A valid revision is required.', 400);
    return json(await writeState(env.DB, structuredClone(seedState), payload.expectedRevision));
  }
  return json({ message: 'API route not found.' }, 404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(request, env, url.pathname);
      if (url.pathname === '/favicon.svg') return new Response(favicon, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
      return new Response(request.method === 'HEAD' ? null : page, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' } });
    } catch (error) {
      if (error instanceof InventoryError) return json({ message: error.message }, error.status);
      console.error(error);
      return json({ message: 'The StockSense service could not complete this request.' }, 500);
    }
  },
};
