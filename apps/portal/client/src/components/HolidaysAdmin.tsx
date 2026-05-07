'use client';

import { useEffect, useState } from 'react';
import {
  listHolidays,
  createHoliday,
  deleteHoliday,
  type Holiday,
} from '@/lib/api';

export default function HolidaysAdmin({ token }: { token: string }) {
  const [items, setItems] = useState<Holiday[] | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    listHolidays(token)
      .then((r) => setItems(r.holidays))
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    refresh();
  }, [token]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !date) return;
    setBusy(true);
    setError(null);
    try {
      await createHoliday(token, { name: name.trim(), date, kind: 'company' });
      setName('');
      setDate('');
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this holiday?')) return;
    await deleteHoliday(token, id);
    refresh();
  }

  const upcoming = (items || []).filter(
    (h) => new Date(h.date) >= new Date(new Date().toDateString())
  );

  return (
    <section>
      <h2 className="text-lg font-bold text-theme-primary mb-3">Company holidays & events</h2>
      <p className="text-xs text-theme-muted mb-3">
        Holidays in the next 14 days appear in the home-page banner. Federal holidays are seeded;
        add company-specific events (plant shutdowns, summer hours, etc.) below.
      </p>
      {error && (
        <div className="card border-l-4 border-red-500 text-sm text-red-600 mb-3">{error}</div>
      )}
      <form onSubmit={add} className="card flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Event name (e.g. Summer plant shutdown)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field flex-1"
          required
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-field"
          required
        />
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      {items === null ? (
        <div className="card text-sm text-theme-muted">Loading…</div>
      ) : upcoming.length === 0 ? (
        <div className="card text-sm text-theme-muted">No upcoming holidays.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-table-head">
              <tr>
                <th className="text-left px-3 py-2 text-theme-muted font-semibold">Date</th>
                <th className="text-left px-3 py-2 text-theme-muted font-semibold">Name</th>
                <th className="text-left px-3 py-2 text-theme-muted font-semibold">Type</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((h) => (
                <tr key={h.id} className="border-t border-theme">
                  <td className="px-3 py-2 text-theme-primary">
                    {new Date(h.date).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2 text-theme-primary">{h.name}</td>
                  <td className="px-3 py-2 text-theme-muted text-xs uppercase">{h.kind}</td>
                  <td className="px-3 py-2 text-right">
                    {h.kind === 'company' && (
                      <button
                        type="button"
                        onClick={() => remove(h.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
