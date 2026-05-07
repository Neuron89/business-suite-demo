import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Add moc_number column (nullable first for backfill)
  await knex.schema.alterTable('moc_requests', (t) => {
    t.string('moc_number', 10).nullable();
  });

  // 2. Backfill existing rows: assign YYYY-NNN based on creation year + order
  await knex.raw(`
    WITH numbered AS (
      SELECT id, created_at,
        EXTRACT(YEAR FROM created_at)::int AS yr,
        ROW_NUMBER() OVER (
          PARTITION BY EXTRACT(YEAR FROM created_at)
          ORDER BY created_at, id
        ) AS seq
      FROM moc_requests
    )
    UPDATE moc_requests
    SET moc_number = numbered.yr || '-' || LPAD(numbered.seq::text, 3, '0')
    FROM numbered
    WHERE moc_requests.id = numbered.id
  `);

  // 3. Make not-nullable and unique
  await knex.schema.alterTable('moc_requests', (t) => {
    t.string('moc_number', 10).notNullable().alter();
    t.unique(['moc_number']);
  });

  // 4. Update the full-text search vector to include moc_number
  await knex.raw(`
    ALTER TABLE moc_requests
    DROP COLUMN search_vector
  `);
  await knex.raw(`
    ALTER TABLE moc_requests
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(moc_number, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(justification, '')), 'C')
    ) STORED
  `);
  await knex.raw('CREATE INDEX idx_moc_search ON moc_requests USING GIN(search_vector)');
}

export async function down(knex: Knex): Promise<void> {
  // Restore original search vector
  await knex.raw('ALTER TABLE moc_requests DROP COLUMN search_vector');
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

  await knex.schema.alterTable('moc_requests', (t) => {
    t.dropColumn('moc_number');
  });
}
