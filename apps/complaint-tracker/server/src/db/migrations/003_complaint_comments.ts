import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('complaint_comments', (table) => {
    table.increments('id').primary();
    table.integer('complaint_id').unsigned().notNullable().references('id').inTable('complaints').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users');
    table.text('comment').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('complaint_comments');
}
