import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_log', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.string('action', 100).notNullable();
    t.string('entity_type', 50).notNullable();
    t.integer('entity_id').unsigned().notNullable();
    t.jsonb('changes').defaultTo('{}');
    t.string('ip_address', 45).defaultTo('');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id)');
  await knex.raw('CREATE INDEX idx_audit_user ON audit_log(user_id)');
  await knex.raw('CREATE INDEX idx_audit_created ON audit_log(created_at)');

  await knex.schema.createTable('notifications', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    t.string('title', 200).notNullable();
    t.text('message').notNullable();
    t.string('type', 50).notNullable().defaultTo('info');
    t.string('entity_type', 50).defaultTo('');
    t.integer('entity_id').unsigned().defaultTo(0);
    t.boolean('is_read').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_notif_user ON notifications(user_id, is_read)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('audit_log');
}
