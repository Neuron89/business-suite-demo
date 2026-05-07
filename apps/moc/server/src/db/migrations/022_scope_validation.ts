import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (table) => {
    table.jsonb('scope_baseline').nullable();
    table.jsonb('scope_post_change').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (table) => {
    table.dropColumn('scope_baseline');
    table.dropColumn('scope_post_change');
  });
}
