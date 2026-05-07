import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('system_requests', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.text('description').notNullable();
    t.text('screenshot_data').nullable();
    t.string('page_url', 500).notNullable();
    t.enum('status', ['new', 'reviewed', 'in_progress', 'completed', 'dismissed'])
      .notNullable().defaultTo('new');
    t.text('admin_notes').defaultTo('');
    t.timestamps(true, true);
  });

  await knex.raw('CREATE INDEX idx_sysreq_user ON system_requests(user_id)');
  await knex.raw('CREATE INDEX idx_sysreq_status ON system_requests(status)');
  await knex.raw('CREATE INDEX idx_sysreq_created ON system_requests(created_at)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('system_requests');
}
