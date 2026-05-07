'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  listTrainingItems,
  createTrainingItem,
  listTrainingAssignments,
  assignTraining,
  completeTraining,
  getTrainingRoster,
  getAdminEmployees,
} from '@/lib/api';
import PortalShell from '@/components/layout/PortalShell';

interface TrainingItem {
  id: number;
  title: string;
  description: string | null;
  category: string;
  recurrence_days: number | null;
  reference_url: string | null;
}

interface Assignment {
  id: number;
  training_item_id: number;
  training_title: string;
  training_category: string;
  reference_url: string | null;
  recurrence_days: number | null;
  employee_email: string;
  employee_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  expires_at: string | null;
}

interface Employee {
  email: string;
  full_name: string;
  department?: string | null;
}

interface RosterRow extends Employee {
  open: number;
  overdue: number;
  expiring_soon: number;
}

export default function TrainingPage() {
  const { token, employee } = useAuth();
  const isAdmin = employee?.portal_role === 'admin' || employee?.portal_role === 'hr';

  const [items, setItems] = useState<TrainingItem[]>([]);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemCat, setItemCat] = useState('safety');
  const [itemRecurrence, setItemRecurrence] = useState('');
  const [itemUrl, setItemUrl] = useState('');

  // Assign form
  const [assignItemId, setAssignItemId] = useState<number | null>(null);
  const [assignDue, setAssignDue] = useState('');
  const [assignTo, setAssignTo] = useState<string[]>([]);

  function refresh() {
    if (!token) return;
    listTrainingItems(token).then((d) => setItems(d.items));
    listTrainingAssignments(token).then((d) => setMyAssignments(d.assignments));
    if (isAdmin) {
      getAdminEmployees(token).then((d) =>
        setEmployees(
          d.employees.map((e: any) => ({
            email: e.email,
            full_name: e.full_name,
            department: e.department,
          }))
        )
      );
      getTrainingRoster(token).then((d) => setRoster(d.employees));
    }
  }
  useEffect(refresh, [token, isAdmin]);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      await createTrainingItem(token, {
        title: itemTitle,
        description: itemDesc || null,
        category: itemCat,
        recurrence_days: itemRecurrence ? parseInt(itemRecurrence) : null,
        reference_url: itemUrl || null,
      });
      setItemTitle('');
      setItemDesc('');
      setItemRecurrence('');
      setItemUrl('');
      setShowItemForm(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function doAssign() {
    if (!token || !assignItemId || assignTo.length === 0) return;
    try {
      await assignTraining(token, {
        training_item_id: assignItemId,
        employee_emails: assignTo,
        due_date: assignDue ? new Date(assignDue).toISOString() : null,
      });
      setAssignItemId(null);
      setAssignTo([]);
      setAssignDue('');
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function markComplete(id: number) {
    if (!token) return;
    await completeTraining(token, id);
    refresh();
  }

  return (
    <PortalShell>
      <div className="animate-fade-in-up space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold text-theme-primary">Training</h1>
          <p className="text-sm text-theme-muted mt-1">
            {isAdmin
              ? 'Define training items, assign them to employees, and monitor compliance.'
              : 'Training assignments and completion tracking.'}
          </p>
        </header>

        {error && (
          <div className="card border-l-4 border-red-500 text-sm text-red-600">{error}</div>
        )}

        {/* My training */}
        <section>
          <h2 className="text-lg font-bold text-theme-primary mb-3">My training</h2>
          {myAssignments.length === 0 ? (
            <div className="card text-sm text-theme-muted">
              No training assigned to you. Nice.
            </div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-table-head">
                  <tr>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold">
                      Training
                    </th>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold">Due</th>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold">Status</th>
                    <th className="text-left px-3 py-2 text-theme-muted font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {myAssignments.map((a) => {
                    const overdueDue =
                      a.due_date && !a.completed_at && new Date(a.due_date) < new Date();
                    const expired =
                      a.expires_at && new Date(a.expires_at) < new Date();
                    return (
                      <tr key={a.id} className="border-t border-theme">
                        <td className="px-3 py-2">
                          {a.reference_url ? (
                            <a
                              href={a.reference_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:underline font-semibold"
                            >
                              {a.training_title}
                            </a>
                          ) : (
                            <span className="font-semibold text-theme-primary">
                              {a.training_title}
                            </span>
                          )}
                          <p className="text-xs text-theme-muted">{a.training_category}</p>
                        </td>
                        <td className="px-3 py-2 text-theme-secondary">
                          {a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {!a.completed_at && overdueDue && (
                            <span className="badge bg-red-100 text-red-700">Overdue</span>
                          )}
                          {!a.completed_at && !overdueDue && (
                            <span className="badge bg-blue-100 text-blue-700">Open</span>
                          )}
                          {a.completed_at && !expired && (
                            <span className="badge bg-emerald-100 text-emerald-700">
                              Complete{a.expires_at ? ` (renew ${new Date(a.expires_at).toLocaleDateString()})` : ''}
                            </span>
                          )}
                          {a.completed_at && expired && (
                            <span className="badge bg-red-100 text-red-700">Expired</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {!a.completed_at || expired ? (
                            <button onClick={() => markComplete(a.id)} className="btn-secondary text-xs">
                              Mark complete
                            </button>
                          ) : (
                            <span className="text-xs text-theme-faint">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isAdmin && (
          <>
            {/* Roster summary */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-theme-primary">Compliance roster</h2>
              </div>
              {roster === null ? (
                <div className="card text-sm text-theme-muted">Loading roster…</div>
              ) : (
                <div className="card overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-table-head">
                      <tr>
                        <th className="text-left px-3 py-2 text-theme-muted font-semibold">
                          Employee
                        </th>
                        <th className="text-left px-3 py-2 text-theme-muted font-semibold">
                          Department
                        </th>
                        <th className="text-center px-3 py-2 text-theme-muted font-semibold">
                          Open
                        </th>
                        <th className="text-center px-3 py-2 text-theme-muted font-semibold">
                          Overdue
                        </th>
                        <th className="text-center px-3 py-2 text-theme-muted font-semibold">
                          Expiring &lt;30d
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster
                        .filter((r) => r.open || r.overdue || r.expiring_soon)
                        .map((r) => (
                          <tr key={r.email} className="border-t border-theme">
                            <td className="px-3 py-2 text-theme-primary font-semibold">
                              {r.full_name}
                            </td>
                            <td className="px-3 py-2 text-theme-secondary">
                              {r.department || '—'}
                            </td>
                            <td className="px-3 py-2 text-center">{r.open || ''}</td>
                            <td className="px-3 py-2 text-center text-red-600 font-bold">
                              {r.overdue || ''}
                            </td>
                            <td className="px-3 py-2 text-center text-amber-600 font-bold">
                              {r.expiring_soon || ''}
                            </td>
                          </tr>
                        ))}
                      {roster.every((r) => !r.open && !r.overdue && !r.expiring_soon) && (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-theme-muted">
                            Nobody has any open or overdue training. Excellent.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Define / assign training */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-theme-primary">Training catalog</h2>
                <button onClick={() => setShowItemForm((s) => !s)} className="btn-secondary">
                  {showItemForm ? 'Close' : 'New training item'}
                </button>
              </div>

              {showItemForm && (
                <form onSubmit={createItem} className="card space-y-3 mb-4">
                  <input
                    className="input-field"
                    placeholder="Title (e.g. Forklift certification)"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    required
                  />
                  <textarea
                    className="input-field"
                    placeholder="Description (optional)"
                    rows={2}
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <select
                      className="input-field flex-1"
                      value={itemCat}
                      onChange={(e) => setItemCat(e.target.value)}
                    >
                      {['safety', 'quality', 'compliance', 'operational', 'other'].map((c) => (
                        <option key={c} value={c}>
                          {c[0].toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input-field w-48"
                      placeholder="Recurrence (days, optional)"
                      type="number"
                      value={itemRecurrence}
                      onChange={(e) => setItemRecurrence(e.target.value)}
                    />
                  </div>
                  <input
                    className="input-field"
                    placeholder="Reference URL (optional)"
                    value={itemUrl}
                    onChange={(e) => setItemUrl(e.target.value)}
                  />
                  <button type="submit" className="btn-accent">
                    Create
                  </button>
                </form>
              )}

              {items.length === 0 ? (
                <div className="card text-sm text-theme-muted">
                  No training items defined yet.
                </div>
              ) : (
                <div className="card p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-table-head">
                      <tr>
                        <th className="text-left px-3 py-2 text-theme-muted font-semibold">
                          Title
                        </th>
                        <th className="text-left px-3 py-2 text-theme-muted font-semibold">
                          Category
                        </th>
                        <th className="text-left px-3 py-2 text-theme-muted font-semibold">
                          Renews
                        </th>
                        <th className="text-left px-3 py-2 text-theme-muted font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="border-t border-theme">
                          <td className="px-3 py-2 font-semibold text-theme-primary">
                            {it.title}
                          </td>
                          <td className="px-3 py-2 text-theme-secondary">{it.category}</td>
                          <td className="px-3 py-2 text-theme-secondary">
                            {it.recurrence_days ? `every ${it.recurrence_days}d` : 'one-time'}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => setAssignItemId(it.id)}
                              className="btn-secondary text-xs"
                            >
                              Assign
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {assignItemId !== null && (
                <div className="card mt-4 space-y-3">
                  <h3 className="font-bold text-theme-primary">
                    Assign: {items.find((i) => i.id === assignItemId)?.title}
                  </h3>
                  <input
                    type="date"
                    className="input-field"
                    value={assignDue}
                    onChange={(e) => setAssignDue(e.target.value)}
                  />
                  <select
                    multiple
                    value={assignTo}
                    onChange={(e) =>
                      setAssignTo(Array.from(e.target.selectedOptions).map((o) => o.value))
                    }
                    className="input-field h-48"
                  >
                    {employees.map((emp) => (
                      <option key={emp.email} value={emp.email}>
                        {emp.full_name} — {emp.email}
                        {emp.department ? ` (${emp.department})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={doAssign} className="btn-accent">
                      Assign to {assignTo.length || 0} employee
                      {assignTo.length === 1 ? '' : 's'}
                    </button>
                    <button onClick={() => setAssignItemId(null)} className="btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PortalShell>
  );
}
