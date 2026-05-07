'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtNumber, fmtDate } from '@/lib/format';
import DataTable from '@/components/shared/DataTable';
import StatCard from '@/components/shared/StatCard';

interface Row {
  warehouse: string;
  part_number: string;
  part_description: string | null;
  uom: string | null;
  qty_on_hand: number;
  prev_qty: number;
  change: number;
}

interface Summary {
  warehouse: string;
  line_count: number;
  total_qty: number;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [prevDate, setPrevDate] = useState<string | null>(null);
  const [warehouse, setWarehouse] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (warehouse) params.set('warehouse', warehouse);
    if (q) params.set('q', q);
    const [inv, sum] = await Promise.all([
      api.get<{ data: Row[]; snapshot_date: string | null; previous_date: string | null }>(
        `/inventory?${params.toString()}`
      ),
      api.get<{ data: Summary[]; snapshot_date: string | null }>('/inventory/summary'),
    ]);
    setRows(inv.data);
    setSnapshotDate(inv.snapshot_date);
    setPrevDate(inv.previous_date);
    setSummary(sum.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy-800 dark:text-white">Inventory</h2>
        <p className="text-xs text-navy-500 dark:text-navy-300">
          Snapshot: {fmtDate(snapshotDate)} · Δ vs {fmtDate(prevDate)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {summary.map((s) => (
          <StatCard
            key={s.warehouse}
            label={s.warehouse === 'acme_main' ? 'Acme Industries main' : s.warehouse === 'lowell' ? 'Lowell' : s.warehouse}
            value={fmtNumber(s.total_qty)}
            sub={`${fmtNumber(s.line_count)} parts`}
            tone={s.warehouse === 'lowell' ? 'navy' : 'amber'}
          />
        ))}
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium mb-1">Search part</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Part # or description"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Warehouse</label>
            <select
              className="input"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
            >
              <option value="">All</option>
              <option value="acme_main">Acme Industries main</option>
              <option value="lowell">Lowell</option>
            </select>
          </div>
          <button className="btn btn-primary text-xs" onClick={load}>
            Filter
          </button>
        </div>

        {loading ? (
          <div className="text-sm">Loading…</div>
        ) : (
          <DataTable
            rows={rows}
            rowKey={(r, i) => `${r.warehouse}-${r.part_number}-${i}`}
            columns={[
              { key: 'warehouse', label: 'WH' },
              { key: 'part_number', label: 'Part' },
              { key: 'part_description', label: 'Description' },
              { key: 'uom', label: 'UOM' },
              {
                key: 'qty_on_hand',
                label: 'On hand',
                align: 'right',
                render: (r) => fmtNumber(r.qty_on_hand, 2),
              },
              {
                key: 'change',
                label: 'Δ',
                align: 'right',
                render: (r) => (
                  <span
                    className={
                      r.change > 0
                        ? 'text-green-600'
                        : r.change < 0
                          ? 'text-red-600'
                          : 'text-navy-500'
                    }
                  >
                    {r.change > 0 ? '+' : ''}
                    {fmtNumber(r.change, 2)}
                  </span>
                ),
              },
            ]}
            empty="No inventory matches these filters."
          />
        )}
      </div>
    </div>
  );
}
