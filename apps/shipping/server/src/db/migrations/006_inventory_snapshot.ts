import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('inventory_snapshot', (t) => {
    t.increments('id').primary();
    t.date('snapshot_date').notNullable();
    t.string('warehouse').notNullable(); // acme_main | lowell
    t.bigInteger('iqms_location_id');
    t.string('part_number').notNullable();
    t.string('part_description');
    t.decimal('qty_on_hand', 16, 3).notNullable().defaultTo(0);
    t.string('uom');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.unique(['snapshot_date', 'warehouse', 'part_number']);
    t.index(['snapshot_date']);
    t.index(['warehouse']);
    t.index(['part_number']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('inventory_snapshot');
}
