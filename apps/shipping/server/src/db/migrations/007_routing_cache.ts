import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('routing_cache', (t) => {
    t.increments('id').primary();
    t.string('from_zip').notNullable();
    t.string('to_zip').notNullable();
    t.decimal('miles', 10, 2);
    t.decimal('drive_minutes', 10, 2);
    t.timestamp('fetched_at').notNullable().defaultTo(knex.fn.now());

    t.unique(['from_zip', 'to_zip']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('routing_cache');
}
