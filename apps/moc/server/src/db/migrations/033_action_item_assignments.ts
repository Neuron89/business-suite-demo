import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dsr_items', (table) => {
    table.integer('assigned_to').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
  });
  await knex.schema.alterTable('pssr_items', (table) => {
    table.integer('assigned_to').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dsr_items', (table) => {
    table.dropColumn('assigned_to');
  });
  await knex.schema.alterTable('pssr_items', (table) => {
    table.dropColumn('assigned_to');
  });
}
