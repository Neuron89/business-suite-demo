import type { AuthLoginResponse, HomeFeed, AdminOnboardingItem } from '@portal/shared';

/**
 * API base URL resolution:
 * - In the browser, default to the same host the page came from on port 4070.
 *   That makes the portal Just Work whether you visit `localhost:3070` or
 *   the LAN IP `192.168.168.47:3070` without re-baking the bundle.
 * - On the server (SSR / next build), fall back to NEXT_PUBLIC_API_URL or
 *   localhost — server code can always reach itself locally.
 */
function resolveApiBase(): string {
  if (typeof window !== 'undefined') {
    const explicit = process.env.NEXT_PUBLIC_API_URL;
    if (explicit && !explicit.startsWith('http://localhost')) return explicit;
    const proto = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port;
    // Dev: page is on the Next dev port (3070), API is on 4070 directly.
    if (port === '3070') return `${proto}//${host}:4070`;
    // Behind nginx (https on 443 / http on 80 / a fronted hostname) — the API
    // is reachable on the same origin via the /api path.
    return `${proto}//${host}${port ? ':' + port : ''}`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4070';
}

export const API_URL = resolveApiBase();

async function jsonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await resp.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }
  if (!resp.ok) {
    const msg = body?.message || `Request failed (${resp.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export function login(email: string, password: string): Promise<AuthLoginResponse> {
  return jsonRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export type DemoRole = 'it' | 'hr' | 'manager' | 'employee';

export function loginDemo(role: DemoRole): Promise<AuthLoginResponse> {
  return jsonRequest('/api/auth/demo', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

export function forgot(email: string): Promise<{ message: string }> {
  return jsonRequest('/api/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function reset(token: string, password: string): Promise<{ message: string }> {
  return jsonRequest('/api/auth/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export function setPassword(token: string, password: string): Promise<{ message: string }> {
  return jsonRequest('/api/auth/set-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getMe(token: string): Promise<{ employee: any }> {
  return jsonRequest('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getHomeFeed(token: string): Promise<HomeFeed> {
  return jsonRequest('/api/home/feed', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getOnboardingQueue(
  token: string
): Promise<{ items: AdminOnboardingItem[]; note?: string }> {
  return jsonRequest('/api/admin/onboarding-queue', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getAdminEmployees(token: string): Promise<{ employees: any[] }> {
  return jsonRequest('/api/admin/employees', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function patchAdminAccess(
  token: string,
  payload: {
    email: string;
    access?: Record<string, boolean>;
    portal_role?: 'employee' | 'manager' | 'hr' | 'admin';
  }
): Promise<{ employee: any }> {
  return jsonRequest('/api/admin/employees/access', {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Announcements ────────────────────────────────────────────────────────
export function listAnnouncements(token: string): Promise<{ announcements: any[] }> {
  return jsonRequest('/api/announcements', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function createAnnouncement(token: string, payload: any): Promise<{ announcement: any }> {
  return jsonRequest('/api/announcements', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function ackAnnouncement(token: string, id: number): Promise<{ acknowledged: boolean }> {
  return jsonRequest(`/api/announcements/${id}/ack`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function deleteAnnouncement(token: string, id: number): Promise<{ deleted: boolean }> {
  return jsonRequest(`/api/announcements/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Suggestions ──────────────────────────────────────────────────────────
export function listSuggestions(token: string): Promise<{ suggestions: any[] }> {
  return jsonRequest('/api/suggestions', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function createSuggestion(token: string, payload: any): Promise<{ suggestion: any }> {
  return jsonRequest('/api/suggestions', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function patchSuggestion(token: string, id: number, payload: any): Promise<{ suggestion: any }> {
  return jsonRequest(`/api/suggestions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Training ─────────────────────────────────────────────────────────────
export function listTrainingItems(token: string): Promise<{ items: any[] }> {
  return jsonRequest('/api/training/items', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function createTrainingItem(token: string, payload: any): Promise<{ item: any }> {
  return jsonRequest('/api/training/items', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function listTrainingAssignments(
  token: string,
  email?: string
): Promise<{ assignments: any[] }> {
  const path = email ? `/api/training/assignments?email=${encodeURIComponent(email)}` : '/api/training/assignments';
  return jsonRequest(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function assignTraining(
  token: string,
  payload: { training_item_id: number; employee_emails: string[]; due_date?: string | null }
): Promise<{ assignments: any[] }> {
  return jsonRequest('/api/training/assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function completeTraining(token: string, id: number): Promise<{ assignment: any }> {
  return jsonRequest(`/api/training/assignments/${id}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function getTrainingRoster(token: string): Promise<{ employees: any[] }> {
  return jsonRequest('/api/training/roster', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Dashboard ────────────────────────────────────────────────────────────
export function getDashboardSummary(token: string): Promise<any> {
  return jsonRequest('/api/dashboard/summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Todos ────────────────────────────────────────────────────────────────
export function listTodos(token: string): Promise<{ todos: any[] }> {
  return jsonRequest('/api/todos', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function createTodo(token: string, payload: any): Promise<{ todo: any }> {
  return jsonRequest('/api/todos', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function patchTodo(token: string, id: number, payload: any): Promise<{ todo: any }> {
  return jsonRequest(`/api/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function deleteTodo(token: string, id: number): Promise<{ deleted: boolean }> {
  return jsonRequest(`/api/todos/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Banner ───────────────────────────────────────────────────────────────
export interface BannerItem {
  kind: 'announcement' | 'birthday' | 'holiday';
  title: string;
  subtitle?: string;
  date?: string;
  severity?: 'info' | 'warning' | 'critical';
}
export function getBanner(token: string): Promise<{ items: BannerItem[] }> {
  return jsonRequest('/api/banner', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Holidays ─────────────────────────────────────────────────────────────
export interface Holiday {
  id: number;
  name: string;
  date: string;
  kind: 'federal' | 'company';
  created_by: string | null;
}
export function listHolidays(token: string): Promise<{ holidays: Holiday[] }> {
  return jsonRequest('/api/holidays', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function createHoliday(
  token: string,
  payload: { name: string; date: string; kind?: 'federal' | 'company' }
): Promise<{ holiday: Holiday }> {
  return jsonRequest('/api/holidays', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}
export function deleteHoliday(token: string, id: number): Promise<{ deleted: number }> {
  return jsonRequest(`/api/holidays/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── SSO ──────────────────────────────────────────────────────────────────
export function getSsoRedirect(
  token: string,
  moduleKey: string,
  next: string = '/'
): Promise<{ redirect_url: string }> {
  const url = `/api/sso/${encodeURIComponent(moduleKey)}?next=${encodeURIComponent(next)}`;
  return jsonRequest(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
