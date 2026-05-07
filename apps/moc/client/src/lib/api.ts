const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:4000/api` : 'http://localhost:4000/api');

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function fetchApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(data.message || 'Request failed', res.status, data.errors);
  }

  return res.json();
}

// ── Auth ────────────────────────────────────────────────────────────────

export async function getTestUsers() {
  return fetchApi<{ email: string; name: string; role: string }[]>('/auth/test-users');
}

export async function login(email: string, password: string) {
  return fetchApi<{
    user: { id: number; email: string; name: string; role: string; is_active: boolean };
    tokens: { accessToken: string; refreshToken: string };
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function refreshToken(refreshToken: string) {
  return fetchApi<{ tokens: { accessToken: string; refreshToken: string } }>(
    '/auth/refresh',
    { method: 'POST', body: JSON.stringify({ refreshToken }) }
  );
}

export async function logout(token: string) {
  return fetchApi('/auth/logout', { method: 'POST', token });
}

export async function getMe(token: string) {
  return fetchApi<{ id: number; email: string; name: string; role: string }>('/auth/me', { token });
}

// ── MOC ─────────────────────────────────────────────────────────────────

export async function getMocs(token: string, params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchApi<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/moc${query}`, { token });
}

export async function getMoc(token: string, id: number) {
  return fetchApi<any>(`/moc/${id}`, { token });
}

export async function getPublicDashboard() {
  return fetchApi<any>('/moc/public');
}

export async function createMoc(token: string, data: any) {
  return fetchApi<any>('/moc', { method: 'POST', body: JSON.stringify(data), token });
}

export async function updateMoc(token: string, id: number, data: any) {
  return fetchApi<any>(`/moc/${id}`, { method: 'PUT', body: JSON.stringify(data), token });
}

export async function saveDraft(token: string, data: any) {
  return fetchApi<any>('/moc/draft', { method: 'POST', body: JSON.stringify(data), token });
}

export async function updateDraft(token: string, id: number, data: any) {
  return fetchApi<any>(`/moc/draft/${id}`, { method: 'PUT', body: JSON.stringify(data), token });
}

export async function submitDraft(token: string, id: number, data: any) {
  return fetchApi<any>(`/moc/${id}/submit`, { method: 'POST', body: JSON.stringify(data), token });
}

export async function getMyDrafts(token: string) {
  return fetchApi<any[]>('/moc/my-drafts', { token });
}

export async function updateMocAdminFields(token: string, id: number, data: { title?: string; moc_number?: string }) {
  return fetchApi<any>(`/moc/${id}`, { method: 'PATCH', body: JSON.stringify(data), token });
}

// ── Workflow ────────────────────────────────────────────────────────────

export async function transitionMoc(token: string, mocId: number, toStatus: string, comment = '') {
  return fetchApi<any>('/workflow/transition', {
    method: 'POST',
    body: JSON.stringify({ moc_id: mocId, to_status: toStatus, comment }),
    token,
  });
}

export async function getWorkflowHistory(token: string, mocId: number) {
  return fetchApi<any[]>(`/workflow/history/${mocId}`, { token });
}

// ── Risk Assessment ─────────────────────────────────────────────────────

export async function getRiskAssessments(token: string, mocId: number) {
  return fetchApi<any[]>(`/risk/${mocId}`, { token });
}

export async function createRiskAssessment(token: string, data: any) {
  return fetchApi<any>('/risk', { method: 'POST', body: JSON.stringify(data), token });
}

export async function updateRiskAssessment(token: string, id: number, data: any) {
  return fetchApi<any>(`/risk/${id}`, { method: 'PUT', body: JSON.stringify(data), token });
}

export async function deleteRiskAssessment(token: string, id: number) {
  return fetchApi<any>(`/risk/${id}`, { method: 'DELETE', token });
}

// ── Reviews ─────────────────────────────────────────────────────────────

export async function submitReview(token: string, data: { moc_id: number; decision: string; comments: string; review_as?: string }) {
  return fetchApi<any>('/review', { method: 'POST', body: JSON.stringify(data), token });
}

