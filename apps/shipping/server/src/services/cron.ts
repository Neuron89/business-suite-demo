import cron from 'node-cron';
import { runAllSyncs } from './iqms-sync';
import { syncEiaDiesel } from './eia-fuel';

// Nightly schedule — 05:00 local time. He arrives to a pre-populated dashboard.
// EIA runs weekly Monday 06:00 (EIA publishes Monday afternoon for the week;
// we catch it early on the new week).

export function registerCrons(): void {
  cron.schedule('0 5 * * *', async () => {
    console.log('[cron] Running nightly IQMS sync');
    try {
      const result = await runAllSyncs();
      console.log('[cron] IQMS sync done:', result);
    } catch (err) {
      console.error('[cron] IQMS sync failed:', err);
    }
  });

  cron.schedule('0 6 * * 1', async () => {
    console.log('[cron] Running weekly EIA diesel sync');
    try {
      const result = await syncEiaDiesel();
      console.log('[cron] EIA sync done:', result);
    } catch (err) {
      console.error('[cron] EIA sync failed:', err);
    }
  });

  console.log('[cron] Scheduled: IQMS @ 05:00 daily, EIA @ 06:00 Mondays');
}
