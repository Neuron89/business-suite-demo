import type { Knex } from 'knex';

/**
 * IT command-center dashboard: personal todo list table.
 *
 * The dashboard itself is mostly a read-aggregator (tickets, mail, uptime,
 * etc. all live elsewhere), but the personal todo widget needs its own
 * storage. Keep it scoped per email so the same admin can have their own
 * checklist whether they sign in from any browser.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('todos', (t) => {
    t.increments('id').primary();
    t.string('owner_email', 255).notNullable();
    t.string('text', 500).notNullable();
    t.boolean('done').notNullable().defaultTo(false);
    /** "low" | "med" | "high" — drives the colored bar on the widget. */
    t.string('priority', 16).notNullable().defaultTo('med');
    t.timestamp('due_date');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamps(true, true);
  });
  await knex.schema.raw(
    'CREATE INDEX idx_todos_owner_open ON todos(owner_email, done, sort_order)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('todos');
}
