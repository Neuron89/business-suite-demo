import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('attachments', (t) => {
    t.increments('id').primary();
    t.integer('moc_id').unsigned().notNullable()
      .references('id').inTable('moc_requests').onDelete('CASCADE');
    t.string('filename', 255).notNullable();
    t.string('original_name', 255).notNullable();
    t.string('mime_type', 100).notNullable();
    t.integer('size').unsigned().notNullable();
    t.integer('uploaded_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_attachments_moc ON attachments(moc_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('attachments');
}
