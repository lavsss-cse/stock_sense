import { AppStateSchema } from './domain.js';

const SESSION_TOKEN_KEY = 'stocksense-token';
const SESSION_USER_KEY = 'stocksense-session';

/**
 * Retrieves the stored auth token
 */
export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

/**
 * Retrieves the stored user session
 */
export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(SESSION_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Saves auth token and user to session storage
 */
export function setStoredSession(token, user) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
}

/**
 * Clears stored auth session
 */
export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
}

/**
 * Core HTTP fetch wrapper with authorization headers, error handling, and JSON parsing
 */
async function request(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const error = new Error((data && data.error) || response.statusText || 'Request failed');
    error.status = response.status;
    error.statusCode = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  async health() {
    return request('/api/health');
  },

  async login(email, password) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token && res.user) {
      setStoredSession(res.token, res.user);
    }
    return res;
  },

  async signup(name, workspace, email, password) {
    const res = await request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, workspace, email, password }),
    });
    if (res.token && res.user) {
      setStoredSession(res.token, res.user);
    }
    return res;
  },

  async requestOtp(email) {
    return request('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(email, otp, password) {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, password }),
    });
  },

  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      clearStoredSession();
    }
    return { ok: true };
  },

  async getState() {
    const res = await request('/api/state');
    const validatedState = AppStateSchema.parse(res.state);
    return {
      state: validatedState,
      revision: res.revision,
      updatedAt: res.updatedAt,
    };
  },

  async putState(state, expectedRevision) {
    AppStateSchema.parse(state);
    const res = await request('/api/state', {
      method: 'PUT',
      body: JSON.stringify({ state, expectedRevision }),
    });
    return {
      state: AppStateSchema.parse(res.state),
      revision: res.revision,
      updatedAt: res.updatedAt,
    };
  },

  async postOperation(state, operation, validate = true, expectedRevision) {
    const res = await request('/api/operations', {
      method: 'POST',
      body: JSON.stringify({ state, operation, validate, expectedRevision }),
    });
    return {
      state: AppStateSchema.parse(res.state),
      revision: res.revision,
      updatedAt: res.updatedAt,
    };
  },

  async reset(expectedRevision) {
    const res = await request('/api/reset', {
      method: 'POST',
      body: JSON.stringify({ expectedRevision }),
    });
    return {
      state: AppStateSchema.parse(res.state),
      revision: res.revision,
      updatedAt: res.updatedAt,
    };
  },
};
