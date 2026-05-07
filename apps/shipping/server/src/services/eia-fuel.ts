import db from '../db/connection';

// EIA weekly U.S. diesel retail price — series EMD_EPD2D_PTE_NUS_DPG.
// The v2 API requires a free API key. Register at:
//   https://www.eia.gov/opendata/register.php  (instant, 30 seconds)
// and drop it into server/.env as EIA_API_KEY=...
// Without a key the sync short-circuits with a clear message so the cron
// keeps running and the error surfaces in Settings → Sync history.

const EIA_SERIES = 'EMD_EPD2D_PTE_NUS_DPG';

interface EiaResult {
  rows_in: number;
  rows_upserted: number;
  skipped?: string;
}

async function runEia(): Promise<EiaResult> {
  const key = process.env.EIA_API_KEY;
  if (!key) {
    return {
      rows_in: 0,
      rows_upserted: 0,
      skipped: 'EIA_API_KEY not set — register at eia.gov/opendata/register.php',
    };
  }

  const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${encodeURIComponent(
    key
  )}&frequency=weekly&data[0]=value&facets[series][]=${EIA_SERIES}&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=52`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`EIA fetch failed: ${res.status} ${res.statusText}`);
  const body: any = await res.json();
  const rows: Array<{ period: string; value: number }> = body?.response?.data || [];

  let upserted = 0;
  for (const r of rows) {
    if (!r.period || r.value == null) continue;
    await db('fsc_weekly')
      .insert({ week_start: r.period, diesel_price: r.value, source: 'eia' })
      .onConflict('week_start')
      .merge(['diesel_price', 'source']);
    upserted++;
  }

  return { rows_in: rows.length, rows_upserted: upserted };
}

export async function syncEiaDiesel(): Promise<EiaResult> {
  const [run] = await db('sync_runs').insert({ job: 'eia' }).returning('id');
  const runId = run.id || run;
  try {
    const result = await runEia();
    await db('sync_runs')
      .where({ id: runId })
      .update({
        status: result.skipped ? 'skipped' : 'ok',
        finished_at: db.fn.now(),
        rows_in: result.rows_in,
        rows_upserted: result.rows_upserted,
        error_message: result.skipped || null,
      });
    return result;
  } catch (err: any) {
    await db('sync_runs')
      .where({ id: runId })
      .update({
        status: 'error',
        finished_at: db.fn.now(),
        error_message: String(err?.message || err),
      });
    throw err;
  }
}
