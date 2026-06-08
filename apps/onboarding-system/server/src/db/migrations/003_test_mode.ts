import type { Knex } from 'knex';

/**
 * Test mode plumbing:
 * - Add `ehs` to the allowed roles so the testing sandbox can sign in as
 *   an EHS user and exercise the (forthcoming) EHS step in onboarding.
 * - Add `is_test` flag on users so the UI can render a test-mode banner
 *   and test-only endpoints can refuse to act on real users.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await knex.schema.raw(
    `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('employee', 'manager', 'it_admin', 'hr', 'ehs'))`
  );
  await knex.schema.alterTable('users', (t) => {
    t.boolean('is_test').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('is_test');
  });
  await knex.schema.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await knex.schema.raw(
    `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('employee', 'manager', 'it_admin', 'hr'))`
  );
}
