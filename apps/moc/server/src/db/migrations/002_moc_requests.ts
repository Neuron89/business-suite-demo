import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('moc_requests', (t) => {
    t.increments('id').primary();
    t.string('title', 200).notNullable();
    t.text('description').notNullable();
    t.enum('change_type', [
      'process_change', 'equipment_change', 'chemical_change',
      'procedure_change', 'facility_change', 'technology_change',
      'organizational_change',
    ]).notNullable();
    t.enum('status', [
      'draft', 'submitted', 'risk_assessment', 'under_review',
      'approved', 'rejected', 'returned', 'implementing',
      'pssr_pending', 'pssr_complete', 'closed',
    ]).notNullable().defaultTo('draft');
    t.specificType('affected_areas', 'text[]').notNullable();
    t.specificType('affected_chemicals', 'text[]').notNullable().defaultTo('{}');
    t.text('justification').notNullable();
    t.date('proposed_start_date').notNullable();
    t.date('proposed_end_date').notNullable();
    t.boolean('is_psm_relevant').notNullable().defaultTo(false);
    t.boolean('emergency_change').notNullable().defaultTo(false);
    t.integer('created_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    t.timestamps(true, true);
  });

  // Full-text search index
  await knex.raw(`
    ALTER TABLE moc_requests
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(justification, '')), 'C')
    ) STORED
  `);
  await knex.raw('CREATE INDEX idx_moc_search ON moc_requests USING GIN(search_vector)');
  await knex.raw('CREATE INDEX idx_moc_status ON moc_requests(status)');
  await knex.raw('CREATE INDEX idx_moc_created_by ON moc_requests(created_by)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('moc_requests');
}
