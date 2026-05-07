import type { Knex } from 'knex';

/**
 * Phase 1: evolve the request workflow into a full ticketing system.
 * - Rename requests/request_comments/request_history → tickets/ticket_comments/ticket_history
 * - Add: assignee_id, due_date, category_id, closed_at, resolution_notes, onboarding_details
 * - Add: hr role, onboarding request_type
 * - Add: ticket_categories, ticket_attachments
 * - Add: is_internal flag on comments
 */
export async function up(knex: Knex): Promise<void> {
  // Rename tables
  await knex.schema.renameTable('requests', 'tickets');
  await knex.schema.renameTable('request_comments', 'ticket_comments');
  await knex.schema.renameTable('request_history', 'ticket_history');

  // Rename columns
  await knex.schema.alterTable('ticket_comments', (t) => {
    t.renameColumn('request_id', 'ticket_id');
  });
  await knex.schema.alterTable('ticket_history', (t) => {
    t.renameColumn('request_id', 'ticket_id');
  });

  // Drop old CHECK constraints (knex names them <table>_<col>_check)
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS requests_request_type_check`);
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS requests_status_check`);
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS requests_urgency_check`);
  await knex.schema.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);

  // Re-add with extended values
  await knex.schema.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('employee', 'manager', 'it_admin', 'hr'))`);
  await knex.schema.raw(`ALTER TABLE tickets ADD CONSTRAINT tickets_request_type_check CHECK (request_type IN ('hardware', 'software', 'permission', 'access', 'onboarding', 'other'))`);
  await knex.schema.raw(`ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('draft', 'submitted', 'manager_review', 'it_review', 'approved', 'denied', 'in_progress', 'waiting', 'completed', 'cancelled'))`);
  await knex.schema.raw(`ALTER TABLE tickets ADD CONSTRAINT tickets_urgency_check CHECK (urgency IN ('low', 'medium', 'high', 'critical'))`);

  // Ticket categories
  await knex.schema.createTable('ticket_categories', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.string('color', 16).notNullable().defaultTo('#94a3b8');
    t.string('icon', 8);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  // Seed categories
  await knex('ticket_categories').insert([
    { name: 'Onboarding',       color: '#22c55e', icon: 'O', sort_order: 10 },
    { name: 'Hardware',         color: '#3b82f6', icon: 'H', sort_order: 20 },
    { name: 'Software',         color: '#8b5cf6', icon: 'S', sort_order: 30 },
    { name: 'Access / Permissions', color: '#f59e0b', icon: 'A', sort_order: 40 },
    { name: 'Network',          color: '#06b6d4', icon: 'N', sort_order: 50 },
    { name: 'Account',          color: '#ec4899', icon: 'U', sort_order: 60 },
    { name: 'Other',            color: '#64748b', icon: '?', sort_order: 99 },
  ]);

  // Ticket extra columns
  await knex.schema.alterTable('tickets', (t) => {
    t.integer('assignee_id').references('id').inTable('users').onDelete('SET NULL');
    t.integer('category_id').references('id').inTable('ticket_categories').onDelete('SET NULL');
    t.timestamp('due_date');
    t.timestamp('closed_at');
    t.text('resolution_notes');
    t.jsonb('onboarding_details');
  });

  await knex.schema.raw('CREATE INDEX idx_tickets_assignee ON tickets(assignee_id)');
  await knex.schema.raw('CREATE INDEX idx_tickets_category ON tickets(category_id)');
  await knex.schema.raw('CREATE INDEX idx_tickets_due_date ON tickets(due_date)');

  // Comments: internal flag (IT-only notes invisible to requester)
  await knex.schema.alterTable('ticket_comments', (t) => {
    t.boolean('is_internal').notNullable().defaultTo(false);
  });

  // Attachments
  await knex.schema.createTable('ticket_attachments', (t) => {
    t.increments('id').primary();
    t.integer('ticket_id').notNullable().references('id').inTable('tickets').onDelete('CASCADE');
    t.integer('uploaded_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('filename').notNullable();
    t.string('mime_type', 128);
    t.integer('size_bytes');
    t.string('storage_path').notNullable();
    t.timestamps(true, true);
  });

  await knex.schema.raw('CREATE INDEX idx_attachments_ticket ON ticket_attachments(ticket_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ticket_attachments');

  await knex.schema.alterTable('ticket_comments', (t) => {
    t.dropColumn('is_internal');
  });

  await knex.schema.raw('DROP INDEX IF EXISTS idx_tickets_assignee');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_tickets_category');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_tickets_due_date');

  await knex.schema.alterTable('tickets', (t) => {
    t.dropColumn('assignee_id');
    t.dropColumn('category_id');
    t.dropColumn('due_date');
    t.dropColumn('closed_at');
    t.dropColumn('resolution_notes');
    t.dropColumn('onboarding_details');
  });

  await knex.schema.dropTableIfExists('ticket_categories');

  // Restore old CHECK constraints
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_request_type_check`);
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check`);
  await knex.schema.raw(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_urgency_check`);
  await knex.schema.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);

  await knex.schema.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('employee', 'manager', 'it_admin'))`);
  await knex.schema.raw(`ALTER TABLE tickets ADD CONSTRAINT requests_request_type_check CHECK (request_type IN ('hardware', 'software', 'permission', 'access', 'other'))`);
  await knex.schema.raw(`ALTER TABLE tickets ADD CONSTRAINT requests_status_check CHECK (status IN ('draft', 'submitted', 'manager_review', 'it_review', 'approved', 'denied', 'in_progress', 'completed', 'cancelled'))`);
  await knex.schema.raw(`ALTER TABLE tickets ADD CONSTRAINT requests_urgency_check CHECK (urgency IN ('low', 'medium', 'high', 'critical'))`);

  await knex.schema.alterTable('ticket_history', (t) => {
    t.renameColumn('ticket_id', 'request_id');
  });
  await knex.schema.alterTable('ticket_comments', (t) => {
    t.renameColumn('ticket_id', 'request_id');
  });

  await knex.schema.renameTable('ticket_history', 'request_history');
  await knex.schema.renameTable('ticket_comments', 'request_comments');
  await knex.schema.renameTable('tickets', 'requests');
}
