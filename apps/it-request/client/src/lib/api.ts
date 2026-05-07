const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:4020/api` : 'http://localhost:4020/api');

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

export async function getManagers() {
  return fetchApi<{ id: number; name: string; email: string }[]>('/users/managers');
}

export async function getAssignableUsers(token: string) {
  return fetchApi<{ id: number; name: string; email: string }[]>('/users/assignable', { token });
}

// Departments
export async function getDepartments(token: string) {
  return fetchApi<any[]>('/departments', { token });
}

export { ApiError };
