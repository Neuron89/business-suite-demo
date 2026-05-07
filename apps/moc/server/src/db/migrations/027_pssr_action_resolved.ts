import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pssr_items', (table) => {
    table.boolean('action_resolved').defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pssr_items', (table) => {
    table.dropColumn('action_resolved');
  });
}
