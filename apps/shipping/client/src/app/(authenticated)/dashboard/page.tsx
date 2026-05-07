'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtMoney, fmtNumber, fmtDateTime, fmtDate } from '@/lib/format';
import StatCard from '@/components/shared/StatCard';
import DataTable from '@/components/shared/DataTable';
import {
  DailyCostChart,
  MonthlyCostChart,
  TopStatesBar,
  ModePie,
  FuelTrendChart,
} from '@/components/charts';

interface Overview {
  today_count: number;
  last_7_days: {
    shipments: number;
    total_cost: number;
    total_lbs: number;
    cpl_cost: number;
    cpl_lbs: number;
  };
  by_carrier: { carrier: string; shipments: number; total_cost: number; total_lbs: number }[];
  by_state: { state: string; shipments: number; total_cost: number }[];
  by_mode: { mode: string; shipments: number; total_cost: number }[];
  daily: { date: string; shipments: number; total_cost: number; total_lbs: number }[];
  monthly: { month: string; shipments: number; total_cost: number; total_lbs: number }[];
  last_syncs: {
    id: number;
    source: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    rows_upserted: number | null;
    message: string | null;
  }[];
  fsc_recent: {
    id: number;
    week_start: string;
    diesel_price: number | null;
    surcharge_pct: number | null;
  }[];
  inventory_latest: { warehouse: string; snapshot_date: string }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const fresh = await api.get<Overview>('/dashboard/overview');
      setData(fresh);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function runSync() {
    try {
      await api.post('/sync/run/all', {});
      await refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) return <div className="text-sm">Loading dashboard…</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (!data) return null;

  const l7 = data.last_7_days;
  const cpl = l7.cpl_lbs > 0 ? l7.cpl_cost / l7.cpl_lbs : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white">
            Morning dashboard
          </h2>
          <p className="text-[11px] sm:text-xs text-navy-500 dark:text-navy-300">
            Acme Industries · auto-synced nightly from IQMS
          </p>
        </div>
        <button className="btn btn-secondary text-xs" onClick={runSync}>
          Sync IQMS now
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Shipments today"
          value={data.today_count}
          tone="amber"
          href="/shipments?date=today"
        />
        <StatCard
          label="Last 7 days"
          value={fmtNumber(l7.shipments)}
          sub="shipments"
          href="/shipments?days=7"
        />
        <StatCard
          label="7-day freight"
          value={fmtMoney(l7.total_cost)}
          sub={`${fmtNumber(l7.total_lbs)} lbs`}
          href="/shipments?days=7"
        />
        <StatCard
          label="7-day $/lb"
          value={cpl == null ? '—' : `$${cpl.toFixed(3)}`}
          sub={cpl == null ? 'needs costed rows' : `${fmtMoney(l7.cpl_cost)} / ${fmtNumber(l7.cpl_lbs)} lbs`}
          href="/shipments?days=7"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-navy-800 dark:text-white text-sm sm:text-base">
              Daily freight cost · last 30 days
            </h3>
            <span className="text-xs text-navy-500 dark:text-navy-300">
              {fmtMoney(data.daily.reduce((s, d) => s + (d.total_cost || 0), 0))} total
            </span>
          </div>
          <DailyCostChart data={data.daily} />
        </div>
        <div className="card">
          <h3 className="font-semibold text-navy-800 dark:text-white text-sm sm:text-base mb-2">
            Mode mix · 30 days
          </h3>
          {data.by_mode.length ? (
            <ModePie data={data.by_mode} />
          ) : (
            <div className="text-sm text-navy-500 dark:text-navy-300 py-8 text-center">
              No mode data in the window.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card">
          <h3 className="font-semibold text-navy-800 dark:text-white text-sm sm:text-base mb-2">
            Monthly freight trend
          </h3>
          {data.monthly.length ? (
            <MonthlyCostChart data={data.monthly} />
          ) : (
            <div className="text-sm text-navy-500 dark:text-navy-300 py-8 text-center">
              Not enough history yet.
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="font-semibold text-navy-800 dark:text-white text-sm sm:text-base mb-2">
            Top destination states · 30 days
          </h3>
          {data.by_state.length ? (
            <TopStatesBar data={data.by_state.slice(0, 10)} />
          ) : (
            <div className="text-sm text-navy-500 dark:text-navy-300 py-8 text-center">
              No shipment destinations yet.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-navy-800 dark:text-white text-sm sm:text-base mb-2">
          Diesel &amp; fuel surcharge trend
        </h3>
        {data.fsc_recent.length ? (
          <FuelTrendChart data={data.fsc_recent} />
        ) : (
          <div className="text-sm text-navy-500 dark:text-navy-300 py-8 text-center">
            No FSC data yet — register an EIA key or run the Excel import.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card">
          <h3 className="font-semibold text-navy-800 dark:text-white text-sm sm:text-base mb-2">
            Top carriers · 30 days
          </h3>
          <DataTable
            rows={data.by_carrier}
            columns={[
              { key: 'carrier', label: 'Carrier' },
              { key: 'shipments', label: 'Ship.', align: 'right' },
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
          />
        </div>

        <div className="card">
          <h3 className="font-semibold text-navy-800 dark:text-white text-sm sm:text-base mb-2">
            By destination state · 30 days
          </h3>
          <DataTable
            rows={data.by_state}
            columns={[
              { key: 'state', label: 'State' },
              { key: 'shipments', label: 'Ship.', align: 'right' },
              {
                key: 'total_cost',
                label: 'Cost',
                align: 'right',
                render: (r) => fmtMoney(r.total_cost),
              },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-navy-800 dark:text-white text-sm sm:text-base mb-2">
            Recent syncs
          </h3>
          <DataTable
            rows={data.last_syncs}
            columns={[
              { key: 'source', label: 'Source' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => (
                  <span
                    className={
                      r.status === 'ok'
                        ? 'text-green-600'
                        : r.status === 'error'
                          ? 'text-red-600'
                          : 'text-amber-600'
                    }
                  >
                    {r.status}
                  </span>
                ),
              },
              {
                key: 'started_at',
                label: 'Started',
                render: (r) => fmtDateTime(r.started_at),
              },
              {
                key: 'rows_upserted',
                label: 'Rows',
                align: 'right',
                render: (r) => fmtNumber(r.rows_upserted),
              },
              { key: 'message', label: 'Message' },
            ]}
            empty="No syncs have run yet."
          />
        </div>

        <div className="card">
          <h3 className="font-semibold text-navy-800 dark:text-white text-sm sm:text-base mb-2">
            Inventory snapshots
          </h3>
          <DataTable
            rows={data.inventory_latest}
            columns={[
              { key: 'warehouse', label: 'Warehouse' },
              {
                key: 'snapshot_date',
                label: 'Latest',
                render: (r) => fmtDate(r.snapshot_date),
              },
            ]}
            empty="No inventory snapshots yet."
          />
        </div>
      </div>
    </div>
  );
}
