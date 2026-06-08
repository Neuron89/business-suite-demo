import type { Knex } from 'knex';

/**
 * Add the v2 status values (hr_fill, it_close) to the tickets.status CHECK
 * constraint. Without this the new state machine can't actually store its
 * transitional states and ticket creation fails at the DB level.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check`);
  await knex.schema.raw(`
    ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
    CHECK (status IN (
      'draft', 'submitted',
      'manager_review', 'it_review',
      'hr_fill', 'it_close',
      'approved', 'denied',
      'in_progress', 'waiting',
      'completed', 'cancelled'
    ))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check`);
  await knex.schema.raw(`
    ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
    CHECK (status IN (
      'draft', 'submitted', 'manager_review', 'it_review',
      'approved', 'denied', 'in_progress', 'waiting', 'completed', 'cancelled'
    ))
  `);
}
