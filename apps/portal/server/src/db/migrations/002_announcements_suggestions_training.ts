import type { Knex } from 'knex';

/**
 * Adds three new portal modules:
 *
 * 1. Announcements — admin/HR-posted company-wide notices that show up on
 *    the home page. Acknowledgements are optional.
 * 2. Suggestion Box (Kaizen) — anyone can submit an improvement idea;
 *    admins/managers triage and update status.
 * 3. Training Tracker — admin assigns training items to employees; tracks
 *    completion + (optional) expiration for compliance.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('announcements', (t) => {
    t.increments('id').primary();
    t.string('title', 200).notNullable();
    t.text('body').notNullable();
    t.string('author_email', 255).notNullable();
    t.string('author_name', 255);
    t.boolean('pinned').notNullable().defaultTo(false);
    /** When omitted, the announcement stays visible indefinitely. */
    t.timestamp('expires_at');
    /** Optional audience filter — if null, visible to everyone. */
    t.specificType('audience_roles', 'text[]');
    t.boolean('require_ack').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });
  await knex.schema.raw(
    'CREATE INDEX idx_announcements_active ON announcements(pinned DESC, created_at DESC)'
  );

  await knex.schema.createTable('announcement_acks', (t) => {
    t.increments('id').primary();
    t.integer('announcement_id')
      .notNullable()
      .references('id')
      .inTable('announcements')
      .onDelete('CASCADE');
    t.string('email', 255).notNullable();
    t.timestamp('acknowledged_at').notNullable().defaultTo(knex.fn.now());
    t.unique(['announcement_id', 'email']);
  });

  await knex.schema.createTable('suggestions', (t) => {
    t.increments('id').primary();
    t.string('submitter_email', 255).notNullable();
    t.string('submitter_name', 255);
    /** "safety" | "process" | "facility" | "it" | "other" — kept loose for now. */
    t.string('category', 64).notNullable().defaultTo('other');
    t.string('title', 200).notNullable();
    t.text('body').notNullable();
    /** "new" | "under_review" | "in_progress" | "implemented" | "declined" */
    t.string('status', 32).notNullable().defaultTo('new');
    t.string('reviewed_by_email', 255);
    t.text('review_notes');
    t.timestamp('reviewed_at');
    t.boolean('is_anonymous').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });
  await knex.schema.raw(
    'CREATE INDEX idx_suggestions_status ON suggestions(status, created_at DESC)'
  );

  await knex.schema.createTable('training_items', (t) => {
    t.increments('id').primary();
    t.string('title', 200).notNullable().unique();
    t.text('description');
    /** "safety" | "quality" | "compliance" | "operational" | "other" */
    t.string('category', 64).notNullable().defaultTo('other');
    /** Recurrence in days — null means one-time training that doesn't expire. */
    t.integer('recurrence_days');
    t.string('reference_url', 512);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('training_assignments', (t) => {
    t.increments('id').primary();
    t.integer('training_item_id')
      .notNullable()
      .references('id')
      .inTable('training_items')
      .onDelete('CASCADE');
    t.string('employee_email', 255).notNullable();
    t.string('employee_name', 255);
    t.string('assigned_by_email', 255);
    t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('due_date');
    t.timestamp('completed_at');
    t.string('completed_by_email', 255); // who marked it done (admin or self)
    t.timestamp('expires_at');
    t.text('notes');
    t.unique(['training_item_id', 'employee_email']);
  });
  await knex.schema.raw(
    'CREATE INDEX idx_training_assignments_employee ON training_assignments(employee_email, completed_at)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_training_assignments_expires ON training_assignments(expires_at)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('training_assignments');
  await knex.schema.dropTableIfExists('training_items');
  await knex.schema.dropTableIfExists('suggestions');
  await knex.schema.dropTableIfExists('announcement_acks');
  await knex.schema.dropTableIfExists('announcements');
}
