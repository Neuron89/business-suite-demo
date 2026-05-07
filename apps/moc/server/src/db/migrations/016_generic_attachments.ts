import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (t) => {
    // Add generic entity columns
    t.string('entity_type', 50).notNullable().defaultTo('moc');
    t.integer('entity_id').unsigned().nullable();

    // Make moc_id nullable (existing rows keep their value)
    t.integer('moc_id').unsigned().nullable().alter();
  });

  // Backfill entity_id from moc_id for all existing rows
  await knex.raw(`UPDATE attachments SET entity_id = moc_id WHERE moc_id IS NOT NULL`);

  // Add index for generic lookups
  await knex.raw('CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_attachments_entity');

  await knex.schema.alterTable('attachments', (t) => {
    t.dropColumn('entity_type');
    t.dropColumn('entity_id');
  });

  // Restore moc_id as NOT NULL (only safe if no ehs rows exist)
  await knex.schema.alterTable('attachments', (t) => {
    t.integer('moc_id').unsigned().notNullable().alter();
  });
}
