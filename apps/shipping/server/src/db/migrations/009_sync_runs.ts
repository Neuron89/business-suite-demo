import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sync_runs', (t) => {
    t.increments('id').primary();
    t.string('job').notNullable(); // shipments | inventory | customers | fsc | routing
    t.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('finished_at');
    t.string('status').notNullable().defaultTo('running'); // running | ok | error
    t.integer('rows_in').defaultTo(0);
    t.integer('rows_upserted').defaultTo(0);
    t.text('error_message');
    t.index(['job', 'started_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('sync_runs');
}
