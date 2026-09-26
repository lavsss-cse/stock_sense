// Drizzle / SQL Schema Reference for Workspace State & Sessions

export interface WorkspaceStateRow {
  id: number;
  payload: string; // JSON serialized AppState
  revision: number;
  updated_at: string;
}

export interface SessionRow {
  token: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}
