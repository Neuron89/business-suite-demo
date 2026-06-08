import type { Knex } from 'knex';

/**
 * v2 flow gains a "Manager — Start Date" gate between hr_searching and
 * it_close: HR submits the hire's identity, then the hiring manager sets the
 * confirmed start date before the ticket goes to IT for final approval.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check`);
  await knex.schema.raw(`
    ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
    CHECK (status IN (
      'draft', 'submitted',
      'manager_review', 'it_review',
      'hr_fill', 'hr_searching', 'manager_start_date', 'it_close',
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
      'hr_fill', 'hr_searching', 'it_close',
      'approved', 'denied',
      'in_progress', 'waiting',
      'completed', 'cancelled'
    ))
  `);
}
