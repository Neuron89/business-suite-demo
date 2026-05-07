import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Departments
  await knex.schema.createTable('departments', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.timestamps(true, true);
  });

  // Users
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('email').notNullable().unique();
    t.string('password_hash').notNullable();
    t.string('name').notNullable();
    t.enum('role', ['employee', 'manager', 'it_admin']).notNullable().defaultTo('employee');
    t.integer('department_id').references('id').inTable('departments').onDelete('SET NULL');
    t.integer('manager_id').references('id').inTable('users').onDelete('SET NULL');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.string('refresh_token');
    t.timestamps(true, true);
  });

  // Requests
  await knex.schema.createTable('requests', (t) => {
    t.increments('id').primary();
    t.string('request_number').notNullable().unique();
    t.integer('requester_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.enum('request_type', ['hardware', 'software', 'permission', 'access', 'other']).notNullable();
    t.enum('status', ['draft', 'submitted', 'manager_review', 'it_review', 'approved', 'denied', 'in_progress', 'completed', 'cancelled']).notNullable().defaultTo('draft');
    t.enum('urgency', ['low', 'medium', 'high', 'critical']).notNullable().defaultTo('medium');
    t.string('title', 200).notNullable();
    t.text('justification').notNullable();

    // Manager review
    t.integer('manager_id').references('id').inTable('users').onDelete('SET NULL');
    t.text('manager_notes');
    t.timestamp('manager_decision_at');

    // IT admin review
    t.integer('it_admin_id').references('id').inTable('users').onDelete('SET NULL');
    t.text('it_admin_notes');
    t.timestamp('it_decision_at');

    // Type-specific details (JSONB)
    t.jsonb('hardware_specs');
    t.jsonb('software_details');
    t.jsonb('permission_details');
    t.jsonb('access_details');
    t.jsonb('other_details');

    t.timestamps(true, true);
  });

  // Request comments
  await knex.schema.createTable('request_comments', (t) => {
    t.increments('id').primary();
    t.integer('request_id').notNullable().references('id').inTable('requests').onDelete('CASCADE');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.text('comment').notNullable();
    t.timestamps(true, true);
  });

  // Request history / audit trail
  await knex.schema.createTable('request_history', (t) => {
    t.increments('id').primary();
    t.integer('request_id').notNullable().references('id').inTable('requests').onDelete('CASCADE');
    t.string('from_status');
    t.string('to_status').notNullable();
    t.integer('changed_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.text('comment');
    t.timestamps(true, true);
  });

  // Indexes
  await knex.schema.raw('CREATE INDEX idx_requests_requester ON requests(requester_id)');
  await knex.schema.raw('CREATE INDEX idx_requests_status ON requests(status)');
  await knex.schema.raw('CREATE INDEX idx_requests_type ON requests(request_type)');
  await knex.schema.raw('CREATE INDEX idx_requests_manager ON requests(manager_id)');
  await knex.schema.raw('CREATE INDEX idx_request_history_request ON request_history(request_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('request_history');
  await knex.schema.dropTableIfExists('request_comments');
  await knex.schema.dropTableIfExists('requests');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('departments');
}
