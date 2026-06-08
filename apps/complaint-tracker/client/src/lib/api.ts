// API base resolution: behind a reverse proxy (public hostname) the API is
// reached same-origin at /api; in local dev it's on the server port directly.
function resolveApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL;
  if (explicit && !explicit.startsWith('http://localhost')) return explicit;
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return `${protocol}//${hostname}:4010/api`;
    return `${protocol}//${hostname}${port ? `:${port}` : ''}/api`;
  }
  return 'http://localhost:4010/api';
}

const API_URL = resolveApiBase();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || 'Request failed', body.details);
  }

  return res.json();
}

function getToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = localStorage.getItem('complaint_auth');
    if (stored) {
      const { accessToken } = JSON.parse(stored);
      return accessToken;
    }
  } catch {}
  return undefined;
}

// Auth
export const authApi = {
  getTestUsers: () => fetchApi<any[]>('/auth/test-users'),
  login: (email: string, password: string) =>
    fetchApi<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  refresh: (refreshToken: string) =>
    fetchApi<any>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
  logout: () =>
    fetchApi('/auth/logout', { method: 'POST' }, getToken()),
  me: () => fetchApi<any>('/auth/me', {}, getToken()),
};

// Complaints
export const complaintApi = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString() : '';
    return fetchApi<any>(`/complaints${qs}`, {}, getToken());
  },
  get: (id: number) => fetchApi<any>(`/complaints/${id}`, {}, getToken()),
  create: (data: any) =>
    fetchApi<any>('/complaints', {
      method: 'POST',
      body: JSON.stringify(data),
    }, getToken()),
  update: (id: number, data: any) =>
    fetchApi<any>(`/complaints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, getToken()),
  transition: (id: number, data: { status: string; comment?: string }) =>
    fetchApi<any>(`/complaints/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, getToken()),
  addComment: (id: number, comment: string) =>
    fetchApi<any>(`/complaints/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }, getToken()),
  assign: (id: number, assigned_to: number | null) =>
    fetchApi<any>(`/complaints/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assigned_to }),
    }, getToken()),
};

// Dashboard
export const dashboardApi = {
  getPublic: () => fetchApi<any>('/dashboard/public'),
  get: () => fetchApi<any>('/dashboard', {}, getToken()),
};

// Users
export const userApi = {
  list: () => fetchApi<any[]>('/users', {}, getToken()),
  create: (data: any) =>
    fetchApi<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }, getToken()),
  update: (id: number, data: any) =>
    fetchApi<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, getToken()),
};

// Audit
export const auditApi = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString() : '';
    return fetchApi<any>(`/audit${qs}`, {}, getToken());
  },
};

// Attachments
export const attachmentApi = {
  upload: (complaintId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi<any>(`/attachments/${complaintId}`, {
      method: 'POST',
      body: formData,
    }, getToken());
  },
  getDownloadUrl: (id: number) => `${API_URL}/attachments/${id}/download`,
  delete: (id: number) =>
    fetchApi<any>(`/attachments/${id}`, { method: 'DELETE' }, getToken()),
};
