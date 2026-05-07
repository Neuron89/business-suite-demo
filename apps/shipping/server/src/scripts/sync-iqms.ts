// Standalone runner used by systemd + `npm run sync:iqms`.
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { runAllSyncs } from '../services/iqms-sync';
import { closeIqmsPool } from '../db/iqms';
import db from '../db/connection';

(async () => {
  try {
    const result = await runAllSyncs();
    console.log('Sync complete:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  } finally {
    await closeIqmsPool().catch(() => {});
    await db.destroy().catch(() => {});
  }
})();