export async function getReviews(token: string, mocId: number) {
  return fetchApi<{ approvers: any[]; reviews: any[] }>(`/review/${mocId}`, { token });
}

export async function getApprovers(token: string, mocId: number) {
  return fetchApi<any[]>(`/review/${mocId}/approvers`, { token });
}

export async function addApprover(token: string, mocId: number, data: { user_id: number; role_context: string }) {
  return fetchApi<any>(`/review/${mocId}/approvers`, { method: 'POST', body: JSON.stringify(data), token });
}

export async function removeApprover(token: string, mocId: number, approverId: number) {
  return fetchApi<any>(`/review/${mocId}/approvers/${approverId}`, { method: 'DELETE', token });
}

// ── Review Notes ────────────────────────────────────────────────────────

export async function getReviewNotes(token: string, mocId: number) {
  return fetchApi<any[]>(`/review/${mocId}/notes`, { token });
}

export async function createReviewNote(token: string, data: { moc_id: number; section_id: string; note: string }) {
  return fetchApi<any>('/review/notes', { method: 'POST', body: JSON.stringify(data), token });
}

export async function updateReviewNote(token: string, noteId: number, data: { note?: string; resolved?: boolean }) {
  return fetchApi<any>(`/review/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify(data), token });
}

export async function deleteReviewNote(token: string, noteId: number) {
  return fetchApi<any>(`/review/notes/${noteId}`, { method: 'DELETE', token });
}

// ── PSSR ────────────────────────────────────────────────────────────────

export async function createPssr(token: string, mocId: number) {
  return fetchApi<any>('/pssr', { method: 'POST', body: JSON.stringify({ moc_id: mocId }), token });
}

export async function getPssr(token: string, mocId: number) {
  return fetchApi<any>(`/pssr/${mocId}`, { token });
}

export async function updatePssrItem(token: string, itemId: number, data: { status: string; notes: string; action_resolved?: boolean; action_type?: string; assigned_to?: number | null }) {
  return fetchApi<any>(`/pssr/item/${itemId}`, { method: 'PUT', body: JSON.stringify(data), token });
}

export async function completePssr(token: string, mocId: number) {
  return fetchApi<any>(`/pssr/${mocId}/complete`, { method: 'POST', token });
}

export async function signoffPssr(token: string, mocId: number) {
  return fetchApi<any>(`/pssr/${mocId}/signoff`, { method: 'POST', token });
}

export async function getPssrSignoffs(token: string, mocId: number) {
  return fetchApi<any[]>(`/pssr/${mocId}/signoffs`, { token });
}

export async function exportPssrReport(token: string, mocId: number): Promise<Blob> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:4000/api` : 'http://localhost:4000/api');
  const res = await fetch(`${API_URL}/pssr/${mocId}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

export async function updateMocDepartments(token: string, mocId: number, departments: string[]) {
  return fetchApi<any>(`/moc/${mocId}/departments`, {
    method: 'PUT',
    body: JSON.stringify({ departments_involved: departments }),
    token,
  });
}

// ── DSR ──────────────────────────────────────────────────────────────────

export async function createDsr(token: string, mocId: number) {
  return fetchApi<any>('/dsr', { method: 'POST', body: JSON.stringify({ moc_id: mocId }), token });
}

export async function getDsr(token: string, mocId: number) {
  return fetchApi<any>(`/dsr/${mocId}`, { token });
}

export async function updateDsrItem(token: string, itemId: number, data: { status: string; notes: string; action_resolved?: boolean; assigned_to?: number | null }) {
  return fetchApi<any>(`/dsr/item/${itemId}`, { method: 'PUT', body: JSON.stringify(data), token });
}

export async function completeDsr(token: string, mocId: number) {
  return fetchApi<any>(`/dsr/${mocId}/complete`, { method: 'POST', token });
}

export async function addDsrCustomItem(token: string, mocId: number, data: { description: string; category?: string }) {
  return fetchApi<any>(`/dsr/${mocId}/custom-item`, { method: 'POST', body: JSON.stringify(data), token });
}

export async function signoffDsr(token: string, mocId: number) {
  return fetchApi<any>(`/dsr/${mocId}/signoff`, { method: 'POST', token });
}

export async function getDsrSignoffs(token: string, mocId: number) {
  return fetchApi<any[]>(`/dsr/${mocId}/signoffs`, { token });
}

export async function exportDsrReport(token: string, mocId: number): Promise<Blob> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:4000/api` : 'http://localhost:4000/api');
  const res = await fetch(`${API_URL}/dsr/${mocId}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}

export async function addPssrCustomItem(token: string, mocId: number, data: { description: string; category?: string; action_type?: string }) {
  return fetchApi<any>(`/pssr/${mocId}/custom-item`, { method: 'POST', body: JSON.stringify(data), token });
}

export async function reassignMoc(token: string, mocId: number, newOwnerId: number | null) {
  return fetchApi<any>(`/moc/${mocId}/reassign`, { method: 'PUT', body: JSON.stringify({ new_owner_id: newOwnerId }), token });
}

// ── Action Items ─────────────────────────────────────────────────────────

export async function getMyActionItems(token: string) {
  return fetchApi<any[]>('/moc/my-action-items', { token });
}

// ── Dashboard ───────────────────────────────────────────────────────────

export async function getDashboard(token: string) {
  return fetchApi<any>('/dashboard', { token });
}

export async function getActionItems(token: string, showResolved = false) {
  const query = showResolved ? '?show_resolved=true' : '';
  return fetchApi<any[]>(`/dashboard/action-items${query}`, { token });
}

// ── Users ───────────────────────────────────────────────────────────────

export async function getUsers(token: string) {
  return fetchApi<any[]>('/users', { token });
}

export async function getUserNames(token: string) {
  return fetchApi<any[]>('/users/names', { token });
}

export async function createUser(token: string, data: any) {
  return fetchApi<any>('/users', { method: 'POST', body: JSON.stringify(data), token });
}

export async function updateUser(token: string, id: number, data: any) {
  return fetchApi<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data), token });
}

// ── Audit ───────────────────────────────────────────────────────────────

export async function getAuditLog(token: string, params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchApi<any>(`/audit${query}`, { token });
}

// ── Notifications ───────────────────────────────────────────────────────

export async function getNotifications(token: string) {
  return fetchApi<any[]>('/notifications', { token });
}

export async function markNotificationRead(token: string, id: number) {
  return fetchApi<any>(`/notifications/${id}/read`, { method: 'PUT', token });
}

export async function markAllNotificationsRead(token: string) {
  return fetchApi<any>('/notifications/read-all', { method: 'PUT', token });
}

// ── Attachments ─────────────────────────────────────────────────────────

export async function uploadAttachment(token: string, mocId: number, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/attachments/${mocId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new ApiError(data.message, res.status);
  }

  return res.json();
}

export async function getAttachments(token: string, mocId: number) {
  return fetchApi<any[]>(`/attachments/${mocId}`, { token });
}

export async function deleteAttachment(token: string, id: number) {
  return fetchApi<any>(`/attachments/${id}`, { method: 'DELETE', token });
}

export function getDownloadUrl(id: number): string {
  return `${API_BASE}/attachments/download/${id}`;
}

export function getPreviewUrl(id: number, token: string): string {
  return `${API_BASE}/attachments/preview/${id}?token=${encodeURIComponent(token)}`;
}

// ── System Requests ─────────────────────────────────────────────────────

export async function createSystemRequest(token: string, data: { description: string; screenshot_data?: string | null; page_url: string }) {
  return fetchApi<any>('/system-requests', { method: 'POST', body: JSON.stringify(data), token });
}

export async function getSystemRequests(token: string, status?: string) {
  const query = status ? `?status=${status}` : '';
  return fetchApi<any[]>(`/system-requests${query}`, { token });
}

export async function getSystemRequest(token: string, id: number) {
  return fetchApi<any>(`/system-requests/${id}`, { token });
}

export async function updateSystemRequest(token: string, id: number, data: { status: string; admin_notes?: string }) {
  return fetchApi<any>(`/system-requests/${id}`, { method: 'PUT', body: JSON.stringify(data), token });
}

// ── Templates ──────────────────────────────────────────────────────────

export async function getTemplates(token: string) {
  return fetchApi<any[]>('/templates', { token });
}

export async function getTemplatesAll(token: string) {
  return fetchApi<any[]>('/templates/all', { token });
}

export async function getTemplate(token: string, id: number) {
  return fetchApi<any>(`/templates/${id}`, { token });
}

export async function createTemplate(token: string, data: any) {
  return fetchApi<any>('/templates', { method: 'POST', body: JSON.stringify(data), token });
}

export async function updateTemplate(token: string, id: number, data: any) {
  return fetchApi<any>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data), token });
}

export async function deleteTemplate(token: string, id: number) {
  return fetchApi<any>(`/templates/${id}`, { method: 'DELETE', token });
}

// ── EHS Incidents ──────────────────────────────────────────────────────

export async function getEhsIncidents(token: string, params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return fetchApi<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/ehs-incidents${query}`, { token });
}

