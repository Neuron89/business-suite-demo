import type { Knex } from 'knex';

/** IT pings a role (manager/hr/ehs) for info needed to complete onboarding. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('pings', (t) => {
    t.increments('id').primary();
    t.integer('ticket_id').notNullable().references('id').inTable('tickets').onDelete('CASCADE');
    t.integer('from_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('to_role').notNullable();
    t.text('message').notNullable();
    t.string('status').notNullable().defaultTo('open');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('resolved_at', { useTz: true });
    t.integer('resolved_by').references('id').inTable('users').onDelete('SET NULL');
    t.index(['to_role', 'status'], 'idx_pings_role_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pings');
}
