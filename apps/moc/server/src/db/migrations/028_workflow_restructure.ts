import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // PostgreSQL doesn't use CHECK constraints for status in this schema —
  // the status column is a varchar, so we just need to make sure new values work.
  // Add a comment to document the new statuses.
  await knex.raw(`
    COMMENT ON COLUMN moc_requests.status IS
      'Valid: draft, submitted, risk_assessment, under_review, approved, rejected, returned, implementing, dsr, pssr_pending, pssr_complete, orc, ready_for_startup, awaiting_action_items, improvements_realized, closed'
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`COMMENT ON COLUMN moc_requests.status IS NULL`);
}
