import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.date('proposed_start_date').nullable().alter();
    t.date('proposed_end_date').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.date('proposed_start_date').notNullable().alter();
    t.date('proposed_end_date').notNullable().alter();
  });
}