export async function getEhsIncident(token: string, id: number) {
  return fetchApi<any>(`/ehs-incidents/${id}`, { token });
}

export async function createEhsIncident(token: string, data: any) {
  return fetchApi<any>('/ehs-incidents', { method: 'POST', body: JSON.stringify(data), token });
}

export async function updateEhsIncident(token: string, id: number, data: any) {
  return fetchApi<any>(`/ehs-incidents/${id}`, { method: 'PUT', body: JSON.stringify(data), token });
}

export async function deleteEhsIncident(token: string, id: number) {
  return fetchApi<any>(`/ehs-incidents/${id}`, { method: 'DELETE', token });
}

export async function exportEhsIncidents(token: string, params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${API_BASE}/ehs-incidents/export${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: 'Export failed' }));
    throw new ApiError(data.message || 'Export failed', res.status);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  a.download = match?.[1] || 'ehs-incidents.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ── EHS Incident Attachments ────────────────────────────────────────────

export async function uploadEhsAttachment(token: string, incidentId: number, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/attachments/ehs_incident/${incidentId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new ApiError(data.message, res.status);
  }

  return res.json();
}

export async function getEhsAttachments(token: string, incidentId: number) {
  return fetchApi<any[]>(`/attachments/ehs_incident/${incidentId}`, { token });
}

