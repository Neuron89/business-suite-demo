'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getTicket, managerReview, itReview, updateTicket, cancelTicket, deleteTicket, addComment,
  getCategories, getAssignableUsers, submitOnboardingDetails,
} from '@/lib/api';
import { STATUS_LABELS, STATUS_COLORS, REQUEST_STATUSES } from '@itr/shared';

export default function TicketDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentInternal, setCommentInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [assignees, setAssignees] = useState<any[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  function load() {
    if (!token || !id) return;
    getTicket(token, parseInt(id as string)).then((t) => {
      setTicket(t);
      setResolutionNotes(t.resolution_notes || '');
    }).catch(console.error).finally(() => setLoading(false));
  }

  useEffect(load, [token, id]);

  useEffect(() => {
    if (!token || user?.role !== 'it_admin') return;
    getCategories(token).then(setCategories).catch(() => {});
    getAssignableUsers(token).then(setAssignees).catch(() => {});
  }, [token, user]);

  async function handleManagerReview(decision: string) {
    if (!token || !id) return;
    setSubmitting(true);
    try { await managerReview(token, parseInt(id as string), { decision, notes: reviewNotes }); setReviewNotes(''); load(); }
    catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  }
  async function handleItReview(decision: string) {
    if (!token || !id) return;
    setSubmitting(true);
    try { await itReview(token, parseInt(id as string), { decision, notes: reviewNotes }); setReviewNotes(''); load(); }
    catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  }
  async function handleUpdate(updates: any) {
    if (!token || !id) return;
    try { await updateTicket(token, parseInt(id as string), updates); setEditingField(null); load(); }
    catch (err: any) { alert(err.message); }
  }
  async function handleCancel() {
    if (!token || !id || !confirm('Cancel this ticket?')) return;
    try { await cancelTicket(token, parseInt(id as string)); load(); }
    catch (err: any) { alert(err.message); }
  }
  async function handleDelete() {
    if (!token || !id) return;
    const num = ticket?.request_number || `#${id}`;
    if (!confirm(`Delete ticket ${num}? This permanently removes it along with all comments, history, and attachments. This cannot be undone.`)) return;
    try {
      await deleteTicket(token, parseInt(id as string));
      router.replace('/tickets');
    } catch (err: any) {
      alert(err.message);
    }
  }
  async function handleAddComment() {
    if (!token || !id || !commentText.trim()) return;
    try { await addComment(token, parseInt(id as string), commentText, commentInternal); setCommentText(''); setCommentInternal(false); load(); }
    catch (err: any) { alert(err.message); }
  }

  if (loading) return <div className="animate-fade-in-up"><div className="card"><p className="text-theme-muted">Loading...</p></div></div>;
  if (!ticket) return <div className="card"><p className="text-theme-muted">Ticket not found.</p></div>;

  const r = ticket;
  const isAdmin = user?.role === 'it_admin';
  const isHR = user?.role === 'hr';
  const isManager = user?.role === 'manager';
  const canManagerReview = r.status === 'manager_review' && (isManager || isAdmin);
  const canItReview = (r.status === 'it_review' || r.status === 'submitted') && isAdmin;
  const canCancel = !['completed', 'cancelled'].includes(r.status) && (r.requester_id === user?.id || isAdmin);
  const canEdit = isAdmin;
  const canPostInternal = isAdmin || isHR || isManager;
  const overdue = r.due_date && new Date(r.due_date) < new Date() && !['completed', 'cancelled', 'denied'].includes(r.status);

  return (
    <div className="animate-fade-in-up max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-accent hover:underline mb-1 block">&larr; Back</button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-theme-primary">{r.request_number}</h1>
            {r.category_name && <span className="badge" style={{ background: `${r.category_color}20`, color: r.category_color }}>{r.category_name}</span>}
          </div>
          <p className="text-sm text-theme-muted">{r.title}</p>
        </div>
        <span className="badge text-base px-4 py-1.5" style={{ background: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status] }}>
          {STATUS_LABELS[r.status] || r.status}
        </span>
      </div>

      {/* IT controls */}
      {canEdit && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <h2 className="text-lg font-bold text-theme-primary mb-3">Ticket Management</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block text-theme-muted mb-1 text-xs font-semibold uppercase">Assignee</label>
              <select value={r.assignee_id || ''} onChange={(e) => handleUpdate({ assignee_id: e.target.value ? parseInt(e.target.value) : null })} className="input-field">
                <option value="">Unassigned</option>
                {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-theme-muted mb-1 text-xs font-semibold uppercase">Category</label>
              <select value={r.category_id || ''} onChange={(e) => handleUpdate({ category_id: e.target.value ? parseInt(e.target.value) : null })} className="input-field">
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-theme-muted mb-1 text-xs font-semibold uppercase">Due Date</label>
              <input type="date" value={r.due_date ? r.due_date.slice(0, 10) : ''} onChange={(e) => handleUpdate({ due_date: e.target.value || null })} className="input-field" />
            </div>
            <div>
              <label className="block text-theme-muted mb-1 text-xs font-semibold uppercase">Status</label>
              <select value={r.status} onChange={(e) => handleUpdate({ status: e.target.value })} className="input-field">
                {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          {overdue && <p className="text-xs font-bold mt-3" style={{ color: '#ef4444' }}>⚠ This ticket is overdue.</p>}
        </div>
      )}

      {/* Ticket info */}
      <div className="card">
        <h2 className="text-lg font-bold text-theme-primary mb-3">Ticket Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-theme-muted">Requester:</span> <span className="font-semibold text-theme-primary">{r.requester_name}</span></div>
          <div><span className="text-theme-muted">Department:</span> <span className="font-semibold text-theme-primary">{r.requester_department || 'N/A'}</span></div>
          <div><span className="text-theme-muted">Type:</span> <span className="font-semibold text-theme-primary capitalize">{r.request_type}</span></div>
          <div><span className="text-theme-muted">Urgency:</span> <span className="font-semibold text-theme-primary capitalize">{r.urgency}</span></div>
          <div><span className="text-theme-muted">{r.request_type === 'onboarding' ? "New hire's manager" : 'Manager'}:</span> <span className="font-semibold text-theme-primary">{r.manager_name || 'N/A'}</span></div>
          <div><span className="text-theme-muted">Assignee:</span> <span className="font-semibold text-theme-primary">{r.assignee_name || <span className="italic text-theme-faint">unassigned</span>}</span></div>
          <div><span className="text-theme-muted">Submitted:</span> <span className="font-semibold text-theme-primary">{new Date(r.created_at).toLocaleString()}</span></div>
          {r.due_date && <div><span className="text-theme-muted">Due:</span> <span className="font-semibold" style={{ color: overdue ? '#ef4444' : 'var(--text-primary)' }}>{new Date(r.due_date).toLocaleDateString()}</span></div>}
        </div>
        <div className="mt-4">
          <p className="text-sm text-theme-muted mb-1">Justification:</p>
          <p className="text-sm text-theme-primary whitespace-pre-wrap">{r.justification}</p>
        </div>
      </div>

      {/* Type-specific details */}
      {r.onboarding_details && <DetailsCard title="New Hire Information" details={r.onboarding_details} highlight />}
      {r.hardware_specs && <DetailsCard title="Hardware Details" details={r.hardware_specs} />}
      {r.software_details && <DetailsCard title="Software Details" details={r.software_details} />}
      {r.permission_details && <DetailsCard title="Permission Details" details={r.permission_details} />}
      {r.access_details && <DetailsCard title="Access Details" details={r.access_details} />}
      {r.other_details && <DetailsCard title="Other Details" details={r.other_details} />}

      {/* Manager / IT review notes */}
      {r.manager_notes && (
        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <p className="text-sm font-bold text-theme-secondary">Manager Notes</p>
          <p className="text-sm text-theme-primary mt-1">{r.manager_notes}</p>
          {r.manager_decision_at && <p className="text-xs text-theme-muted mt-2">{new Date(r.manager_decision_at).toLocaleString()}</p>}
        </div>
      )}
      {r.it_admin_notes && (
        <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <p className="text-sm font-bold text-theme-secondary">IT Admin Notes</p>
          <p className="text-sm text-theme-primary mt-1">{r.it_admin_notes}</p>
          {r.it_decision_at && <p className="text-xs text-theme-muted mt-2">{new Date(r.it_decision_at).toLocaleString()}</p>}
        </div>
      )}

      {/* Resolution notes (admin only, editable) */}
      {canEdit && (
        <div className="card">
          <h2 className="text-lg font-bold text-theme-primary mb-3">Resolution Notes</h2>
          <textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} className="input-field mb-3" rows={3}
            placeholder="What was done to resolve this ticket?" />
          <button onClick={() => handleUpdate({ resolution_notes: resolutionNotes })} className="btn-primary">Save Resolution</button>
        </div>
      )}
      {!canEdit && r.resolution_notes && (
        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <p className="text-sm font-bold text-theme-secondary">Resolution</p>
          <p className="text-sm text-theme-primary mt-1 whitespace-pre-wrap">{r.resolution_notes}</p>
        </div>
      )}

      {/* Onboarding-specific manager step: structured IT-needs form, not approve/deny */}
      {canManagerReview && r.request_type === 'onboarding' && (
        <OnboardingManagerForm
          ticketId={r.id}
          existing={typeof r.onboarding_details === 'string' ? JSON.parse(r.onboarding_details) : (r.onboarding_details || {})}
          onSaved={load}
        />
      )}

      {/* Standard review actions for non-onboarding tickets */}
      {((canManagerReview && r.request_type !== 'onboarding') || canItReview) && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <h2 className="text-lg font-bold text-theme-primary mb-3">{canManagerReview ? 'Manager Review' : 'IT Review'}</h2>
          <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className="input-field mb-3" rows={2} placeholder="Add notes (optional)..." />
          <div className="flex gap-3">
            <button onClick={() => canManagerReview ? handleManagerReview('approved') : handleItReview('approved')} disabled={submitting}
              className="btn-primary" style={{ background: '#22c55e', borderColor: '#22c55e' }}>Approve</button>
            <button onClick={() => canManagerReview ? handleManagerReview('denied') : handleItReview('denied')} disabled={submitting}
              className="btn-danger">Deny</button>
          </div>
        </div>
      )}

      {(canCancel || isAdmin) && (
        <div className="flex flex-wrap gap-3">
          {canCancel && (
            <button onClick={handleCancel} className="btn-danger">Cancel Ticket</button>
          )}
          {isAdmin && (
            <button
              onClick={handleDelete}
              className="btn-danger"
              style={{ background: '#7f1d1d', borderColor: '#7f1d1d' }}
              title="Permanently delete this ticket and all related data"
            >
              Delete Ticket
            </button>
          )}
        </div>
      )}

      {/* Comments */}
      <div className="card">
        <h2 className="text-lg font-bold text-theme-primary mb-3">Comments</h2>
        {r.comments?.length > 0 ? (
          <div className="space-y-3 mb-4">
            {r.comments.map((c: any) => (
              <div key={c.id} className="p-3 rounded-lg" style={{
                background: c.is_internal ? 'rgba(245,158,11,0.08)' : 'var(--bg-card-hover)',
                borderLeft: c.is_internal ? '3px solid #f59e0b' : 'none',
              }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-theme-primary">{c.user_name}</span>
                  {c.is_internal && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: '#f59e0b', color: 'white' }}>Internal</span>}
                  <span className="text-xs text-theme-muted">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-theme-secondary whitespace-pre-wrap">{c.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-theme-muted mb-4">No comments yet.</p>
        )}
        <div className="space-y-2">
          <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} className="input-field" rows={2} placeholder="Add a comment..." />
          <div className="flex items-center justify-between gap-2">
            {canPostInternal && (
              <label className="flex items-center gap-2 text-sm text-theme-secondary cursor-pointer">
                <input type="checkbox" checked={commentInternal} onChange={(e) => setCommentInternal(e.target.checked)} />
                Internal note (hidden from requester)
              </label>
            )}
            <button onClick={handleAddComment} className="btn-primary ml-auto">Post Comment</button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="card">
        <h2 className="text-lg font-bold text-theme-primary mb-3">History</h2>
        {r.history?.length > 0 ? (
          <div className="space-y-2">
            {r.history.map((h: any) => (
              <div key={h.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: STATUS_COLORS[h.to_status] || '#94a3b8' }} />
                <div>
                  <span className="font-semibold text-theme-primary">{h.changed_by_name}</span>
                  <span className="text-theme-muted"> changed status to </span>
                  <span className="font-semibold" style={{ color: STATUS_COLORS[h.to_status] }}>{STATUS_LABELS[h.to_status] || h.to_status}</span>
                  {h.comment && <p className="text-theme-secondary text-xs mt-0.5">{h.comment}</p>}
                  <p className="text-xs text-theme-faint">{new Date(h.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-theme-muted">No history.</p>
        )}
      </div>
    </div>
  );
}

const SOFTWARE_OPTIONS = [
  'Microsoft 365 (Outlook, Word, Excel)',
  'Microsoft Teams',
  'Adobe Acrobat',
  'AutoCAD',
  'IQMS / DELMIAworks',
  'Slack',
  'SAP',
];

function OnboardingManagerForm({ ticketId, existing, onSaved }: { ticketId: number; existing: any; onSaved: () => void }) {
  const { token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [needsLaptop, setNeedsLaptop] = useState<boolean>(existing.needs_laptop ?? true);
  const [laptopPref, setLaptopPref] = useState<string>(existing.laptop_preference ?? 'no_preference');
  const [needsMonitor, setNeedsMonitor] = useState<boolean>(existing.needs_monitor ?? true);
  const [monitorCount, setMonitorCount] = useState<number>(existing.monitor_count ?? 1);
  const [needsPhone, setNeedsPhone] = useState<boolean>(existing.needs_phone ?? false);
  const [needsHeadset, setNeedsHeadset] = useState<boolean>(existing.needs_headset ?? false);
  const [otherEquipment, setOtherEquipment] = useState<string>(existing.other_equipment ?? '');

  const [emailAlias, setEmailAlias] = useState<string>(existing.email_alias_preference ?? '');
  const [needsM365, setNeedsM365] = useState<boolean>(existing.needs_m365 ?? true);
  const [needsVpn, setNeedsVpn] = useState<boolean>(existing.needs_vpn ?? false);
  const [softwareNeeded, setSoftwareNeeded] = useState<string[]>(existing.software_needed ?? ['Microsoft 365 (Outlook, Word, Excel)', 'Microsoft Teams']);
  const [customSoftware, setCustomSoftware] = useState('');
  const [sharedMailboxes, setSharedMailboxes] = useState<string>((existing.shared_mailboxes ?? []).join('\n'));
  const [distLists, setDistLists] = useState<string>((existing.distribution_lists ?? []).join('\n'));
  const [securityGroups, setSecurityGroups] = useState<string>((existing.security_groups ?? []).join('\n'));
  const [networkDrives, setNetworkDrives] = useState<string>((existing.network_drives ?? []).join('\n'));
  const [similarTo, setSimilarTo] = useState<string>(existing.similar_to_employee_email ?? '');
  const [managerNotes, setManagerNotes] = useState<string>(existing.manager_notes ?? '');

  const splitLines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  function toggleSoftware(name: string) {
    setSoftwareNeeded((arr) => arr.includes(name) ? arr.filter((x) => x !== name) : [...arr, name]);
  }

  async function handleSubmit() {
    if (!token) return;
    setError('');
    setSubmitting(true);
    try {
      await submitOnboardingDetails(token, ticketId, {
        needs_laptop: needsLaptop,
        laptop_preference: needsLaptop ? laptopPref : undefined,
        needs_monitor: needsMonitor,
        monitor_count: needsMonitor ? monitorCount : 0,
        needs_phone: needsPhone,
        needs_headset: needsHeadset,
        other_equipment: otherEquipment || undefined,
        email_alias_preference: emailAlias || undefined,
        needs_m365: needsM365,
        needs_vpn: needsVpn,
        software_needed: [...softwareNeeded, ...splitLines(customSoftware)],
        shared_mailboxes: splitLines(sharedMailboxes),
        distribution_lists: splitLines(distLists),
        security_groups: splitLines(securityGroups),
        network_drives: splitLines(networkDrives),
        similar_to_employee_email: similarTo || undefined,
        manager_notes: managerNotes || undefined,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
      <h2 className="text-lg font-bold text-theme-primary mb-1">Specify IT Requirements</h2>
      <p className="text-sm text-theme-muted mb-4">
        HR submitted this onboarding ticket for <strong>{existing.full_name}</strong>. Tell IT what they&apos;ll need.
      </p>

      {error && <div className="mb-4 p-3 rounded-lg text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}

      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-bold text-theme-secondary mb-2 uppercase tracking-wide">Equipment</h3>
          <label className="flex items-center gap-3 mb-2 cursor-pointer">
            <input type="checkbox" checked={needsLaptop} onChange={(e) => setNeedsLaptop(e.target.checked)} />
            <span className="text-sm font-semibold text-theme-primary">Needs a computer</span>
          </label>
          {needsLaptop && (
            <select value={laptopPref} onChange={(e) => setLaptopPref(e.target.value)} className="input-field mb-3">
              <option value="no_preference">No preference</option>
              <option value="14_inch">14&quot; laptop</option>
              <option value="16_inch">16&quot; laptop</option>
              <option value="desktop">Desktop</option>
            </select>
          )}
          <label className="flex items-center gap-3 mb-2 cursor-pointer">
            <input type="checkbox" checked={needsMonitor} onChange={(e) => setNeedsMonitor(e.target.checked)} />
            <span className="text-sm font-semibold text-theme-primary">Needs external monitor(s)</span>
          </label>
          {needsMonitor && (
            <input type="number" min={1} max={4} value={monitorCount} onChange={(e) => setMonitorCount(parseInt(e.target.value) || 1)} className="input-field mb-3 w-32" />
          )}
          <label className="flex items-center gap-3 mb-2 cursor-pointer">
            <input type="checkbox" checked={needsPhone} onChange={(e) => setNeedsPhone(e.target.checked)} />
            <span className="text-sm font-semibold text-theme-primary">Office phone / extension</span>
          </label>
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input type="checkbox" checked={needsHeadset} onChange={(e) => setNeedsHeadset(e.target.checked)} />
            <span className="text-sm font-semibold text-theme-primary">Headset</span>
          </label>
          <textarea className="input-field" rows={2} value={otherEquipment} onChange={(e) => setOtherEquipment(e.target.value)} placeholder="Other equipment / accessories (e.g., docking station, second keyboard)" />
        </div>

        <div>
          <h3 className="text-sm font-bold text-theme-secondary mb-2 uppercase tracking-wide">Accounts & Email</h3>
          <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Preferred email alias</label>
          <input className="input-field mb-3" value={emailAlias} onChange={(e) => setEmailAlias(e.target.value)} placeholder="e.g., j.smith" />
          <label className="flex items-center gap-3 mb-2 cursor-pointer">
            <input type="checkbox" checked={needsM365} onChange={(e) => setNeedsM365(e.target.checked)} />
            <span className="text-sm font-semibold text-theme-primary">Microsoft 365 mailbox</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={needsVpn} onChange={(e) => setNeedsVpn(e.target.checked)} />
            <span className="text-sm font-semibold text-theme-primary">VPN access (remote work)</span>
          </label>
        </div>

        <div>
          <h3 className="text-sm font-bold text-theme-secondary mb-2 uppercase tracking-wide">Software</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {SOFTWARE_OPTIONS.map((sw) => (
              <label key={sw} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-theme cursor-pointer text-sm font-semibold text-theme-primary"
                style={{ background: softwareNeeded.includes(sw) ? 'var(--sidebar-active)' : 'transparent' }}>
                <input type="checkbox" checked={softwareNeeded.includes(sw)} onChange={() => toggleSoftware(sw)} />
                {sw}
              </label>
            ))}
          </div>
          <textarea className="input-field" rows={2} value={customSoftware} onChange={(e) => setCustomSoftware(e.target.value)}
            placeholder="Other software, one per line" />
        </div>

        <div>
          <h3 className="text-sm font-bold text-theme-secondary mb-2 uppercase tracking-wide">Access</h3>
          <label className="block text-xs font-semibold text-theme-muted mb-1">Shared mailboxes (one per line)</label>
          <textarea className="input-field mb-3" rows={2} value={sharedMailboxes} onChange={(e) => setSharedMailboxes(e.target.value)} />
          <label className="block text-xs font-semibold text-theme-muted mb-1">Distribution lists</label>
          <textarea className="input-field mb-3" rows={2} value={distLists} onChange={(e) => setDistLists(e.target.value)} />
          <label className="block text-xs font-semibold text-theme-muted mb-1">Security / access groups</label>
          <textarea className="input-field mb-3" rows={2} value={securityGroups} onChange={(e) => setSecurityGroups(e.target.value)} />
          <label className="block text-xs font-semibold text-theme-muted mb-1">Network drives / shared folders</label>
          <textarea className="input-field" rows={2} value={networkDrives} onChange={(e) => setNetworkDrives(e.target.value)} />
        </div>

        <div>
          <h3 className="text-sm font-bold text-theme-secondary mb-2 uppercase tracking-wide">Shortcut</h3>
          <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Mirror access from existing employee (email)</label>
          <input className="input-field mb-3" value={similarTo} onChange={(e) => setSimilarTo(e.target.value)} placeholder="Set them up like this person" />
          <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Additional notes for IT</label>
          <textarea className="input-field" rows={3} value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button onClick={handleSubmit} disabled={submitting} className="btn-accent">
          {submitting ? 'Saving...' : 'Send to IT'}
        </button>
      </div>
    </div>
  );
}

function DetailsCard({ title, details, highlight }: { title: string; details: any; highlight?: boolean }) {
  const obj = typeof details === 'string' ? JSON.parse(details) : details;
  return (
    <div className="card" style={highlight ? { borderLeft: '4px solid #22c55e' } : undefined}>
      <h2 className="text-lg font-bold text-theme-primary mb-3">{title}</h2>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {Object.entries(obj).map(([k, v]) => {
          if (v === null || v === undefined || v === '' || v === false) return null;
          if (Array.isArray(v) && v.length === 0) return null;
          return (
            <div key={k}>
              <span className="text-theme-muted capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
              <span className="font-semibold text-theme-primary">
                {Array.isArray(v) ? v.join(', ') : v === true ? 'Yes' : String(v)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
