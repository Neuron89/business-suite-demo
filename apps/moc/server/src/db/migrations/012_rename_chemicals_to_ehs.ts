import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.renameColumn('affected_chemicals', 'ehs_assessment');
  });
  // Clear existing chemical data since it is semantically different
  await knex('moc_requests').update({ ehs_assessment: '{}' });

  // Update template field_config JSONB keys
  const templates = await knex('moc_templates').select('id', 'field_config');
  for (const tmpl of templates) {
    const fc = typeof tmpl.field_config === 'string' ? JSON.parse(tmpl.field_config) : tmpl.field_config;
    if (fc && 'affected_chemicals' in fc) {
      fc.ehs_assessment = fc.affected_chemicals;
      delete fc.affected_chemicals;
      await knex('moc_templates').where('id', tmpl.id).update({ field_config: JSON.stringify(fc) });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.renameColumn('ehs_assessment', 'affected_chemicals');
  });

  // Revert template field_config JSONB keys
  const templates = await knex('moc_templates').select('id', 'field_config');
  for (const tmpl of templates) {
    const fc = typeof tmpl.field_config === 'string' ? JSON.parse(tmpl.field_config) : tmpl.field_config;
    if (fc && 'ehs_assessment' in fc) {
      fc.affected_chemicals = fc.ehs_assessment;
      delete fc.ehs_assessment;
      await knex('moc_templates').where('id', tmpl.id).update({ field_config: JSON.stringify(fc) });
    }
  }
}
