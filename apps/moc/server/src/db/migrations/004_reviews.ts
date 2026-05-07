import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('reviews', (t) => {
    t.increments('id').primary();
    t.integer('moc_id').unsigned().notNullable()
      .references('id').inTable('moc_requests').onDelete('CASCADE');
    t.integer('reviewer_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.enum('reviewer_role', ['ehs', 'operations', 'qc', 'admin']).notNullable();
    t.enum('decision', ['approved', 'rejected', 'returned']).notNullable();
    t.text('comments').defaultTo('');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_reviews_moc ON reviews(moc_id)');
  // One review per role per MOC (latest wins on re-review)
  await knex.raw(`
    CREATE UNIQUE INDEX idx_reviews_moc_role
    ON reviews(moc_id, reviewer_role)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('reviews');
}
