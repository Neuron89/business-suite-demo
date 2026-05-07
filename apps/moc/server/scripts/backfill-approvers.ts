/**
 * Backfill moc_approvers rows for every MOC in a non-terminal state so the
 * new named-user approval flow works for them. Idempotent — populateApprovers
 * uses ON CONFLICT DO NOTHING.
 *
 * Usage: npx tsx server/scripts/backfill-approvers.ts
 */
import db from '../src/db/connection';
import { populateApprovers } from '../src/services/approvers';

async function run() {
  const mocs = await db('moc_requests')
    .whereIn('status', ['under_review', 'submitted', 'risk_assessment', 'pssr_pending', 'dsr', 'ready_for_startup'])
    .select('id', 'moc_number', 'status');

  console.log(`Found ${mocs.length} MOCs to backfill`);
  let ok = 0, fail = 0;
  for (const m of mocs) {
    try {
      await populateApprovers(m.id);
      const count = await db('moc_approvers').where('moc_id', m.id).count('id as n').first();
      console.log(`  ok  #${m.id} ${m.moc_number || ''} (${m.status}) → ${count?.n} approvers`);
      ok++;
    } catch (e) {
      console.error(`  fail #${m.id}:`, e);
      fail++;
    }
  }
  console.log(`\nbackfilled ${ok} / ${mocs.length} (${fail} failures)`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
