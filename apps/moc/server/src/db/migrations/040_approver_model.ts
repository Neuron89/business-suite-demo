import type { Knex } from 'knex';

/**
 * Phase 1 of the approval refactor.
 *
 * Adds:
 *   - `purchasing` to the role check constraint on users
 *   - `users.is_approver` boolean
 *   - `moc_approvers` table (populated/used in Phase 2)
 *
 * No behavior changes in this migration — existing role-based approvals keep
 * working. Phase 2 swaps the review endpoint and workflow service to consume
 * `moc_approvers` instead of the `reviews`-by-role pattern.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Expand role check constraint to include `purchasing`
  await knex.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await knex.raw(`
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
      role = ANY (ARRAY[
        'super_admin', 'admin', 'ehs', 'operations', 'qc',
        'moc_manager', 'maintenance', 'it', 'product_manager',
        'sales', 'management', 'purchasing'
      ])
    )
  `);

  // 2. is_approver flag on users
  await knex.schema.alterTable('users', (t) => {
    t.boolean('is_approver').notNullable().defaultTo(false);
  });

  // 3. moc_approvers table — per-MOC named approver list
  await knex.schema.createTable('moc_approvers', (t) => {
    t.increments('id').primary();
    t.integer('moc_id').notNullable().references('id').inTable('moc_requests').onDelete('CASCADE');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('role_context', 50).nullable(); // e.g. 'ehs', 'operations:batch', 'purchasing', 'management'
    t.enum('decision', ['pending', 'approved', 'rejected', 'returned']).notNullable().defaultTo('pending');
    t.text('comments').nullable();
    t.integer('decided_at_status_version').nullable(); // bump on reset-on-reject so stale rows can be detected
    t.timestamp('decided_at').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['moc_id', 'user_id', 'role_context']);
    t.index('moc_id');
    t.index(['user_id', 'decision']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('moc_approvers');
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('is_approver');
  });
  await knex.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await knex.raw(`
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
      role = ANY (ARRAY[
        'super_admin', 'admin', 'ehs', 'operations', 'qc',
        'moc_manager', 'maintenance', 'it', 'product_manager',
        'sales', 'management'
      ])
    )
  `);
}
