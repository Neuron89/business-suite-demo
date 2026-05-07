import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shipments', (t) => {
    t.increments('id').primary();

    // Source of record
    t.string('source').notNullable().defaultTo('iqms'); // iqms | manual
    t.bigInteger('iqms_shipment_id').unique();
    t.bigInteger('iqms_bol_id');
    t.string('iqms_so_number');

    // Business data
    t.string('pu_number');
    t.date('ship_date');
    t.string('customer_name');
    t.string('customer_code');
    t.string('ship_to_state');
    t.string('ship_to_city');
    t.string('ship_to_zip');
    t.string('destination_country');

    // Cargo
    t.string('part_number');
    t.string('part_description');
    t.decimal('total_lbs', 14, 2);
    t.integer('count');

    // Mode / carrier
    t.string('mode');
    t.string('category').notNullable().defaultTo('customer');
    t.integer('carrier_id').references('id').inTable('carriers').onDelete('SET NULL');
    t.string('carrier_name_raw'); // free-text from IQMS until matched to carriers.id

    // Costing
    t.decimal('rate', 14, 2);
    t.decimal('fsc_pct', 8, 4);
    t.decimal('fsc_amount', 14, 2);
    t.decimal('detention', 14, 2);
    t.decimal('dwell', 14, 2);
    t.decimal('tolls', 14, 2);
    t.decimal('other_charges', 14, 2);
    t.decimal('total_cost', 14, 2);
    t.decimal('cost_per_lb', 14, 6);

    // Status
    t.string('status').notNullable().defaultTo('pending');

    // Audit
    t.text('notes');
    t.integer('confirmed_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('confirmed_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index(['ship_date']);
    t.index(['customer_name']);
    t.index(['ship_to_state']);
    t.index(['mode']);
    t.index(['category']);
    t.index(['status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('shipments');
}
