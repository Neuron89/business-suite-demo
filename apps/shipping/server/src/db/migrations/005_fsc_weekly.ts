import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('fsc_weekly', (t) => {
    t.increments('id').primary();
    t.date('week_start').notNullable().unique();
    t.decimal('diesel_price', 8, 4);
    t.decimal('surcharge_pct', 8, 4);
    t.string('source').notNullable().defaultTo('manual'); // manual | eia
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('fsc_weekly');
}
