import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.string('risk_level', 20).nullable().defaultTo(null);
  });
  await knex.raw('CREATE INDEX idx_moc_risk_level ON moc_requests(risk_level)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.dropColumn('risk_level');
  });
}
