import type { Knex } from 'knex';

/**
 * v2 HR flow gains a visible "HR — Searching" state between hr_fill and
 * it_close, plus an hr_ack_at timestamp recording when HR confirmed receipt.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tickets', (t) => {
    t.timestamp('hr_ack_at', { useTz: true });
  });
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check`);
  await knex.schema.raw(`
    ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
    CHECK (status IN (
      'draft', 'submitted',
      'manager_review', 'it_review',
      'hr_fill', 'hr_searching', 'it_close',
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
      'draft', 'submitted',
      'manager_review', 'it_review',
      'hr_fill', 'it_close',
      'approved', 'denied',
      'in_progress', 'waiting',
      'completed', 'cancelled'
    ))
  `);
  await knex.schema.alterTable('tickets', (t) => {
    t.dropColumn('hr_ack_at');
  });
}
