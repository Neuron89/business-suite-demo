import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.boolean('admin_access').notNullable().defaultTo(false);
  });

  // Grant admin access to Plant Manager
  await knex('users').where('email', 'demo.manager@acme.demo').update({ admin_access: true });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('admin_access');
  });
}
