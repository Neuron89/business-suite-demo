'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  listSuggestions,
  createSuggestion,
  patchSuggestion,
} from '@/lib/api';
import PortalShell from '@/components/layout/PortalShell';

interface Suggestion {
  id: number;
  submitter_email: string | null;
  submitter_name: string | null;
  category: string;
  title: string;
  body: string;
  status: string;
  reviewed_by_email: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  is_anonymous: boolean;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  under_review: '#f59e0b',
  in_progress: '#06b6d4',
  implemented: '#22c55e',
  declined: '#ef4444',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  implemented: 'Implemented',
  declined: 'Declined',
};

const CATEGORIES = ['safety', 'process', 'facility', 'it', 'quality', 'other'];

export default function SuggestionsPage() {
  const { token, employee } = useAuth();
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('other');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canTriage =
    employee?.portal_role === 'admin' ||
    employee?.portal_role === 'hr' ||
    employee?.portal_role === 'manager';

  function refresh() {
    if (!token) return;
    listSuggestions(token)
      .then((d) => setItems(d.suggestions))
      .catch((e) => setError((e as Error).message));
  }
  useEffect(refresh, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await createSuggestion(token, {
        title,
        body,
        category,
        is_anonymous: anonymous,
      });
      setTitle('');
      setBody('');
      setCategory('other');
      setAnonymous(false);
      setShowForm(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    if (!token) return;
    await patchSuggestion(token, id, { status });
    refresh();
  }

  return (
    <PortalShell>
      <div className="animate-fade-in-up space-y-6">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-theme-primary">Suggestion Box</h1>
            <p className="text-sm text-theme-muted mt-1">
              See an improvement opportunity? Tell us. Anonymous submissions are welcome.
            </p>
          </div>
          <button onClick={() => setShowForm((s) => !s)} className="btn-accent">
            {showForm ? 'Close' : 'New Suggestion'}
          </button>
        </header>

        {error && (
          <div className="card border-l-4 border-red-500 text-sm text-red-600">{error}</div>
        )}

        {showForm && (
          <form onSubmit={submit} className="card space-y-3">
            <h2 className="text-lg font-bold text-theme-primary">Submit a suggestion</h2>
            <input
              className="input-field"
              placeholder="Short title"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              className="input-field"
              placeholder="Describe the suggestion. What's the issue? What change would help?"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
            <div className="flex gap-3 text-sm">
              <label className="flex-1">
                <span className="block text-theme-secondary font-semibold mb-1">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c[0].toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 pb-1">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                />
                <span className="text-theme-secondary">Submit anonymously</span>
              </label>
            </div>
            <button type="submit" disabled={submitting} className="btn-accent">
              {submitting ? 'Sending...' : 'Submit'}
            </button>
          </form>
        )}

        {items === null ? (
          <div className="card text-sm text-theme-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="card text-sm text-theme-muted">
            No suggestions yet. Be the first to share an idea.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((s) => (
              <li key={s.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="badge"
                        style={{
                          background: `${STATUS_COLORS[s.status]}20`,
                          color: STATUS_COLORS[s.status],
                        }}
                      >
                        {STATUS_LABEL[s.status] || s.status}
                      </span>
                      <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {s.category}
                      </span>
                      <h2 className="text-base font-bold text-theme-primary">{s.title}</h2>
                    </div>
                    <p className="text-xs text-theme-muted mt-1">
                      {s.is_anonymous ? 'Anonymous' : s.submitter_name || s.submitter_email} ·{' '}
                      {new Date(s.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-theme-secondary mt-3 whitespace-pre-wrap">
                      {s.body}
                    </p>
                    {s.review_notes && (
                      <p className="text-xs text-theme-muted mt-3 italic">
                        Reviewer notes: {s.review_notes}
                      </p>
                    )}
                  </div>
                  {canTriage && (
                    <select
                      value={s.status}
                      onChange={(e) => updateStatus(s.id, e.target.value)}
                      className="input-field py-1 px-2 text-xs"
                    >
                      {Object.keys(STATUS_LABEL).map((k) => (
                        <option key={k} value={k}>
                          {STATUS_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
