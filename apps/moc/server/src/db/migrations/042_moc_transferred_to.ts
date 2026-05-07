import type { Knex } from 'knex';

/**
 * Ownership transfer: keep created_by intact and track the current owner
 * separately via transferred_to. created_by remains the historical author;
 * transferred_to (when set) is the active owner for permission checks and
 * notifications.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.integer('transferred_to').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('transferred_at');
    t.integer('transferred_by').references('id').inTable('users').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.dropColumn('transferred_to');
    t.dropColumn('transferred_at');
    t.dropColumn('transferred_by');
  });
}
