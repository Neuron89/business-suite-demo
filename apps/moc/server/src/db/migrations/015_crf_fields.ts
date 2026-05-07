import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (table) => {
    table.string('form_version', 20).notNullable().defaultTo('legacy');
    table.string('crf_change_type', 50).nullable();
    table.string('change_duration', 20).nullable();
    table.date('temporary_end_date').nullable();
    table.jsonb('impact_assessment').nullable();
    table.jsonb('crf_risk_answers').nullable();
    table.string('crf_risk_level', 5).nullable();
    table.jsonb('implementation_tasks').nullable();
    table.jsonb('post_impl_verifications').nullable();
    table.jsonb('attachment_checklist').nullable();

    table.index('form_version', 'idx_moc_form_version');
    table.index('crf_risk_level', 'idx_moc_crf_risk_level');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (table) => {
    table.dropIndex('form_version', 'idx_moc_form_version');
    table.dropIndex('crf_risk_level', 'idx_moc_crf_risk_level');
    table.dropColumn('form_version');
    table.dropColumn('crf_change_type');
    table.dropColumn('change_duration');
    table.dropColumn('temporary_end_date');
    table.dropColumn('impact_assessment');
    table.dropColumn('crf_risk_answers');
    table.dropColumn('crf_risk_level');
    table.dropColumn('implementation_tasks');
    table.dropColumn('post_impl_verifications');
    table.dropColumn('attachment_checklist');
  });
}
