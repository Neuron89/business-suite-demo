import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('complaints', (table) => {
    table.increments('id').primary();
    table.string('complaint_number').notNullable().unique();
    // Customer info
    table.string('customer_name').notNullable();
    table.string('customer_email').nullable();
    table.string('customer_phone').nullable();
    table.string('customer_company').nullable();
    // Product info
    table.string('product_name').notNullable();
    table.string('lot_number').nullable();
    // Classification
    table.enum('complaint_type', ['quality', 'delivery', 'packaging', 'documentation', 'contamination', 'other']).notNullable();
    table.enum('severity', ['low', 'medium', 'high', 'critical']).notNullable();
    table.enum('status', ['submitted', 'under_review', 'resolved', 'closed', 'rejected', 'returned']).notNullable().defaultTo('submitted');
    // Details
    table.string('title', 200).notNullable();
    table.text('description').notNullable();
    table.text('resolution').nullable();
    table.timestamp('resolution_date').nullable();
    // Relations
    table.integer('created_by').unsigned().notNullable().references('id').inTable('users');
    table.integer('assigned_to').unsigned().nullable().references('id').inTable('users');
    // Timestamps
    table.timestamps(true, true);
  });

  // Full-text search index
  await knex.raw(`
    ALTER TABLE complaints ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(customer_name, '') || ' ' || coalesce(product_name, ''))) STORED;
  `);
  await knex.raw('CREATE INDEX idx_complaints_search ON complaints USING gin(search_vector)');

  // Sequence for complaint numbers
  await knex.raw("CREATE SEQUENCE IF NOT EXISTS complaint_number_seq START 1");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('complaints');
  await knex.raw('DROP SEQUENCE IF EXISTS complaint_number_seq');
}
