'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  getEhsIncident, updateEhsIncident, deleteEhsIncident, getUsers,
  uploadEhsAttachment, getEhsAttachments, deleteAttachment, getDownloadUrl, getPreviewUrl,
  exportEhsIncidentPdf,
} from '@/lib/api';
import FilePreviewModal from '@/components/shared/FilePreviewModal';
import {
  EHS_INCIDENT_TYPES,
  EHS_INCIDENT_SEVERITIES,
  EHS_INCIDENT_STATUSES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_SEVERITY_COLORS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
} from '@moc/shared';

export default function EhsIncidentDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const router = useRouter();
  const [incident, setIncident] = useState<any>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchIncident = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await getEhsIncident(token, Number(id));
      setIncident(data);
      setForm({
        title: data.title,
        description: data.description,
        incident_type: data.incident_type,
        severity: data.severity,
        status: data.status,
        incident_date: data.incident_date?.split('T')[0] || '',
        location: data.location,
        affected_persons: data.affected_persons || '',
        root_cause: data.root_cause || '',
        corrective_actions: data.corrective_actions || '',
        moc_id: data.moc_id || '',
        assigned_to: data.assigned_to || '',
      });
    } catch (err: any) {
      setError(err.message);
    }
  }, [token, id]);

  const fetchAttachments = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await getEhsAttachments(token, Number(id));
      setAttachments(data);
    } catch (err: any) {
      console.error('Failed to load attachments:', err.message);
    }
  }, [token, id]);

  useEffect(() => { fetchIncident(); fetchAttachments(); }, [fetchIncident, fetchAttachments]);

  useEffect(() => {
    if (token && editing) {
      getUsers(token).then(setUsers).catch(console.error);
    }
  }, [token, editing]);

  const isOwner = incident?.reported_by === user?.id;
  const isPrivileged = ['admin', 'ehs', 'moc_manager'].includes(user?.role || '');
  const canEdit = isOwner || isPrivileged;
  const canDelete = user?.role === 'admin';

  async function handleSave() {
    if (!token || !incident) return;
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (payload.moc_id === '' || payload.moc_id === null) payload.moc_id = null;
      else payload.moc_id = parseInt(payload.moc_id);
      if (payload.assigned_to === '' || payload.assigned_to === null) payload.assigned_to = null;
      else payload.assigned_to = parseInt(payload.assigned_to);

      await updateEhsIncident(token, incident.id, payload);
      setEditing(false);
      await fetchIncident();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !incident) return;
    if (!confirm('Delete this incident permanently?')) return;
    try {
      await deleteEhsIncident(token, incident.id);
      router.push('/ehs-incidents');
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token || !id) return;
    setUploading(true);
    try {
      await uploadEhsAttachment(token, Number(id), file);
      await fetchAttachments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeleteAttachment(attId: number) {
    if (!token) return;
    if (!confirm('Delete this attachment?')) return;
    try {
      await deleteAttachment(token, attId);
      await fetchAttachments();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleExportPdf() {
    if (!token || !id) return;
    setExporting(true);
    try {
      await exportEhsIncidentPdf(token, Number(id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  }

  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!incident) return <div className="text-gray-500 dark:text-gray-400 text-center py-12">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push('/ehs-incidents')} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">#{incident.id} {incident.title}</h1>
          </div>
          <div className="flex items-center gap-2 ml-8">
            <span
              className="badge text-white text-xs"
              style={{ backgroundColor: INCIDENT_STATUS_COLORS[incident.status as keyof typeof INCIDENT_STATUS_COLORS] }}
            >
              {INCIDENT_STATUS_LABELS[incident.status as keyof typeof INCIDENT_STATUS_LABELS]}
            </span>
            <span
              className="badge text-white text-xs"
              style={{ backgroundColor: INCIDENT_SEVERITY_COLORS[incident.severity as keyof typeof INCIDENT_SEVERITY_COLORS] }}
            >
              {INCIDENT_SEVERITY_LABELS[incident.severity as keyof typeof INCIDENT_SEVERITY_LABELS]}
            </span>
            <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 capitalize text-xs">
              {incident.incident_type.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportPdf} disabled={exporting} className="btn-secondary text-sm">
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} className="btn-primary text-sm">Edit</button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="btn-danger text-sm">Delete</button>
          )}
        </div>
      </div>

      {editing ? (
        /* Edit Form */
        <div className="space-y-6">
          <div className="card space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Edit Incident</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Type</label>
                <select value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })} className="input-field">
                  {EHS_INCIDENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Severity</label>
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="input-field">
                  {EHS_INCIDENT_SEVERITIES.map((s) => (
                    <option key={s} value={s}>{INCIDENT_SEVERITY_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Date</label>
                <input
                  type="date"
                  value={form.incident_date}
                  onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            {isPrivileged && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
                    {EHS_INCIDENT_STATUSES.map((s) => (
                      <option key={s} value={s}>{INCIDENT_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Assigned To</label>
                  <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="input-field">
                    <option value="">Unassigned</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-field"
                rows={4}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Affected Persons</label>
              <input
                type="text"
                value={form.affected_persons}
                onChange={(e) => setForm({ ...form, affected_persons: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Root Cause</label>
              <textarea
                value={form.root_cause}
                onChange={(e) => setForm({ ...form, root_cause: e.target.value })}
                className="input-field"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Corrective Actions</label>
              <textarea
                value={form.corrective_actions}
                onChange={(e) => setForm({ ...form, corrective_actions: e.target.value })}
                className="input-field"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Related MOC ID</label>
              <input
                type="number"
                value={form.moc_id}
                onChange={(e) => setForm({ ...form, moc_id: e.target.value })}
                className="input-field"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : (
        /* Detail View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Description</h3>
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{incident.description}</p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Location</dt>
                  <dd className="font-medium">{incident.location}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Incident Date</dt>
                  <dd className="font-medium">{new Date(incident.incident_date).toLocaleDateString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Reported By</dt>
                  <dd className="font-medium">{incident.reporter_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Assigned To</dt>
                  <dd className="font-medium">{incident.assignee_name || <span className="text-gray-400 italic">Unassigned</span>}</dd>
                </div>
                {incident.affected_persons && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Affected Persons</dt>
                    <dd className="font-medium">{incident.affected_persons}</dd>
                  </div>
                )}
                {incident.moc_id && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Related MOC</dt>
                    <dd>
                      <Link href={`/moc/${incident.moc_id}`} className="text-brand-600 hover:underline font-medium">
                        #{incident.moc_id} {incident.moc_title || ''}
                      </Link>
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Created</dt>
                  <dd className="font-medium">{new Date(incident.created_at).toLocaleString()}</dd>
                </div>
              </dl>
            </div>

            {(incident.root_cause || incident.corrective_actions) && (
              <>
                <div className="card">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Root Cause</h3>
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {incident.root_cause || <span className="text-gray-400 italic">Not yet determined</span>}
                  </p>
                </div>
                <div className="card">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Corrective Actions</h3>
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {incident.corrective_actions || <span className="text-gray-400 italic">None documented yet</span>}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Attachments Section */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  Documents & Attachments ({attachments.length})
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Upload images, reports, diagrams, schematics, and other documents.
                </p>
              </div>
              <label className="btn-primary cursor-pointer inline-block text-sm">
                {uploading ? 'Uploading...' : 'Upload File'}
                <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>

            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((att: any, idx: number) => (
                  <div key={att.id} className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      {['image/jpeg', 'image/png'].includes(att.mime_type) ? (
                        <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ) : att.mime_type === 'application/pdf' ? (
                        <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      <div className="min-w-0">
                        <button
                          onClick={() => setPreviewIdx(idx)}
                          className="font-medium text-brand-600 hover:underline text-left truncate block max-w-full"
                        >
                          {att.original_name}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(att.size / 1024).toFixed(1)} KB — Uploaded by {att.uploader_name} on {new Date(att.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={getDownloadUrl(att.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Download"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                      {(att.uploaded_by === user?.id || user?.role === 'admin') && (
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-center py-6 text-sm">
                No attachments yet. Upload images, reports, or other documents.
              </p>
            )}

            {previewIdx !== null && attachments[previewIdx] && token && (
              <FilePreviewModal
                attachment={attachments[previewIdx]}
                token={token}
                onClose={() => setPreviewIdx(null)}
                onPrev={previewIdx > 0 ? () => setPreviewIdx(previewIdx - 1) : undefined}
                onNext={previewIdx < attachments.length - 1 ? () => setPreviewIdx(previewIdx + 1) : undefined}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
