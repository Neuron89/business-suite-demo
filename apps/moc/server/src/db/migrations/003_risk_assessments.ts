import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('risk_assessments', (t) => {
    t.increments('id').primary();
    t.integer('moc_id').unsigned().notNullable()
      .references('id').inTable('moc_requests').onDelete('CASCADE');
    t.text('hazard_description').notNullable();
    t.text('consequences').notNullable();
    t.text('existing_controls').defaultTo('');
    t.integer('severity_before').notNullable();
    t.integer('likelihood_before').notNullable();
    t.string('risk_level_before', 20).notNullable();
    t.text('proposed_controls').notNullable();
    t.integer('severity_after').notNullable();
    t.integer('likelihood_after').notNullable();
    t.string('risk_level_after', 20).notNullable();
    t.integer('assessed_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.timestamps(true, true);
  });

  await knex.raw('CREATE INDEX idx_risk_moc ON risk_assessments(moc_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('risk_assessments');
}
