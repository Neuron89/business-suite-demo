import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.string('compliance_flag', 20).nullable();
    t.jsonb('additional_reviewers').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.dropColumn('compliance_flag');
    t.dropColumn('additional_reviewers');
  });
}
