import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (table) => {
    table.jsonb('scope_realized').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (table) => {
    table.dropColumn('scope_realized');
  });
}
