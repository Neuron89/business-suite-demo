import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pssr_items', (t) => {
    t.string('action_type', 20).defaultTo('pre_startup');
  });

  // Add CHECK constraint for action_type values
  await knex.raw(`
    ALTER TABLE pssr_items ADD CONSTRAINT chk_pssr_action_type
      CHECK (action_type IN ('pre_startup', 'post_startup'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE pssr_items DROP CONSTRAINT IF EXISTS chk_pssr_action_type');
  await knex.schema.alterTable('pssr_items', (t) => {
    t.dropColumn('action_type');
  });
}
