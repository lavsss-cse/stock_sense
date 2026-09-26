import { LoginSchema, StateEnvelopeSchema } from './domain.js';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}, schema) {
  const token = sessionStorage.getItem('stocksense-token');
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.message || `Request failed (${response.status}).`, response.status, payload.details);
  return schema ? schema.parse(payload) : payload;
}

export const api = {
  async login(email, password) {
    const credentials = LoginSchema.parse({ email, password });
    return request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
  },
  requestOtp(email) {
    return request('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ email }) });
  },
  logout() {
    return request('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  },
  getState() {
    return request('/api/state', {}, StateEnvelopeSchema);
  },
  saveState(state, expectedRevision) {
    return request('/api/state', { method: 'PUT', body: JSON.stringify({ state, expectedRevision }) }, StateEnvelopeSchema);
  },
  saveOperation(state, operation, validate, expectedRevision) {
    return request('/api/operations', { method: 'POST', body: JSON.stringify({ state, operation, validate, expectedRevision }) }, StateEnvelopeSchema);
  },
  reset(expectedRevision) {
    return request('/api/reset', { method: 'POST', body: JSON.stringify({ expectedRevision }) }, StateEnvelopeSchema);
  },
};
