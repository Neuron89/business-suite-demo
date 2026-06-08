'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { complaintApi, userApi, attachmentApi, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import StatusBadge from '@/components/shared/StatusBadge';
import SeverityBadge from '@/components/shared/SeverityBadge';

const WORKFLOW_TRANSITIONS: Record<string, { roles: string[]; to: string[] }> = {
  submitted: { roles: ['admin', 'qc'], to: ['under_review', 'rejected', 'returned'] },
  under_review: { roles: ['admin', 'qc'], to: ['resolved', 'rejected', 'returned'] },
  resolved: { roles: ['admin', 'qc'], to: ['closed', 'under_review'] },
  closed: { roles: ['admin'], to: ['under_review'] },
  rejected: { roles: ['admin'], to: ['under_review'] },
  returned: { roles: ['admin', 'qc', 'operations'], to: ['submitted', 'under_review'] },
};

export default function ComplaintDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [complaint, setComplaint] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [transitionComment, setTransitionComment] = useState('');
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([
        complaintApi.get(Number(id)),
        userApi.list(),
      ]);
      setComplaint(c);
      setUsers(u);
      setResolution(c.resolution || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (newStatus: string) => {
    setError('');
    try {
      await complaintApi.transition(Number(id), { status: newStatus, comment: transitionComment });
      setTransitionComment('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Transition failed');
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await complaintApi.addComment(Number(id), comment);
      setComment('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add comment');
    }
  };

  const handleAssign = async (userId: number | null) => {
    try {
      await complaintApi.assign(Number(id), userId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign');
    }
  };

  const handleSaveResolution = async () => {
    try {
      await complaintApi.update(Number(id), { resolution });
      setIsEditing(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save resolution');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await attachmentApi.upload(Number(id), file);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    }
    e.target.value = '';
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      await attachmentApi.delete(attachmentId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  if (loading) return <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>;
  if (!complaint) return <div style={{ color: 'var(--text-secondary)' }}>Complaint not found</div>;

  const transition = WORKFLOW_TRANSITIONS[complaint.status];
  const canTransition = transition && user && transition.roles.includes(user.role);
  const canAssign = user && ['admin', 'qc'].includes(user.role);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm mb-2 hover:underline" style={{ color: 'var(--accent)' }}>
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            {complaint.complaint_number}
            <StatusBadge status={complaint.status} />
            <SeverityBadge severity={complaint.severity} />
          </h1>
          <p className="text-lg mt-1" style={{ color: 'var(--text-secondary)' }}>{complaint.title}</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="card p-5">
            <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Description</h2>
            <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-secondary)' }}>{complaint.description}</p>
          </div>

          {/* Resolution */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Resolution</h2>
              {!isEditing && canAssign && (
                <button onClick={() => setIsEditing(true)} className="text-sm" style={{ color: 'var(--accent)' }}>Edit</button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-3">
                <textarea className="input-field min-h-[100px]" value={resolution} onChange={(e) => setResolution(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={handleSaveResolution} className="btn-primary text-sm">Save</button>
                  <button onClick={() => { setIsEditing(false); setResolution(complaint.resolution || ''); }} className="btn-secondary text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap" style={{ color: complaint.resolution ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                {complaint.resolution || 'No resolution yet'}
              </p>
            )}
          </div>

          {/* Status Transition */}
          {canTransition && transition.to.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Change Status</h2>
              <textarea
                className="input-field mb-3 min-h-[60px]"
                placeholder="Add a comment for this transition (optional)..."
                value={transitionComment}
                onChange={(e) => setTransitionComment(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {transition.to.map((status: string) => (
                  <button key={status} onClick={() => handleTransition(status)}
                    className="btn-secondary text-sm capitalize">
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="card p-5">
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Comments ({complaint.comments?.length || 0})
            </h2>

            <div className="space-y-4 mb-4">
              {complaint.comments?.map((c: any) => (
                <div key={c.id} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{c.user_name}</span>
                    <span className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{c.user_role}</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{c.comment}</p>
                </div>
              ))}
              {(!complaint.comments || complaint.comments.length === 0) && (
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No comments yet</p>
              )}
            </div>

            <form onSubmit={handleComment} className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button type="submit" className="btn-primary text-sm">Send</button>
            </form>
          </div>

          {/* Attachments */}
          <div className="card p-5">
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Attachments ({complaint.attachments?.length || 0})
            </h2>
            <div className="space-y-2 mb-4">
              {complaint.attachments?.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{a.original_name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      ({(a.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <a href={attachmentApi.getDownloadUrl(a.id)} className="text-xs" style={{ color: 'var(--accent)' }}
                      target="_blank" rel="noopener noreferrer">Download</a>
                    <button onClick={() => handleDeleteAttachment(a.id)} className="text-xs" style={{ color: 'var(--danger)' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            <label className="btn-secondary text-sm cursor-pointer inline-block">
              Upload File
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="card p-5">
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Customer</h3>
            <InfoRow label="Name" value={complaint.customer_name} />
            <InfoRow label="Email" value={complaint.customer_email} />
            <InfoRow label="Phone" value={complaint.customer_phone} />
            <InfoRow label="Company" value={complaint.customer_company} />
          </div>

          {/* Product Info */}
          <div className="card p-5">
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Product</h3>
            <InfoRow label="Name" value={complaint.product_name} />
            <InfoRow label="Lot #" value={complaint.lot_number} />
          </div>

          {/* Details */}
          <div className="card p-5">
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Details</h3>
            <InfoRow label="Type" value={complaint.complaint_type} />
            <InfoRow label="Severity" value={complaint.severity} />
            <InfoRow label="Created By" value={complaint.created_by_name} />
            <InfoRow label="Created" value={new Date(complaint.created_at).toLocaleString()} />
            <InfoRow label="Updated" value={new Date(complaint.updated_at).toLocaleString()} />
            {complaint.resolution_date && (
              <InfoRow label="Resolved" value={new Date(complaint.resolution_date).toLocaleString()} />
            )}
          </div>

          {/* Assignment */}
          {canAssign && (
            <div className="card p-5">
              <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Assignment</h3>
              <select
                className="input-field"
                value={complaint.assigned_to || ''}
                onChange={(e) => handleAssign(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Unassigned</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="capitalize" style={{ color: value ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
        {value || '—'}
      </span>
    </div>
  );
}
