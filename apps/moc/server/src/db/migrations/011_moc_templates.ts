import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Update users role check constraint to include 'moc_manager'
  await knex.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'ehs', 'operations', 'qc', 'moc_manager'))`);

  // Create moc_templates table
  await knex.schema.createTable('moc_templates', (t) => {
    t.increments('id').primary();
    t.string('name', 200).notNullable().unique();
    t.text('description').notNullable().defaultTo('');
    t.boolean('is_default').notNullable().defaultTo(false);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.jsonb('field_config').notNullable();
    t.jsonb('custom_fields').notNullable().defaultTo('[]');
    t.jsonb('workflow_config').notNullable();
    t.integer('created_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.timestamps(true, true);
  });

  // Add template_id and custom_field_values to moc_requests
  await knex.schema.alterTable('moc_requests', (t) => {
    t.integer('template_id').unsigned().nullable()
      .references('id').inTable('moc_templates').onDelete('SET NULL');
    t.jsonb('custom_field_values').notNullable().defaultTo('{}');
  });

  // Make fields optional that templates might hide
  // justification, proposed_start_date, proposed_end_date can now be null
  await knex.raw(`ALTER TABLE moc_requests ALTER COLUMN justification DROP NOT NULL`);
  await knex.raw(`ALTER TABLE moc_requests ALTER COLUMN justification SET DEFAULT ''`);
  await knex.raw(`ALTER TABLE moc_requests ALTER COLUMN proposed_start_date DROP NOT NULL`);
  await knex.raw(`ALTER TABLE moc_requests ALTER COLUMN proposed_end_date DROP NOT NULL`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.dropColumn('template_id');
    t.dropColumn('custom_field_values');
  });

  await knex.schema.dropTableIfExists('moc_templates');

  // Note: Cannot remove enum value in PostgreSQL without recreating the type
}
