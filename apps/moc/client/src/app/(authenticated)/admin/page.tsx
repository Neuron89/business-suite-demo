'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, isAdminUser } from '@/lib/auth-context';
import { getUsers, createUser, updateUser, getSystemRequests, getSystemRequest, updateSystemRequest, getTemplatesAll, createTemplate, updateTemplate, deleteTemplate } from '@/lib/api';
import { ROLES, STANDARD_MOC_FIELDS, CUSTOM_FIELD_TYPES, REVIEWER_ROLES, AFFECTED_AREAS, AFFECTED_AREA_LABELS, type AffectedArea } from '@moc/shared';
import type { FieldConfigEntry, CustomFieldDefinition, WorkflowConfig } from '@moc/shared';

type AdminTab = 'users' | 'system_requests' | 'templates';

export default function AdminPage() {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as AdminTab | null;
  const [activeTab, setActiveTab] = useState<AdminTab>(
    tabParam && ['users', 'system_requests', 'templates'].includes(tabParam) ? tabParam : 'users'
  );

  useEffect(() => {
    if (tabParam && ['users', 'system_requests', 'templates'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  if (!user || !isAdminUser(user)) {
    return <div className="text-red-500 text-center py-12">Admin access required</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Administration</h1>

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex space-x-1">
          {([
            { key: 'users' as AdminTab, label: 'User Management' },
            { key: 'system_requests' as AdminTab, label: 'System Requests' },
            { key: 'templates' as AdminTab, label: 'Templates' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'users' && <UserManagementTab token={token!} />}
      {activeTab === 'system_requests' && <SystemRequestsTab token={token!} />}
      {activeTab === 'templates' && <TemplatesTab token={token!} />}
    </div>
  );
}

function UserManagementTab({ token }: { token: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'operations' as string, assigned_areas: [] as string[] });
  const [loading, setLoading] = useState(false);
  const [editingAreasId, setEditingAreasId] = useState<number | null>(null);
  const [editingAreas, setEditingAreas] = useState<string[]>([]);

  useEffect(() => {
    getUsers(token).then(setUsers).catch((err) => setError(err.message));
  }, [token]);

  async function handleCreate() {
    setLoading(true);
    try {
      await createUser(token, form);
      setShowCreate(false);
      setForm({ email: '', password: '', name: '', role: 'operations', assigned_areas: [] });
      const updated = await getUsers(token);
      setUsers(updated);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(userId: number, isActive: boolean) {
    try {
      await updateUser(token, userId, { is_active: !isActive });
      const updated = await getUsers(token);
      setUsers(updated);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function changeRole(userId: number, role: string) {
    try {
      await updateUser(token, userId, { role });
      const updated = await getUsers(token);
      setUsers(updated);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function toggleAdminAccess(userId: number, current: boolean) {
    try {
      await updateUser(token, userId, { admin_access: !current });
      const updated = await getUsers(token);
      setUsers(updated);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function toggleApprover(userId: number, current: boolean) {
    try {
      await updateUser(token, userId, { is_approver: !current });
      const updated = await getUsers(token);
      setUsers(updated);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function saveAreas(userId: number) {
    try {
      await updateUser(token, userId, { assigned_areas: editingAreas });
      setEditingAreasId(null);
      const updated = await getUsers(token);
      setUsers(updated);
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          {showCreate ? 'Cancel' : 'Create User'}
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6 space-y-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">New User</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field" minLength={8} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-field">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Assigned Areas</label>
            <div className="flex flex-wrap gap-3">
              {AFFECTED_AREAS.map((area) => (
                <label key={area} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.assigned_areas.includes(area)}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...form.assigned_areas, area]
                        : form.assigned_areas.filter((a) => a !== area);
                      setForm({ ...form, assigned_areas: updated });
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{AFFECTED_AREA_LABELS[area]}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleCreate} disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Role</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Areas</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Approver</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Admin</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-300">{u.id}</td>
                  <td className="py-3 px-4 font-medium">{u.name}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{u.email}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className="text-xs rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 px-2 py-1 capitalize"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    {editingAreasId === u.id ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {AFFECTED_AREAS.map((area) => (
                            <label key={area} className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingAreas.includes(area)}
                                onChange={(e) => {
                                  setEditingAreas(e.target.checked
                                    ? [...editingAreas, area]
                                    : editingAreas.filter((a) => a !== area));
                                }}
                                className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-300">{AFFECTED_AREA_LABELS[area]}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => saveAreas(u.id)} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Save</button>
                          <button onClick={() => setEditingAreasId(null)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex flex-wrap gap-1 cursor-pointer min-h-[24px]"
                        onClick={() => { setEditingAreasId(u.id); setEditingAreas(u.assigned_areas || []); }}
                        title="Click to edit areas"
                      >
                        {(u.assigned_areas || []).length > 0 ? (
                          (u.assigned_areas as string[]).map((area: string) => (
                            <span key={area} className="badge bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                              {AFFECTED_AREA_LABELS[area as AffectedArea] || area}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400 italic">None</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleApprover(u.id, u.is_approver)}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${
                        u.is_approver
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                      }`}
                      title="Toggle whether this user can act as an MOC approver"
                    >
                      {u.is_approver ? 'Approver' : 'Off'}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    {['super_admin', 'admin', 'moc_manager'].includes(u.role) ? (
                      <span className="text-xs text-gray-400 italic">Role-based</span>
                    ) : (
                      <button
                        onClick={() => toggleAdminAccess(u.id, u.admin_access)}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${
                          u.admin_access
                            ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
                            : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                        }`}
                      >
                        {u.admin_access ? 'Granted' : 'Off'}
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleActive(u.id, u.is_active)}
                      className={`text-xs font-medium ${u.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-500',
};

function SystemRequestsTab({ token }: { token: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [screenshotData, setScreenshotData] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ status: '', admin_notes: '' });

  useEffect(() => {
    fetchRequests();
  }, [token, filterStatus]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const data = await getSystemRequests(token, filterStatus !== 'all' ? filterStatus : undefined);
      setRequests(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!screenshotData[id]) {
      try {
        const full = await getSystemRequest(token, id);
        if (full.screenshot_data) {
          setScreenshotData((prev) => ({ ...prev, [id]: full.screenshot_data }));
        }
      } catch (err) {
        console.error('Failed to load screenshot:', err);
      }
    }
  }

  async function handleUpdate(id: number) {
    try {
      await updateSystemRequest(token, id, editForm);
      setEditingId(null);
      fetchRequests();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'new', 'reviewed', 'in_progress', 'completed', 'dismissed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors capitalize ${
              filterStatus === s
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-center py-8">No system requests found</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="card">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{req.user_name}</span>
                  <span className="text-gray-400 dark:text-gray-500 text-sm ml-2">{req.user_email}</span>
                </div>
                <span className={`badge capitalize ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-600'}`}>
                  {req.status.replace(/_/g, ' ')}
                </span>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{req.description}</p>

              <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 mb-3">
                <span>Page: {req.page_url}</span>
                <span>{new Date(req.created_at).toLocaleString()}</span>
              </div>

              {/* Screenshot toggle */}
              {(req.has_screenshot === 'true' || req.has_screenshot === true) && (
                <div className="mb-3">
                  <button
                    onClick={() => handleExpand(req.id)}
                    className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                  >
                    {expandedId === req.id ? 'Hide Screenshot' : 'View Screenshot'}
                  </button>
                  {expandedId === req.id && screenshotData[req.id] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={screenshotData[req.id]}
                      alt="User screenshot"
                      className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 w-full object-contain bg-gray-50 dark:bg-gray-900"
                    />
                  )}
                  {expandedId === req.id && !screenshotData[req.id] && (
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Loading screenshot...</p>
                  )}
                </div>
              )}

              {/* Admin notes display */}
              {req.admin_notes && editingId !== req.id && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-2">Admin notes: {req.admin_notes}</p>
              )}

              {/* Edit controls */}
              {editingId === req.id ? (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="input-field text-sm w-48"
                    >
                      {['new', 'reviewed', 'in_progress', 'completed', 'dismissed'].map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Admin Notes</label>
                    <textarea
                      value={editForm.admin_notes}
                      onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })}
                      className="input-field text-sm"
                      rows={2}
                      placeholder="Admin notes..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(req.id)} className="btn-primary text-sm">Save</button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingId(req.id);
                    setEditForm({ status: req.status, admin_notes: req.admin_notes || '' });
                  }}
                  className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                >
                  Update Status
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Field labels for display ─────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  change_type: 'Change Type',
  affected_areas: 'Affected Areas',
  ehs_assessment: 'EHS Assessment',
  justification: 'Justification',
  proposed_start_date: 'Proposed Start Date',
  proposed_end_date: 'Proposed End Date',
  is_psm_relevant: 'PSM Relevant',
  emergency_change: 'Emergency Change',
  departments_involved: 'Departments Involved',
  // CRF fields
  crf_change_type: 'CRF Change Type',
  change_duration: 'Change Duration',
  impact_assessment: 'Impact Assessment',
  crf_risk_assessment: 'CRF Risk Assessment',
  attachment_checklist: 'Attachment Checklist',
  implementation_plan: 'Implementation Plan',
  post_implementation_verification: 'Post-Implementation Verification',
};

const DEFAULT_FIELD_CONFIG: Record<string, FieldConfigEntry> = {};
for (const f of STANDARD_MOC_FIELDS) {
  DEFAULT_FIELD_CONFIG[f] = { visible: true, required: f === 'title' || f === 'description' || f === 'change_type' };
}

const DEFAULT_WORKFLOW: WorkflowConfig = {
  risk_assessment_required: true,
  pssr_required: true,
  required_reviewers: ['ehs', 'operations', 'qc'],
  skip_steps: [],
};

function TemplatesTab({ token }: { token: string }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, [token]);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const data = await getTemplatesAll(token);
      setTemplates(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleNew() {
    setEditing({
      id: null,
      name: '',
      description: '',
      is_default: false,
      field_config: { ...DEFAULT_FIELD_CONFIG },
      custom_fields: [],
      workflow_config: { ...DEFAULT_WORKFLOW },
    });
  }

  function handleEdit(t: any) {
    const fc = typeof t.field_config === 'string' ? JSON.parse(t.field_config) : t.field_config;
    const cf = typeof t.custom_fields === 'string' ? JSON.parse(t.custom_fields) : t.custom_fields;
    const wc = typeof t.workflow_config === 'string' ? JSON.parse(t.workflow_config) : t.workflow_config;
    setEditing({
      id: t.id,
      name: t.name,
      description: t.description,
      is_default: t.is_default,
      field_config: fc,
      custom_fields: cf || [],
      workflow_config: wc,
    });
  }

  async function handleDelete(id: number) {
    if (!confirm('Deactivate this template?')) return;
    try {
      await deleteTemplate(token, id);
      fetchTemplates();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSave() {
    if (!editing) return;
    try {
      const skipSteps: string[] = [];
      if (!editing.workflow_config.risk_assessment_required) skipSteps.push('risk_assessment');
      if (!editing.workflow_config.pssr_required) {
        skipSteps.push('pssr_pending');
        skipSteps.push('pssr_complete');
      }

      const payload = {
        name: editing.name,
        description: editing.description,
        is_default: editing.is_default,
        field_config: editing.field_config,
        custom_fields: editing.custom_fields,
        workflow_config: {
          ...editing.workflow_config,
          skip_steps: skipSteps,
        },
      };

      if (editing.id) {
        await updateTemplate(token, editing.id, payload);
      } else {
        await createTemplate(token, payload);
      }
      setEditing(null);
      fetchTemplates();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (editing) {
    return (
      <TemplateForm
        editing={editing}
        setEditing={setEditing}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={handleNew} className="btn-primary">Create Template</button>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">Loading...</p>
      ) : templates.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-center py-8">No templates yet</p>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => {
            const wc = typeof t.workflow_config === 'string' ? JSON.parse(t.workflow_config) : t.workflow_config;
            return (
              <div key={t.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">{t.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.description || 'No description'}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {t.is_default && <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Default</span>}
                      {!t.is_active && <span className="badge bg-red-100 text-red-700">Inactive</span>}
                      <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {wc?.required_reviewers?.length || 0} reviewer{(wc?.required_reviewers?.length || 0) !== 1 ? 's' : ''}
                      </span>
                      {!wc?.risk_assessment_required && <span className="badge bg-yellow-100 text-yellow-700">No Risk Assessment</span>}
                      {!wc?.pssr_required && <span className="badge bg-yellow-100 text-yellow-700">No PSSR</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(t)} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Edit</button>
                    {t.is_active && (
                      <button onClick={() => handleDelete(t.id)} className="text-xs text-red-600 hover:text-red-800 font-medium">Deactivate</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TemplateForm({
  editing,
  setEditing,
  onSave,
  onCancel,
}: {
  editing: any;
  setEditing: (v: any) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  function updateField(field: string, key: 'visible' | 'required', value: boolean) {
    const updated = { ...editing.field_config, [field]: { ...editing.field_config[field], [key]: value } };
    if ((field === 'title' || field === 'description') && key === 'visible') updated[field].visible = true;
    if ((field === 'title' || field === 'description') && key === 'required') updated[field].required = true;
    setEditing({ ...editing, field_config: updated });
  }

  function addCustomField() {
    const newField: CustomFieldDefinition = {
      id: `custom_${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
    };
    setEditing({ ...editing, custom_fields: [...editing.custom_fields, newField] });
  }

  function updateCustomField(index: number, updates: Partial<CustomFieldDefinition>) {
    const updated = [...editing.custom_fields];
    updated[index] = { ...updated[index], ...updates };
    setEditing({ ...editing, custom_fields: updated });
  }

  function removeCustomField(index: number) {
    const updated = editing.custom_fields.filter((_: any, i: number) => i !== index);
    setEditing({ ...editing, custom_fields: updated });
  }

  function toggleReviewer(role: string) {
    const current = editing.workflow_config.required_reviewers || [];
    const updated = current.includes(role)
      ? current.filter((r: string) => r !== role)
      : [...current, role];
    if (updated.length === 0) return;
    setEditing({
      ...editing,
      workflow_config: { ...editing.workflow_config, required_reviewers: updated },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {editing.id ? 'Edit Template' : 'Create Template'}
        </h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onSave} className="btn-primary">Save Template</button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Template Name *</label>
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="input-field"
              placeholder="e.g., Minor Change"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.is_default}
                onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">Set as default template</span>
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description</label>
          <textarea
            value={editing.description}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            className="input-field"
            rows={2}
            placeholder="Describe when this template should be used..."
          />
        </div>
      </div>

      {/* Field Configuration */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Field Configuration</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Configure which standard fields appear on the MOC form and whether they are required.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Field</th>
                <th className="text-center py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Visible</th>
                <th className="text-center py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Required</th>
              </tr>
            </thead>
            <tbody>
              {STANDARD_MOC_FIELDS.map((field) => {
                const config = editing.field_config[field] || { visible: true, required: false };
                const isLocked = field === 'title' || field === 'description';
                return (
                  <tr key={field} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                      {FIELD_LABELS[field] || field}
                      {isLocked && <span className="text-xs text-gray-400 ml-1">(locked)</span>}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={config.visible}
                        onChange={(e) => updateField(field, 'visible', e.target.checked)}
                        disabled={isLocked}
                        className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={config.required}
                        onChange={(e) => updateField(field, 'required', e.target.checked)}
                        disabled={isLocked || !config.visible}
                        className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Fields */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Custom Fields</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add additional fields specific to this template type.</p>
          </div>
          <button onClick={addCustomField} className="btn-secondary text-sm">Add Field</button>
        </div>

        {editing.custom_fields.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">No custom fields added</p>
        ) : (
          <div className="space-y-4">
            {editing.custom_fields.map((cf: any, idx: number) => (
              <div key={cf.id || idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Field #{idx + 1}</span>
                  <button onClick={() => removeCustomField(idx)} className="text-xs text-red-600 hover:text-red-800">Remove</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Label *</label>
                    <input
                      value={cf.label}
                      onChange={(e) => updateCustomField(idx, { label: e.target.value })}
                      className="input-field text-sm"
                      placeholder="Field label"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Type</label>
                    <select
                      value={cf.type}
                      onChange={(e) => updateCustomField(idx, { type: e.target.value as any })}
                      className="input-field text-sm"
                    >
                      {CUSTOM_FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cf.required}
                        onChange={(e) => updateCustomField(idx, { required: e.target.checked })}
                        className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Required</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Placeholder</label>
                    <input
                      value={cf.placeholder || ''}
                      onChange={(e) => updateCustomField(idx, { placeholder: e.target.value })}
                      className="input-field text-sm"
                      placeholder="Optional placeholder text"
                    />
                  </div>
                  {cf.type === 'dropdown' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Options (comma-separated)</label>
                      <input
                        value={(cf.options || []).join(', ')}
                        onChange={(e) => updateCustomField(idx, {
                          options: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean),
                        })}
                        className="input-field text-sm"
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workflow Configuration */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Workflow Configuration</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Configure which workflow steps and approvals are required.</p>

        <div className="space-y-4">
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.workflow_config.risk_assessment_required}
                onChange={(e) => setEditing({
                  ...editing,
                  workflow_config: { ...editing.workflow_config, risk_assessment_required: e.target.checked },
                })}
                className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">Risk Assessment Required</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.workflow_config.pssr_required}
                onChange={(e) => setEditing({
                  ...editing,
                  workflow_config: { ...editing.workflow_config, pssr_required: e.target.checked },
                })}
                className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">PSSR Required</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Required Reviewers (at least 1)</label>
            <div className="flex gap-4 flex-wrap">
              {REVIEWER_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(editing.workflow_config.required_reviewers || []).includes(role)}
                    onChange={() => toggleReviewer(role)}
                    className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200 capitalize">{role}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
