import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('pssr_checklists', (t) => {
    t.increments('id').primary();
    t.integer('moc_id').unsigned().notNullable()
      .references('id').inTable('moc_requests').onDelete('CASCADE');
    t.integer('created_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('completed_at').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('pssr_items', (t) => {
    t.increments('id').primary();
    t.integer('checklist_id').unsigned().notNullable()
      .references('id').inTable('pssr_checklists').onDelete('CASCADE');
    t.enum('category', [
      'process_equipment', 'piping_and_valves', 'instrumentation_and_controls',
      'electrical_systems', 'safety_systems', 'emergency_equipment',
      'procedures_and_documentation', 'training', 'environmental_controls',
      'chemical_handling',
    ]).notNullable();
    t.text('description').notNullable();
    t.enum('status', ['pass', 'fail', 'na', 'pending']).notNullable().defaultTo('pending');
    t.text('notes').defaultTo('');
    t.integer('verified_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });

  await knex.raw('CREATE INDEX idx_pssr_moc ON pssr_checklists(moc_id)');
  await knex.raw('CREATE INDEX idx_pssr_items_checklist ON pssr_items(checklist_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pssr_items');
  await knex.schema.dropTableIfExists('pssr_checklists');
}
