import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Drop the search_vector generated column (depends on moc_number)
  await knex.raw('DROP INDEX IF EXISTS idx_moc_search');
  await knex.raw('ALTER TABLE moc_requests DROP COLUMN IF EXISTS search_vector');

  // 2. Drop existing unique constraint on moc_number
  await knex.raw('ALTER TABLE moc_requests DROP CONSTRAINT IF EXISTS moc_requests_moc_number_unique');

  // 3. Widen moc_number to 25 chars and make nullable (for drafts)
  await knex.raw(`
    ALTER TABLE moc_requests
    ALTER COLUMN moc_number TYPE varchar(25),
    ALTER COLUMN moc_number DROP NOT NULL
  `);

  // 4. Make change_type nullable (drafts may not have one yet)
  await knex.raw(`
    ALTER TABLE moc_requests
    ALTER COLUMN change_type DROP NOT NULL
  `);

  // 5. Backfill existing moc_numbers: YYYY-NNN -> MOC-YYYY-NNN-{risk_level}
  //    Map crf_risk_level to suffix, default to L0 for null or '---'
  await knex.raw(`
    UPDATE moc_requests
    SET moc_number = 'MOC-' || moc_number || '-' ||
      CASE
        WHEN crf_risk_level IN ('L0', 'L1', 'L2', 'L3') THEN crf_risk_level
        ELSE 'L0'
      END
    WHERE moc_number IS NOT NULL
      AND moc_number NOT LIKE 'MOC-%'
  `);

  // 6. Add partial unique index (only for non-null moc_numbers)
  await knex.raw(`
    CREATE UNIQUE INDEX moc_requests_moc_number_unique
    ON moc_requests (moc_number)
    WHERE moc_number IS NOT NULL
  `);

  // 7. Rebuild the search_vector generated column with new format
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
  // Drop search_vector and index
  await knex.raw('DROP INDEX IF EXISTS idx_moc_search');
  await knex.raw('ALTER TABLE moc_requests DROP COLUMN IF EXISTS search_vector');

  // Drop partial unique index
  await knex.raw('DROP INDEX IF EXISTS moc_requests_moc_number_unique');

  // Revert moc_numbers: MOC-YYYY-NNN-LEVEL -> YYYY-NNN
  await knex.raw(`
    UPDATE moc_requests
    SET moc_number = SUBSTRING(moc_number FROM 5 FOR 8)
    WHERE moc_number LIKE 'MOC-%'
  `);

  // Restore moc_number to NOT NULL varchar(10) with unique constraint
  await knex.raw(`
    ALTER TABLE moc_requests
    ALTER COLUMN moc_number TYPE varchar(10),
    ALTER COLUMN moc_number SET NOT NULL
  `);
  await knex.raw('ALTER TABLE moc_requests ADD CONSTRAINT moc_requests_moc_number_unique UNIQUE (moc_number)');

  // Restore change_type NOT NULL
  await knex.raw(`
    ALTER TABLE moc_requests
    ALTER COLUMN change_type SET NOT NULL
  `);

  // Restore search_vector
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
