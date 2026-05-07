'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtMoney, fmtDate } from '@/lib/format';
import DataTable from '@/components/shared/DataTable';

interface FscRow {
  id: number;
  week_start: string;
  diesel_price: number | null;
  surcharge_pct: number | null;
  source: string;
}

export default function FscPage() {
  const [rows, setRows] = useState<FscRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const r = await api.get<{ data: FscRow[] }>('/fsc');
    setRows(r.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function syncEia() {
    setSyncing(true);
    setError('');
    try {
      await api.post('/fsc/sync/eia', {});
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-800 dark:text-white">Fuel surcharge</h2>
          <p className="text-xs text-navy-500 dark:text-navy-300">
            Weekly U.S. diesel retail price (EIA series EMD_EPD2D_PTE_NUS_DPG) + surcharge %.
          </p>
        </div>
        <button className="btn btn-primary text-xs" onClick={syncEia} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Pull from EIA'}
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="card">
        {loading ? (
          <div className="text-sm">Loading…</div>
        ) : (
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              {
                key: 'week_start',
                label: 'Week',
                render: (r) => fmtDate(r.week_start),
              },
              {
                key: 'diesel_price',
                label: '$/gal',
                align: 'right',
                render: (r) => fmtMoney(r.diesel_price),
              },
              {
                key: 'surcharge_pct',
                label: 'FSC %',
                align: 'right',
                render: (r) =>
                  r.surcharge_pct == null ? '—' : `${Number(r.surcharge_pct).toFixed(2)}%`,
              },
              { key: 'source', label: 'Source' },
            ]}
            empty="No FSC data yet — click Pull from EIA to fetch."
          />
        )}
      </div>
    </div>
  );
}
