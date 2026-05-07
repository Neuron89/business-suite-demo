import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dsr_checklists', (t) => {
    t.increments('id').primary();
    t.integer('moc_id').unsigned().notNullable()
      .references('id').inTable('moc_requests').onDelete('CASCADE');
    t.integer('created_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('completed_at').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['moc_id']);
  });

  await knex.schema.createTable('dsr_items', (t) => {
    t.increments('id').primary();
    t.integer('checklist_id').unsigned().notNullable()
      .references('id').inTable('dsr_checklists').onDelete('CASCADE');
    t.string('category', 100).notNullable();
    t.text('description').notNullable();
    t.string('status', 20).notNullable().defaultTo('pending');
    t.text('notes').defaultTo('');
    t.integer('verified_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    t.boolean('action_resolved').defaultTo(false);
    t.timestamps(true, true);
  });

  await knex.raw('CREATE INDEX idx_dsr_moc ON dsr_checklists(moc_id)');
  await knex.raw('CREATE INDEX idx_dsr_items_checklist ON dsr_items(checklist_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dsr_items');
  await knex.schema.dropTableIfExists('dsr_checklists');
}