// ── PDF Export ──────────────────────────────────────────────────────────

export async function exportMocPdf(token: string, mocId: number) {
  const res = await fetch(`${API_BASE}/export/moc/${mocId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: 'Export failed' }));
    throw new ApiError(data.message || 'Export failed', res.status);
  }
  const contentType = res.headers.get('Content-Type') || '';
  const isZip = contentType.includes('zip');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = isZip ? `MOC-${mocId}.zip` : `MOC-${mocId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportEhsIncidentPdf(token: string, incidentId: number) {
  const res = await fetch(`${API_BASE}/export/ehs-incident/${incidentId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: 'Export failed' }));
    throw new ApiError(data.message || 'Export failed', res.status);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `EHS-Incident-${incidentId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportImprovementsCsv(token: string) {
  const res = await fetch(`${API_BASE}/export/improvements/csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: 'Export failed' }));
    throw new ApiError(data.message || 'Export failed', res.status);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'improvements_report.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ── External Action Items ──────────────────────────────────────────────

export async function assignExternalAction(token: string, data: { item_type: string; item_id: number; email: string; name?: string }) {
  return fetchApi<any>('/external-actions', { method: 'POST', token, body: JSON.stringify(data) });
}

export async function getExternalAssignments(token: string, mocId: number) {
  return fetchApi<any[]>(`/external-actions/moc/${mocId}`, { token });
}

export async function revokeExternalAssignment(token: string, id: number) {
  return fetchApi<any>(`/external-actions/${id}`, { method: 'DELETE', token });
}

// Public (no auth) — for the external response page
export async function getExternalActionByToken(actionToken: string) {
  return fetchApi<any>(`/external-actions/respond/${actionToken}`);
}

export async function respondToExternalAction(actionToken: string, data: { note?: string; marked_done?: boolean }) {
  return fetchApi<any>(`/external-actions/respond/${actionToken}`, { method: 'POST', body: JSON.stringify(data) });
}

export { ApiError };
