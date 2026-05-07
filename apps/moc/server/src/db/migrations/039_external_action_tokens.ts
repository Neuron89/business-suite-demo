import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('external_action_tokens', (t) => {
    t.increments('id').primary();
    t.uuid('token').notNullable().unique();
    t.string('item_type', 10).notNullable(); // 'dsr' or 'pssr'
    t.integer('item_id').notNullable();
    t.integer('moc_id').notNullable().references('id').inTable('moc_requests').onDelete('CASCADE');
    t.string('email', 255).notNullable();
    t.string('name', 255).nullable();
    t.timestamp('responded_at').nullable();
    t.text('response_note').nullable();
    t.boolean('marked_done').notNullable().defaultTo(false);
    t.timestamp('expires_at').notNullable();
    t.integer('created_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.raw('CREATE INDEX idx_ext_token ON external_action_tokens (token)');
  await knex.schema.raw('CREATE INDEX idx_ext_item ON external_action_tokens (item_type, item_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('external_action_tokens');
}
