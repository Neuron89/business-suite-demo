import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ehs_incidents', (t) => {
    t.increments('id').primary();
    t.string('title', 200).notNullable();
    t.text('description').notNullable();
    t.string('incident_type', 50).notNullable();
    t.string('severity', 20).notNullable();
    t.string('status', 30).notNullable().defaultTo('open');
    t.timestamp('incident_date').notNullable();
    t.string('location', 200).notNullable();
    t.text('affected_persons').defaultTo('');
    t.text('root_cause').defaultTo('');
    t.text('corrective_actions').defaultTo('');
    t.integer('moc_id').unsigned().nullable()
      .references('id').inTable('moc_requests').onDelete('SET NULL');
    t.integer('reported_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    t.integer('assigned_to').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);

    t.index('status');
    t.index('incident_type');
    t.index('severity');
    t.index('reported_by');
    t.index('incident_date');
    t.index('moc_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ehs_incidents');
}
