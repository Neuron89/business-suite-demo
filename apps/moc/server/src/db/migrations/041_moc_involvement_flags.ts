import type { Knex } from 'knex';

/**
 * Adds explicit involvement flags to moc_requests so Purchasing (Purchasing Lead)
 * and NPD (NPD Lead) can be opted in per MOC. Manual selection — no
 * auto-derivation from change_type.
 *
 * Also adds a `review_cycle` counter that bumps on every reset-on-reject so
 * stale moc_approvers rows can be distinguished from fresh ones.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.boolean('purchasing_involved').notNullable().defaultTo(false);
    t.boolean('npd_involved').notNullable().defaultTo(false);
    t.integer('review_cycle').notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('moc_requests', (t) => {
    t.dropColumn('purchasing_involved');
    t.dropColumn('npd_involved');
    t.dropColumn('review_cycle');
  });
}
