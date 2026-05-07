import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dsr_signoffs', (t) => {
    t.increments('id').primary();
    t.integer('checklist_id').unsigned().notNullable().references('id').inTable('dsr_checklists').onDelete('CASCADE');
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users');
    t.string('role', 50).notNullable();
    t.timestamp('signed_at').defaultTo(knex.fn.now());
    t.unique(['checklist_id', 'role']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dsr_signoffs');
}
