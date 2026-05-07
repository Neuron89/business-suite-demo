'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { fmtMoney, fmtNumber, fmtDate } from '@/lib/format';
import DataTable from '@/components/shared/DataTable';

interface Shipment {
  id: number;
  iqms_shipment_id: number | null;
  pu_number: string | null;
  ship_date: string | null;
  customer_name: string | null;
  ship_to_city: string | null;
  ship_to_state: string | null;
  mode: string | null;
  carrier_name: string | null;
  carrier_name_raw: string | null;
  part_number: string | null;
  qty_shipped: number | null;
  total_lbs: number | null;
  total_cost: number | null;
  status: string | null;
}

export default function ShipmentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [rows, setRows] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [mode, setMode] = useState('');
  const [loading, setLoading] = useState(true);

  // URL-driven filters: dashboard stat cards link with ?date=today or ?days=7
  const urlDate = searchParams.get('date') || '';
  const urlDays = searchParams.get('days') || '';

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (q) params.set('q', q);
    if (state) params.set('state', state);
    if (mode) params.set('mode', mode);
    if (urlDate) params.set('date', urlDate);
    if (urlDays) params.set('days', urlDays);
    const res = await api.get<{ data: Shipment[]; total: number }>(
      `/shipments?${params.toString()}`
    );
    setRows(res.data);
    setTotal(res.total);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, urlDate, urlDays]);

  const pages = Math.max(1, Math.ceil(total / limit));

  const filterLabel = urlDate === 'today'
    ? 'Today only'
    : urlDays
      ? `Last ${urlDays} days`
      : null;

  function clearWindow() {
    router.push('/shipments');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white">Shipments</h2>
        <div className="text-xs text-navy-500 dark:text-navy-300">
          {filterLabel && (
            <span className="inline-flex items-center gap-2 bg-amber-100 dark:bg-navy-700 text-amber-800 dark:text-amber-300 px-2 py-1 rounded mr-2">
              {filterLabel}
              <button onClick={clearWindow} className="opacity-70 hover:opacity-100" aria-label="Clear">
                ×
              </button>
            </span>
          )}
          {fmtNumber(total)} total
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium mb-1">Search</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Customer, PU#, part, carrier"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">State</label>
            <input
              className="input w-32"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="TX or Texas"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Mode</label>
            <select className="input w-32" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">All</option>
              <option value="FTL">FTL</option>
              <option value="LTL">LTL</option>
              <option value="RAIL">RAIL</option>
              <option value="PARCEL">PARCEL</option>
              <option value="BULK">BULK</option>
              <option value="COLLECT">COLLECT</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
          <button
            className="btn btn-primary text-xs"
            onClick={() => {
              setPage(1);
              load();
            }}
          >
            Filter
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-sm">Loading…</div>
        ) : (
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              {
                key: 'ship_date',
                label: 'Date',
                render: (r) => fmtDate(r.ship_date),
              },
              { key: 'pu_number', label: 'PU #' },
              { key: 'customer_name', label: 'Customer' },
              {
                key: 'dest',
                label: 'Dest',
                render: (r) =>
                  [r.ship_to_city, r.ship_to_state].filter(Boolean).join(', ') || '—',
              },
              { key: 'mode', label: 'Mode' },
              {
                key: 'carrier',
                label: 'Carrier',
                render: (r) => r.carrier_name || r.carrier_name_raw || '—',
              },
              { key: 'part_number', label: 'Part' },
              {
                key: 'total_lbs',
                label: 'Lbs',
                align: 'right',
                render: (r) => fmtNumber(r.total_lbs),
              },
              {
                key: 'total_cost',
                label: 'Cost',
                align: 'right',
                render: (r) => fmtMoney(r.total_cost),
              },
            ]}
            empty="No shipments match these filters."
          />
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          className="btn btn-secondary text-xs"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <div>
          Page {page} of {pages}
        </div>
        <button
          className="btn btn-secondary text-xs"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
