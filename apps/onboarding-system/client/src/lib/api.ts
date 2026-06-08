// Same resolution rules as /sso page (see comment there). Public hostnames
// hit same-origin /api (Cloudflare path-routes to :4080 backend). LAN goes
// to :4080 explicitly (NOT 4020 — that was IT Request, copy-paste leftover).
function resolveApiBase(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4080/api';
  const explicit = process.env.NEXT_PUBLIC_API_URL;
  if (explicit && !explicit.startsWith('http://localhost')) return explicit;
  const host = window.location.hostname;
  const isLan = host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host);
  if (isLan) return `${window.location.protocol}//${host}:4080/api`;
  return `${window.location.origin}/api`;
}
const API_BASE = resolveApiBase();

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(data.message || 'Request failed', res.status);
  }
  return res.json();
}

// Auth
export async function login(email: string, password: string) {
  return fetchApi<{ user: any; tokens: { accessToken: string; refreshToken: string } }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
}

export async function refreshToken(refreshToken: string) {
  return fetchApi<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/refresh', {
    method: 'POST', body: JSON.stringify({ refreshToken }),
  });
}

export async function logout(token: string) {
  return fetchApi('/auth/logout', { method: 'POST', token });
}

export async function getMe(token: string) {
  return fetchApi<any>('/auth/me', { token });
}

export async function getTestUsers() {
  return fetchApi<{ email: string; name: string; role: string }[]>('/auth/test-users');
}

export async function getTestRoles() {
  return fetchApi<{ email: string; name: string; role: string }[]>('/auth/test-roles');
}

export async function testLogin(role: string) {
  return fetchApi<{ user: any; tokens: { accessToken: string; refreshToken: string } }>(
    '/auth/test-login',
    { method: 'POST', body: JSON.stringify({ role }) }
  );
}

// Tickets
export async function createTicket(token: string, data: any) {
  return fetchApi<any>('/tickets', { method: 'POST', body: JSON.stringify(data), token });
}

export async function getTickets(token: string, params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchApi<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>(`/tickets${query}`, { token });
}

export async function getTicket(token: string, id: number) {
  return fetchApi<any>(`/tickets/${id}`, { token });
}

export async function updateTicket(token: string, id: number, data: any) {
  return fetchApi<any>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data), token });
}

export async function managerReview(token: string, id: number, data: { decision: string; notes?: string }) {
  return fetchApi<any>(`/tickets/${id}/manager-review`, { method: 'POST', body: JSON.stringify(data), token });
}

export async function submitOnboardingDetails(token: string, id: number, data: any) {
  return fetchApi<any>(`/tickets/${id}/onboarding-details`, { method: 'POST', body: JSON.stringify(data), token });
}

export async function itReview(token: string, id: number, data: { decision: string; notes?: string }) {
  return fetchApi<any>(`/tickets/${id}/it-review`, { method: 'POST', body: JSON.stringify(data), token });
}

// v2 onboarding flow — HR adds identity then ticket goes to it_close.
export async function hrFill(token: string, id: number, data: {
  full_name: string;
  preferred_name?: string;
  employee_number: string;
  badge_number: string;
  start_date_request?: string;
  personal_email?: string;
  phone?: string;
  hr_notes?: string;
}) {
  return fetchApi<any>(`/tickets/${id}/hr-fill`, { method: 'POST', body: JSON.stringify(data), token });
}

export async function setStartDate(token: string, id: number, data: { start_date: string }) {
  return fetchApi<any>(`/tickets/${id}/set-start-date`, { method: 'POST', body: JSON.stringify(data), token });
}

export async function itClose(token: string, id: number, data: { decision: string; notes?: string }) {
  return fetchApi<any>(`/tickets/${id}/it-close`, { method: 'POST', body: JSON.stringify(data), token });
}

export async function hrConfirm(token: string, id: number, data: { note: string }) {
  return fetchApi<any>(`/tickets/${id}/hr-confirm`, { method: 'POST', body: JSON.stringify(data), token });
}
export async function hrSearchUpdate(token: string, id: number, data: { search_status: string }) {
  return fetchApi<any>(`/tickets/${id}/hr-search-update`, { method: 'POST', body: JSON.stringify(data), token });
}

