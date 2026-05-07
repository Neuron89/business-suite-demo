'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtMoney, fmtDate } from '@/lib/format';
import DataTable from '@/components/shared/DataTable';

interface RateEntry {
  id: number;
  carrier_id: number | null;
  carrier_name: string | null;
  mode: string | null;
  origin_code: string | null;
  destination_state: string | null;
  destination_zip: string | null;
  rate: number | null;
  rate_unit: string | null;
  fsc_pct: number | null;
  detention_rate: number | null;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
}

interface Carrier {
  id: number;
  name: string;
  code: string | null;
}

export default function RatesPage() {
  const [rates, setRates] = useState<RateEntry[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [carrierFilter, setCarrierFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (carrierFilter) params.set('carrier_id', carrierFilter);
    if (stateFilter) params.set('state', stateFilter);
    if (activeOnly) params.set('active_only', '1');
    const [r, c] = await Promise.all([
      api.get<{ data: RateEntry[] }>(`/rate-book?${params.toString()}`),
      api.get<{ data: Carrier[] }>('/carriers'),
    ]);
    setRates(r.data);
    setCarriers(c.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-navy-800 dark:text-white">Rate book</h2>
        <p className="text-xs text-navy-500 dark:text-navy-300">
          Casey / Tech / TTS / Gateway per-customer lane rates from the Excel carrier-rate tab.
        </p>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium mb-1">Carrier</label>
            <select
              className="input"
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
            >
              <option value="">All</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">State</label>
            <input
              className="input w-32"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              placeholder="TX or Texas"
            />
          </div>
          <label className="flex items-center gap-2 text-xs mt-5">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Active only
          </label>
          <button className="btn btn-primary text-xs" onClick={load}>
            Filter
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-sm">Loading…</div>
        ) : (
          <DataTable
            rows={rates}
            rowKey={(r) => r.id}
            columns={[
              { key: 'carrier_name', label: 'Carrier' },
              { key: 'mode', label: 'Mode' },
              {
                key: 'destination_state',
                label: 'Destination',
                render: (r) =>
                  [r.destination_state, r.destination_zip].filter(Boolean).join(' · ') || '—',
              },
              {
                key: 'rate',
                label: 'Rate',
                align: 'right',
                render: (r) => fmtMoney(r.rate),
              },
              { key: 'rate_unit', label: 'Unit' },
              {
                key: 'fsc_pct',
                label: 'FSC %',
                align: 'right',
                render: (r) =>
                  r.fsc_pct == null ? '—' : `${(Number(r.fsc_pct) * 100).toFixed(1)}%`,
              },
              {
                key: 'effective',
                label: 'Effective',
                render: (r) =>
                  `${fmtDate(r.effective_from)} – ${r.effective_to ? fmtDate(r.effective_to) : 'open'}`,
              },
              { key: 'notes', label: 'Customer / Lane' },
            ]}
            empty="No rate entries yet — run `npm run import:excel` to load from the carrier-rate tab."
          />
        )}
      </div>
    </div>
  );
}
