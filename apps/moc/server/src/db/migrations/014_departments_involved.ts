import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.specificType('departments_involved', 'text[]').notNullable().defaultTo('{}');
  });

  // Update existing templates to include departments_involved in field_config
  const templates = await knex('moc_templates').select('id', 'field_config');
  for (const tmpl of templates) {
    const fc = typeof tmpl.field_config === 'string'
      ? JSON.parse(tmpl.field_config)
      : tmpl.field_config;
    fc.departments_involved = { visible: true, required: false };
    await knex('moc_templates')
      .where('id', tmpl.id)
      .update({ field_config: JSON.stringify(fc) });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.dropColumn('departments_involved');
  });
}
