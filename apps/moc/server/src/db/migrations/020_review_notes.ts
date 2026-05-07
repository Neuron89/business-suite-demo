import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('review_notes', (t) => {
    t.increments('id').primary();
    t.integer('moc_id').unsigned().notNullable()
      .references('id').inTable('moc_requests').onDelete('CASCADE');
    t.integer('author_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.string('section_id', 100).notNullable();
    t.text('note').notNullable();
    t.boolean('resolved').defaultTo(false);
    t.integer('resolved_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('resolved_at').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_review_notes_moc ON review_notes(moc_id)');
  await knex.raw('CREATE INDEX idx_review_notes_moc_section ON review_notes(moc_id, section_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('review_notes');
}
