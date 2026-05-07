'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  listAnnouncements,
  createAnnouncement,
  ackAnnouncement,
  deleteAnnouncement,
} from '@/lib/api';
import PortalShell from '@/components/layout/PortalShell';

interface Announcement {
  id: number;
  title: string;
  body: string;
  author_name: string | null;
  pinned: boolean;
  expires_at: string | null;
  audience_roles: string[] | null;
  require_ack: boolean;
  acknowledged: boolean;
  created_at: string;
}

export default function AnnouncementsPage() {
  const { token, employee } = useAuth();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Compose form
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [requireAck, setRequireAck] = useState(false);
  const [posting, setPosting] = useState(false);

  const isAdmin = employee?.portal_role === 'admin' || employee?.portal_role === 'hr';

  function refresh() {
    if (!token) return;
    listAnnouncements(token)
      .then((d) => setItems(d.announcements))
      .catch((e) => setError((e as Error).message));
  }
  useEffect(refresh, [token]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPosting(true);
    try {
      await createAnnouncement(token, {
        title,
        body,
        pinned,
        require_ack: requireAck,
      });
      setTitle('');
      setBody('');
      setPinned(false);
      setRequireAck(false);
      setShowCompose(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  async function ack(id: number) {
    if (!token) return;
    await ackAnnouncement(token, id);
    refresh();
  }

  async function remove(id: number) {
    if (!token) return;
    if (!confirm('Delete this announcement?')) return;
    await deleteAnnouncement(token, id);
    refresh();
  }

  return (
    <PortalShell>
      <div className="animate-fade-in-up space-y-6">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-theme-primary">Announcements</h1>
            <p className="text-sm text-theme-muted mt-1">
              {isAdmin
                ? 'Post company-wide notices.'
                : 'Latest news and notices from leadership.'}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowCompose((s) => !s)} className="btn-accent">
              {showCompose ? 'Close' : 'New Announcement'}
            </button>
          )}
        </header>

        {error && (
          <div className="card border-l-4 border-red-500 text-sm text-red-600">{error}</div>
        )}

        {showCompose && isAdmin && (
          <form onSubmit={post} className="card space-y-3">
            <h2 className="text-lg font-bold text-theme-primary">New announcement</h2>
            <input
              className="input-field"
              placeholder="Title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              className="input-field"
              placeholder="Body — what do people need to know?"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
            <div className="flex gap-4 text-sm text-theme-secondary">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                Pin to top
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireAck}
                  onChange={(e) => setRequireAck(e.target.checked)}
                />
                Require acknowledgement
              </label>
            </div>
            <button type="submit" disabled={posting} className="btn-accent">
              {posting ? 'Posting...' : 'Post'}
            </button>
          </form>
        )}

        {items === null ? (
          <div className="card text-sm text-theme-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="card text-sm text-theme-muted">No announcements right now.</div>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <li key={a.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {a.pinned && (
                        <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Pinned
                        </span>
                      )}
                      {a.require_ack && !a.acknowledged && (
                        <span className="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          Action required
                        </span>
                      )}
                      <h2 className="text-lg font-bold text-theme-primary">{a.title}</h2>
                    </div>
                    <p className="text-xs text-theme-muted mt-1">
                      {a.author_name || 'Admin'} · {new Date(a.created_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-theme-secondary mt-3 whitespace-pre-wrap">
                      {a.body}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => remove(a.id)}
                      className="btn-danger text-xs"
                      title="Delete"
                    >
                      Delete
                    </button>
                  )}
                </div>
                {a.require_ack && !a.acknowledged && (
                  <div className="mt-4">
                    <button onClick={() => ack(a.id)} className="btn-primary">
                      Acknowledge
                    </button>
                  </div>
                )}
                {a.require_ack && a.acknowledged && (
                  <p className="mt-3 text-xs text-emerald-600 font-semibold">✓ Acknowledged</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
