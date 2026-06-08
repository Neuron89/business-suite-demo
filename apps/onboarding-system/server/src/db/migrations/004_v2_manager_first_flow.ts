import type { Knex } from 'knex';

/**
 * v2 onboarding workflow — manager-first.
 *
 * Old flow (v1): HR creates ticket → manager_review (manager adds IT needs) →
 * it_review → completed
 *
 * New flow (v2): A manager (or anyone with onboarding access) creates the
 * ticket WITH the IT needs (title, dept, location, hardware/software/access).
 * Ticket lands at hr_fill → HR adds employee identity (name, badge#, start
 * date) → it_close → IT closes, automation fires.
 *
 * Existing in-flight tickets keep their original flow_version=1 so they can
 * finish on the old state machine. Only newly-created tickets default to 2.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tickets', (t) => {
    // 1 = legacy HR-first flow, 2 = manager-first flow
    t.smallint('flow_version').notNullable().defaultTo(1);
    // Captures who SHOULD do the HR-fill step. Defaults to null; routes set
    // it to the requester's manager_email or leaves null so any HR/IT user
    // can claim.
    t.timestamp('hr_fill_at', { useTz: true });
    t.timestamp('it_close_at', { useTz: true });
    t.index('flow_version', 'idx_tickets_flow_version');
  });

  // Backfill existing tickets to v1 (already the default but explicit is
  // safer if Knex ever changes the alter semantics).
  await knex('tickets').update({ flow_version: 1 });

  // New tickets going forward default to v2. We flip the column default after
  // backfill so old rows stay at 1 but new INSERTs without an explicit
  // flow_version land at 2.
  await knex.schema.alterTable('tickets', (t) => {
    t.smallint('flow_version').notNullable().defaultTo(2).alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tickets', (t) => {
    t.dropIndex('flow_version', 'idx_tickets_flow_version');
    t.dropColumn('flow_version');
    t.dropColumn('hr_fill_at');
    t.dropColumn('it_close_at');
  });
}
