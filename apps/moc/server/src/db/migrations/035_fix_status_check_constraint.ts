import type { Knex } from 'knex';

/**
 * The moc_requests_status_check constraint is missing statuses added after the
 * original table creation: dsr, orc, ready_for_startup, awaiting_action_items.
 * Update it to match the full MOC_STATUSES list from constants.ts.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE moc_requests DROP CONSTRAINT IF EXISTS moc_requests_status_check;
    ALTER TABLE moc_requests ADD CONSTRAINT moc_requests_status_check CHECK (
      status = ANY (ARRAY[
        'draft', 'submitted', 'risk_assessment', 'under_review',
        'approved', 'rejected', 'returned', 'implementing',
        'dsr', 'pssr_pending', 'pssr_complete', 'orc',
        'ready_for_startup', 'awaiting_action_items',
        'improvements_realized', 'closed'
      ]::text[])
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE moc_requests DROP CONSTRAINT IF EXISTS moc_requests_status_check;
    ALTER TABLE moc_requests ADD CONSTRAINT moc_requests_status_check CHECK (
      status = ANY (ARRAY[
        'draft', 'submitted', 'risk_assessment', 'under_review',
        'approved', 'rejected', 'returned', 'implementing',
        'pssr_pending', 'pssr_complete', 'improvements_realized', 'closed'
      ]::text[])
    );
  `);
}
