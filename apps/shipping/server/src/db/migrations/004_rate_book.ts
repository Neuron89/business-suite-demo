import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('rate_book', (t) => {
    t.increments('id').primary();
    t.integer('carrier_id').notNullable().references('id').inTable('carriers').onDelete('CASCADE');
    t.string('origin_code');
    t.string('destination_state');
    t.string('destination_zip');
    t.string('mode').notNullable();
    t.decimal('rate', 14, 2).notNullable();
    t.string('rate_unit').notNullable().defaultTo('flat'); // flat | per_mile | per_lb | per_cwt
    t.decimal('fsc_pct', 8, 4);
    t.decimal('detention_rate', 14, 2);
    t.date('effective_from').notNullable();
    t.date('effective_to');
    t.text('notes');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index(['carrier_id']);
    t.index(['destination_state']);
    t.index(['effective_from']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('rate_book');
}
