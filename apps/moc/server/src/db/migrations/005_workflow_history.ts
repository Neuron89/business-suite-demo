import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('workflow_history', (t) => {
    t.increments('id').primary();
    t.integer('moc_id').unsigned().notNullable()
      .references('id').inTable('moc_requests').onDelete('CASCADE');
    t.string('from_status', 30).nullable();
    t.string('to_status', 30).notNullable();
    t.integer('changed_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.text('comment').defaultTo('');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_workflow_moc ON workflow_history(moc_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('workflow_history');
}
