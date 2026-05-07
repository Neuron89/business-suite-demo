import type { Knex } from 'knex';

/**
 * Portal-local schema. We keep this *minimal* on purpose — the portal mirrors
 * employee identity from the Employee Tech Doc directory rather than storing
 * its own copy.
 *
 * Tables:
 * - portal_users: per-employee password hash + activity flags
 * - password_reset_tokens: short-lived single-use tokens for set/reset flow
 * - portal_audit_log: who logged in / what they did
 * - admin_notes: ad-hoc notes shown on the admin dashboard
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('portal_users', (t) => {
    t.increments('id').primary();
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.boolean('must_reset').notNullable().defaultTo(true);
    t.timestamp('last_login_at');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('password_reset_tokens', (t) => {
    t.increments('id').primary();
    t.string('email', 255).notNullable();
    t.string('token', 128).notNullable().unique();
    t.timestamp('expires_at').notNullable();
    t.timestamp('used_at');
    t.timestamps(true, true);
  });
  await knex.schema.raw(
    'CREATE INDEX idx_reset_tokens_email ON password_reset_tokens(email)'
  );

  await knex.schema.createTable('portal_audit_log', (t) => {
    t.increments('id').primary();
    t.string('email', 255).notNullable();
    t.string('action', 64).notNullable();
    t.jsonb('detail');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('admin_notes', (t) => {
    t.increments('id').primary();
    t.string('author_email', 255).notNullable();
    t.text('body').notNullable();
    t.boolean('pinned').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('admin_notes');
  await knex.schema.dropTableIfExists('portal_audit_log');
  await knex.schema.dropTableIfExists('password_reset_tokens');
  await knex.schema.dropTableIfExists('portal_users');
}
