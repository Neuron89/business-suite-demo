import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('pssr_signoffs', (table) => {
    table.increments('id').primary();
    table.integer('checklist_id').notNullable().references('id').inTable('pssr_checklists').onDelete('CASCADE');
    table.integer('user_id').notNullable().references('id').inTable('users');
    table.string('role', 50).notNullable();
    table.timestamp('signed_at').defaultTo(knex.fn.now());
    table.unique(['checklist_id', 'role']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pssr_signoffs');
}