export interface Ping {
  id: number;
  ticket_id: number;
  to_role: string;
  message: string;
  status: string;
  created_at: string;
  request_number?: string;
  ticket_title?: string;
  from_name?: string;
}
export async function createPing(token: string, data: { ticket_id: number; to_role: string; message: string }) {
  return fetchApi<Ping>('/pings', { method: 'POST', body: JSON.stringify(data), token });
}
export async function getMyPings(token: string): Promise<Ping[]> {
  return fetchApi<Ping[]>('/pings/mine', { token });
}
export async function resolvePing(token: string, id: number) {
  return fetchApi<any>(`/pings/${id}/resolve`, { method: 'POST', token });
}

export async function updateTicketStatus(token: string, id: number, data: { status: string; comment?: string }) {
  return fetchApi<any>(`/tickets/${id}/status`, { method: 'PATCH', body: JSON.stringify(data), token });
}

export async function cancelTicket(token: string, id: number) {
  return fetchApi<any>(`/tickets/${id}/cancel`, { method: 'POST', token });
}

export async function deleteTicket(token: string, id: number) {
  return fetchApi<{ message: string; id: number }>(`/tickets/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function addComment(token: string, id: number, comment: string, isInternal = false) {
  return fetchApi<any>(`/tickets/${id}/comments`, {
    method: 'POST', body: JSON.stringify({ comment, is_internal: isInternal }), token,
  });
}

// Back-compat aliases (so old imports don't break during the rename roll-out)
export const createRequest = createTicket;
export const getRequests = getTickets;
export const getRequest = getTicket;
export const updateRequestStatus = updateTicketStatus;
export const cancelRequest = cancelTicket;

// Dashboard
export async function getDashboard(token: string) {
  return fetchApi<any>('/dashboard', { token });
}

// Categories
export async function getCategories(token: string) {
  return fetchApi<{ id: number; name: string; color: string; icon?: string }[]>('/categories', { token });
}

// Users
export async function getUsers(token: string) {
  return fetchApi<any[]>('/users', { token });
}

export async function getManagers(token: string) {
  // Pulled from the Employee Tech Doc directory via a server-side proxy,
  // so the autocomplete reflects the real "who works at NYCOA" list rather
  // than this app's local users table (which only has people who've SSO'd
  // in or been auto-provisioned).
  return fetchApi<{ id: number; name: string; email: string; title?: string | null; department?: string | null }[]>(
    '/directory/employees',
    { token }
  );
}

export async function getAssignableUsers(token: string) {
  return fetchApi<{ id: number; name: string; email: string }[]>('/users/assignable', { token });
}

// Departments
export async function getDepartments(token: string) {
  return fetchApi<any[]>('/departments', { token });
}

// Lookups (canonical NYCOA department + job-title catalog from Employee Tech Doc)
export interface LookupDepartment {
  id: number;
  name: string;
  sort_order: number;
}
export interface LookupJobTitle {
  id: number;
  label: string;
  key: string;
  department_id: number;
  department_name: string;
  sort_order: number;
}
export async function getLookupDepartments(token: string) {
  return fetchApi<LookupDepartment[]>('/lookups/departments', { token });
}
export async function getLookupJobTitles(token: string) {
  return fetchApi<LookupJobTitle[]>('/lookups/job-titles', { token });
}

export interface DistributionGroup {
  id: number;
  display_name: string;
  mail: string | null;
}
export async function getDistributionGroups(token: string): Promise<DistributionGroup[]> {
  const data = await fetchApi<{ distribution_groups: any[] }>('/lookups/distribution-groups', { token });
  return (data.distribution_groups || [])
    .map((g) => ({ id: g.id, display_name: g.display_name, mail: g.mail ?? null }))
    .filter((g: DistributionGroup) => !!g.mail);
}

export { ApiError };
