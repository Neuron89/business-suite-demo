import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * Migration 036: Super Admin, Management role, custom DSR/PSSR items, Plant Manager
 *
 * 1. Add 'super_admin' and 'management' to users role constraint
 * 2. Add 'is_custom' boolean column to dsr_items and pssr_items
 * 3. Seed Plant Manager as management user (required approver on all MOCs)
 * 4. Add 'management' to departments enum (already part of shared constants)
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Update users role constraint to include super_admin and management
  await knex.raw(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
      role = ANY (ARRAY[
        'super_admin', 'admin', 'ehs', 'operations', 'qc',
        'moc_manager', 'maintenance', 'it', 'product_manager', 'sales',
        'management'
      ]::text[])
    );
  `);

  // 2. Add is_custom column to dsr_items and pssr_items
  const hasDsrCustom = await knex.schema.hasColumn('dsr_items', 'is_custom');
  if (!hasDsrCustom) {
    await knex.schema.alterTable('dsr_items', (table) => {
      table.boolean('is_custom').defaultTo(false).notNullable();
    });
  }

  const hasPssrCustom = await knex.schema.hasColumn('pssr_items', 'is_custom');
  if (!hasPssrCustom) {
    await knex.schema.alterTable('pssr_items', (table) => {
      table.boolean('is_custom').defaultTo(false).notNullable();
    });
  }

  // 3. Seed Plant Manager as management user if not exists
  const existing = await knex('users').where('email', 'demo.manager@acme.demo').first();
  if (!existing) {
    const hash = await bcrypt.hash('AcmeMgmt2024!', 12);
    await knex('users').insert({
      email: 'demo.manager@acme.demo',
      password_hash: hash,
      name: 'Plant Manager',
      role: 'management',
      is_active: true,
    });
  } else if (existing.role !== 'management') {
    // Update existing user to management role
    await knex('users').where('email', 'demo.manager@acme.demo').update({ role: 'management' });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Revert role constraint
  await knex.raw(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
      role = ANY (ARRAY[
        'admin', 'ehs', 'operations', 'qc',
        'moc_manager', 'maintenance', 'it', 'product_manager', 'sales'
      ]::text[])
    );
  `);

  // Remove is_custom columns
  const hasDsrCustom = await knex.schema.hasColumn('dsr_items', 'is_custom');
  if (hasDsrCustom) {
    await knex.schema.alterTable('dsr_items', (table) => {
      table.dropColumn('is_custom');
    });
  }

  const hasPssrCustom = await knex.schema.hasColumn('pssr_items', 'is_custom');
  if (hasPssrCustom) {
    await knex.schema.alterTable('pssr_items', (table) => {
      table.dropColumn('is_custom');
    });
  }
}
