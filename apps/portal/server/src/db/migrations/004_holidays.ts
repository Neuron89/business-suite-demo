import type { Knex } from 'knex';

/**
 * Company holiday calendar. Powers the home-page banner ticker.
 *
 * `kind`:
 *   - "federal" — US federal holidays (seeded; admins should not edit).
 *   - "company" — Acme Industries-specific (plant shutdowns, summer hours, etc.).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('holidays', (t) => {
    t.increments('id').primary();
    t.string('name', 200).notNullable();
    t.date('date').notNullable();
    t.string('kind', 32).notNullable().defaultTo('company');
    t.string('created_by', 255);
    t.timestamps(true, true);
    t.unique(['date', 'name']);
  });
  await knex.schema.raw('CREATE INDEX idx_holidays_date ON holidays(date)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('holidays');
}
