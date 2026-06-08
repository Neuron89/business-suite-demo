'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getTicket, managerReview, itReview, updateTicket, cancelTicket, deleteTicket, addComment,
  getCategories, getAssignableUsers, submitOnboardingDetails, hrFill, itClose, hrConfirm, hrSearchUpdate, createPing, setStartDate,
} from '@/lib/api';
import { STATUS_LABELS, STATUS_COLORS, REQUEST_STATUSES } from '@onb/shared';

// Ticket Management (assignee/category/due/status) is hidden for now but the
// code is kept for future use — flip to true to re-enable.
const SHOW_TICKET_MANAGEMENT = false;

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
  const [pingRole, setPingRole] = useState<'manager' | 'hr' | 'ehs'>('manager');
  const [pingMsg, setPingMsg] = useState('');

  function load() {
    if (!token || !id) return;
    getTicket(token, parseInt(id as string)).then((t) => {
      setTicket(t);
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
  async function handleItClose(decision: string) {
    if (!token || !id) return;
    setSubmitting(true);
    try { await itClose(token, parseInt(id as string), { decision, notes: reviewNotes }); setReviewNotes(''); load(); }
    catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  }
  async function handlePing() {
    if (!token || !id || !pingMsg.trim()) return;
    setSubmitting(true);
    try { await createPing(token, { ticket_id: parseInt(id as string), to_role: pingRole, message: pingMsg }); setPingMsg(''); load(); }
    catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  }
  async function handleHrConfirm(note: string) {
    if (!token || !id) return;
    setSubmitting(true);
    try { await hrConfirm(token, parseInt(id as string), { note }); load(); }
    catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  }
  async function handleHrSearchUpdate(search_status: string) {
    if (!token || !id) return;
    setSubmitting(true);
    try { await hrSearchUpdate(token, parseInt(id as string), { search_status }); load(); }
    catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  }
  async function handleSetStartDate(start_date: string) {
    if (!token || !id) return;
    setSubmitting(true);
    try { await setStartDate(token, parseInt(id as string), { start_date }); load(); }
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
      router.replace('/onboarding');
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
  // v2 manager-first flow
  const canHrFill = r.flow_version === 2 && r.status === 'hr_searching' && (isHR || isAdmin);
  // Only the hiring manager (this ticket's manager) sets the start date — not IT.
  const canSetStartDate = r.flow_version === 2 && r.status === 'manager_start_date' && isManager && r.manager_id === user?.id;
  const canItClose = r.flow_version === 2 && r.status === 'it_close' && isAdmin;
  const canHrConfirm = r.flow_version === 2 && r.status === 'hr_fill' && (isHR || isAdmin);
  const canHrSearch = r.flow_version === 2 && r.status === 'hr_searching' && (isHR || isAdmin);
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

      {/* IT controls — hidden for now (SHOW_TICKET_MANAGEMENT), code retained */}
      {SHOW_TICKET_MANAGEMENT && canEdit && (
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
                {REQUEST_STATUSES.map((s: string) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
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
      {r.onboarding_details && (() => {
        const od = typeof r.onboarding_details === 'string' ? JSON.parse(r.onboarding_details) : r.onboarding_details;
        return (
          <>
            <RoleRequisitionCard od={od} ticket={r} />
            <HrProgressLine od={od} ackAt={r.hr_ack_at} />
            {!isHR && <FieldGroupCard title="IT Requirements" od={od} fields={IT_FIELDS} />}
          </>
        );
      })()}
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

      {/* v1 flow — HR submitted, manager fills IT-needs form */}
      {canManagerReview && r.request_type === 'onboarding' && r.flow_version === 1 && (
        <OnboardingManagerForm
          ticketId={r.id}
          existing={typeof r.onboarding_details === 'string' ? JSON.parse(r.onboarding_details) : (r.onboarding_details || {})}
          onSaved={load}
        />
      )}

      {/* v2 flow — HR fills in identity (name, employee#, badge#) */}
      {canHrConfirm && <HrConfirmCard onConfirm={handleHrConfirm} submitting={submitting} />}
      {canHrSearch && (
        <HrSearchCard
          current={(() => { const od = typeof r.onboarding_details === 'string' ? JSON.parse(r.onboarding_details) : (r.onboarding_details || {}); return od.employee_search_status || ''; })()}
          onSave={handleHrSearchUpdate}
          submitting={submitting}
        />
      )}
      {canHrFill && (
        <HrFillForm ticketId={r.id} onSaved={load} />
      )}

      {/* v2 flow — hiring manager sets the confirmed start date */}
      {canSetStartDate && (
        <SetStartDateCard
          request={(() => { const od = typeof r.onboarding_details === 'string' ? JSON.parse(r.onboarding_details) : (r.onboarding_details || {}); return od.start_date_request || ''; })()}
          onSave={handleSetStartDate}
          submitting={submitting}
        />
      )}

      {/* v2 flow — IT close-out (approve + fire automation, or deny) */}
      {canItClose && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <h2 className="text-lg font-bold text-theme-primary mb-3">IT Close-Out</h2>
          <p className="text-sm text-theme-muted mb-3">
            Approving syncs the new hire to the Employee Tech Doc directory and
            triggers M365 / AD / UniFi provisioning (where configured).
          </p>
          <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className="input-field mb-3" rows={2} placeholder="Close-out notes (optional)..." />
          <div className="flex gap-3">
            <button onClick={() => handleItClose('approved')} disabled={submitting}
              className="btn-primary" style={{ background: '#22c55e', borderColor: '#22c55e' }}>Approve &amp; Provision</button>
          </div>
        </div>
      )}

      {/* IT can ping a role for info needed before closing */}
      {isAdmin && !['completed', 'cancelled', 'denied'].includes(r.status) && (
        <div className="card" style={{ borderLeft: '4px solid #0ea5e9' }}>
          <h2 className="text-lg font-bold text-theme-primary mb-1">Ping for info</h2>
          <p className="text-sm text-theme-muted mb-3">Need something before you can finish (desk area ready, badge active, safety orientation done)? Ping the right team — it shows up on their onboarding home.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={pingRole} onChange={(e) => setPingRole(e.target.value as 'manager' | 'hr' | 'ehs')} className="input-field sm:w-40">
              <option value="manager">Manager</option>
              <option value="hr">HR</option>
              <option value="ehs">EHS</option>
            </select>
            <input className="input-field flex-1" value={pingMsg} onChange={(e) => setPingMsg(e.target.value)} placeholder="e.g., Is the desk area ready for setup?" />
            <button onClick={handlePing} disabled={submitting || !pingMsg.trim()} className="btn-primary whitespace-nowrap">Send ping</button>
          </div>
        </div>
      )}

      {/* Standard review actions for non-onboarding (and legacy v1 onboarding) tickets */}
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

      {/* Activity — comments and history merged into one chronological feed */}
      <div className="card">
        <h2 className="text-lg font-bold text-theme-primary mb-3">Activity</h2>
        {(() => {
          const items = [
            ...((r.comments || []) as any[]).map((c) => ({ kind: 'comment' as const, at: c.created_at, data: c })),
            ...((r.history || []) as any[]).map((h) => ({ kind: 'event' as const, at: h.created_at, data: h })),
          ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
          if (items.length === 0) return <p className="text-base text-theme-muted mb-4">No activity yet.</p>;
          return (
            <div className="space-y-3 mb-4">
              {items.map((it) => it.kind === 'comment' ? (
                <div key={`c${it.data.id}`} className="p-4 rounded-lg" style={{
                  background: it.data.is_internal ? 'rgba(245,158,11,0.08)' : 'var(--bg-card-hover)',
                  borderLeft: it.data.is_internal ? '3px solid #f59e0b' : 'none',
                }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base font-bold text-theme-primary">{it.data.user_name}</span>
                    {it.data.is_internal && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: '#f59e0b', color: 'white' }}>Internal</span>}
                    <span className="text-xs text-theme-muted">{new Date(it.data.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-base leading-relaxed text-theme-primary whitespace-pre-wrap">{it.data.comment}</p>
                </div>
              ) : (
                <div key={`h${it.data.id}`} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: STATUS_COLORS[it.data.to_status] || '#94a3b8' }} />
                  <div>
                    <span className="text-sm font-semibold text-theme-primary">{it.data.changed_by_name}</span>
                    {it.data.from_status !== it.data.to_status && (
                      <>
                        <span className="text-sm text-theme-muted"> → </span>
                        <span className="text-sm font-semibold" style={{ color: STATUS_COLORS[it.data.to_status] }}>{STATUS_LABELS[it.data.to_status] || it.data.to_status}</span>
                      </>
                    )}
                    {it.data.comment && <p className="text-sm text-theme-secondary mt-0.5 whitespace-pre-wrap">{it.data.comment}</p>}
                    <p className="text-xs text-theme-faint mt-0.5">{new Date(it.data.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        <div className="space-y-2">
          <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} className="input-field text-base" rows={3} placeholder="Add a comment..." />
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

/**
 * v2 flow — HR identity-fill form. Shown when a ticket is in `hr_fill` state.
 * The manager has already populated job/dept/IT-requirements; HR's job is to
 * attach the actual new hire's identity (legal name, employee #, badge #,
 * confirmed start date, personal contact).
 */
function HrFillForm({ ticketId, onSaved }: { ticketId: number; onSaved: () => void }) {
  const { token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [startDateRequest, setStartDateRequest] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hrNotes, setHrNotes] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setSubmitting(true);
    try {
      await hrFill(token, ticketId, {
        full_name: fullName,
        preferred_name: preferredName || undefined,
        employee_number: employeeNumber,
        badge_number: badgeNumber,
        start_date_request: startDateRequest || undefined,
        personal_email: personalEmail || undefined,
        phone: phone || undefined,
        hr_notes: hrNotes || undefined,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
      <h2 className="text-lg font-bold text-theme-primary mb-3">HR — Add Hire Identity</h2>
      <p className="text-sm text-theme-muted mb-4">
        The hiring manager submitted their requisition. Once you&apos;ve identified
        the actual hire, fill in their details below. The ticket then goes back to
        the hiring manager to set the confirmed start date before IT closes it out.
      </p>
      {error && <div className="mb-3 p-3 rounded-lg text-sm font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Full legal name *</label>
          <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Preferred / display name</label>
          <input className="input-field" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Employee number *</label>
          <input className="input-field" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} required placeholder="e.g., 4901" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Badge number *</label>
          <input className="input-field" value={badgeNumber} onChange={(e) => setBadgeNumber(e.target.value)} required placeholder="e.g., 10293" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Requested start date / note to manager</label>
          <input className="input-field" value={startDateRequest} onChange={(e) => setStartDateRequest(e.target.value)} placeholder="e.g., ASAP, or week of July 7 — manager confirms the date" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Personal email</label>
          <input type="email" className="input-field" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="for welcome packet" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Personal phone</label>
          <input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="mb-3">
        <label className="block text-sm font-semibold text-theme-secondary mb-1.5">Notes for IT</label>
        <textarea className="input-field" rows={2} value={hrNotes} onChange={(e) => setHrNotes(e.target.value)} placeholder="Anything IT should know before provisioning" />
      </div>
      <button type="submit" disabled={submitting} className="btn-accent">{submitting ? 'Submitting...' : 'Submit & Send to Manager'}</button>
    </form>
  );
}

const ROLE_FIELDS: [string, string][] = [
  ['job_title', 'Job title'],
  ['department', 'Department'],
  ['employment_type', 'Employment type'],
  ['work_location', 'Work location'],
  ['office_location', 'Office / building'],
  ['target_start_date', 'Target start date'],
  ['manager_name', 'Hiring manager'],
  ['manager_email', 'Manager email'],
];
const IDENTITY_FIELDS: [string, string][] = [
  ['full_name', 'Full name'],
  ['preferred_name', 'Preferred name'],
  ['employee_number', 'Employee #'],
  ['badge_number', 'Badge #'],
  ['start_date', 'Confirmed start date'],
  ['personal_email', 'Personal email'],
  ['phone', 'Phone'],
];
const IT_FIELDS: [string, string][] = [
  ['needs_laptop', 'Laptop'],
  ['laptop_preference', 'Laptop preference'],
  ['needs_monitor', 'Monitor(s)'],
  ['monitor_count', 'Monitor count'],
  ['needs_phone', 'Desk phone'],
  ['needs_headset', 'Headset'],
  ['other_equipment', 'Other equipment'],
  ['needs_m365', 'Microsoft 365'],
  ['needs_vpn', 'VPN'],
  ['software_needed', 'Software'],
  ['shared_mailboxes', 'Shared mailboxes'],
  ['distribution_lists', 'Distribution lists'],
  ['security_groups', 'Security groups'],
  ['network_drives', 'Network drives'],
  ['similar_to_employee_email', 'Copy access from'],
  ['email_alias_preference', 'Email alias preference'],
];

function fmtVal(v: any): string | null {
  if (v === null || v === undefined || v === '' || v === false) return null;
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  if (v === true) return 'Yes';
  return String(v);
}

function FieldRows({ od, fields }: { od: any; fields: [string, string][] }) {
  const rows = fields.map(([k, label]) => [label, fmtVal(od[k])]).filter(([, v]) => v !== null) as [string, string][];
  if (rows.length === 0) return <p className="text-sm text-theme-muted">None specified.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {rows.map(([label, v]) => (
        <div key={label}><span className="text-theme-muted">{label}:</span>{' '}<span className="font-semibold text-theme-primary capitalize">{v}</span></div>
      ))}
    </div>
  );
}

function FieldGroupCard({ title, od, fields }: { title: string; od: any; fields: [string, string][] }) {
  return (
    <div className="card">
      <h2 className="text-lg font-bold text-theme-primary mb-3">{title}</h2>
      <FieldRows od={od} fields={fields} />
    </div>
  );
}

function RoleRequisitionCard({ od, ticket }: { od: any; ticket: any }) {
  const hasIdentity = IDENTITY_FIELDS.some(([k]) => fmtVal(od[k]) !== null);
  return (
    <div className="card" style={{ borderLeft: '4px solid #22c55e' }}>
      <h2 className="text-lg font-bold text-theme-primary mb-3">Role &amp; Requisition</h2>
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div><span className="text-theme-muted">Requested by:</span>{' '}<span className="font-semibold text-theme-primary">{ticket.requester_name}</span></div>
        <div><span className="text-theme-muted">Urgency:</span>{' '}<span className="font-semibold text-theme-primary capitalize">{ticket.urgency}</span></div>
      </div>
      <FieldRows od={od} fields={ROLE_FIELDS} />
      {fmtVal(od.desired_candidate_profile) && (
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-card-hover)' }}>
          <p className="text-sm font-bold text-theme-secondary mb-1">Desired candidate profile</p>
          <p className="text-sm text-theme-primary whitespace-pre-wrap">{od.desired_candidate_profile}</p>
        </div>
      )}
      {fmtVal(od.manager_notes) && (
        <div className="mt-3">
          <p className="text-sm text-theme-muted mb-1">Manager notes:</p>
          <p className="text-sm text-theme-primary whitespace-pre-wrap">{od.manager_notes}</p>
        </div>
      )}
      {hasIdentity && (
        <div className="mt-4 pt-3 border-t border-theme">
          <p className="text-sm font-bold text-theme-secondary mb-2">New hire</p>
          <FieldRows od={od} fields={IDENTITY_FIELDS} />
          {fmtVal(od.hr_notes) && <p className="text-sm text-theme-primary whitespace-pre-wrap mt-2"><span className="text-theme-muted">HR notes:</span> {od.hr_notes}</p>}
        </div>
      )}
    </div>
  );
}

function HrProgressLine({ od, ackAt }: { od: any; ackAt?: string | null }) {
  const search = fmtVal(od.employee_search_status);
  if (!ackAt && !search) return null;
  return (
    <div className="card" style={{ borderLeft: '4px solid #14b8a6' }}>
      {ackAt && <p className="text-sm text-theme-primary">✓ HR confirmed receipt <span className="text-theme-muted">on {new Date(ackAt).toLocaleString()}</span></p>}
      {search && (
        <p className="text-sm text-theme-primary mt-1">
          <span className="text-theme-muted">Search status:</span> {search}
          {od.employee_search_updated_at && <span className="text-theme-muted"> (updated {new Date(od.employee_search_updated_at).toLocaleString()})</span>}
        </p>
      )}
    </div>
  );
}

function SetStartDateCard({ request, onSave, submitting }: { request: string; onSave: (d: string) => void; submitting: boolean }) {
  const [date, setDate] = useState('');
  return (
    <div className="card" style={{ borderLeft: '4px solid #f97316' }}>
      <h2 className="text-lg font-bold text-theme-primary mb-1">Set start date</h2>
      <p className="text-sm text-theme-muted mb-3">
        HR has the new hire ready. As the hiring manager, set the confirmed start date —
        the ticket then goes to IT for final approval.
      </p>
      {request && (
        <p className="text-sm text-theme-primary mb-3"><span className="text-theme-muted">HR&apos;s request:</span> {request}</p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="date" className="input-field sm:w-56" value={date} onChange={(e) => setDate(e.target.value)} />
        <button onClick={() => onSave(date)} disabled={submitting || !date} className="btn-accent whitespace-nowrap">Set start date &amp; send to IT</button>
      </div>
    </div>
  );
}

function HrConfirmCard({ onConfirm, submitting }: { onConfirm: (note: string) => void; submitting: boolean }) {
  const [note, setNote] = useState('');
  return (
    <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
      <h2 className="text-lg font-bold text-theme-primary mb-1">Confirm receipt</h2>
      <p className="text-sm text-theme-muted mb-3">Acknowledge you&apos;ve received this requisition. Add a note (required) — then you can log the employee search and, once you&apos;ve found the hire, add their identity.</p>
      <textarea className="input-field mb-3" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., Received — posting the role and screening candidates this week." />
      <button onClick={() => onConfirm(note)} disabled={submitting || !note.trim()} className="btn-accent">Confirm receipt</button>
    </div>
  );
}

function HrSearchCard({ current, onSave, submitting }: { current: string; onSave: (s: string) => void; submitting: boolean }) {
  const [val, setVal] = useState(current);
  return (
    <div className="card" style={{ borderLeft: '4px solid #14b8a6' }}>
      <h2 className="text-lg font-bold text-theme-primary mb-1">Employee search</h2>
      <p className="text-sm text-theme-muted mb-3">Keep this updated as you recruit. Visible to the hiring manager and IT.</p>
      <textarea className="input-field mb-3" rows={3} value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g., 2 candidates interviewing; offer expected by Friday." />
      <button onClick={() => onSave(val)} disabled={submitting || !val.trim()} className="btn-primary">Save update</button>
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
