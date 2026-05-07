import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('carriers', (t) => {
    t.increments('id').primary();
    t.string('code').notNullable().unique();
    t.string('name').notNullable();
    t.string('mode').notNullable();
    t.string('contact_name');
    t.string('contact_email');
    t.string('contact_phone');
    t.boolean('active').notNullable().defaultTo(true);
    t.text('notes');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('carriers');
}
