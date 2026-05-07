import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Update role constraint to include maintenance
  await knex.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'ehs', 'operations', 'qc', 'moc_manager', 'maintenance'))`);

  // Update admin user (id 1)
  await knex('users').where('email', 'admin@facility.local').update({ email: 'demo.it@acme.demo', name: 'IT Admin' });

  // EHS seed user (id 2): deactivate — real user is demo.manager (id 7)
  await knex('users').where('email', 'ehs@facility.local').update({ is_active: false });

  // Ops seed user (id 3): update to demo.employee
  await knex('users').where('email', 'ops@facility.local').update({ email: 'demo.employee@acme.demo', name: 'Operator' });

  // QC seed user (id 4): deactivate — real user is hkirkwood (id 6)
  await knex('users').where('email', 'qc@facility.local').update({ is_active: false });

  // MOC Manager: demo.manager — update email
  await knex('users').where('email', 'demo.manager@facility.local').update({ email: 'demo.manager@acme.demo' });

  // Add maintenance user
  const existingMaint = await knex('users').where('email', 'demo.it@acme.demo').first();
  if (!existingMaint) {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('admin123!', 12);
    await knex('users').insert({ email: 'demo.it@acme.demo', password_hash: hash, name: 'Maintenance Lead', role: 'maintenance' });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('users').where('email', 'demo.it@acme.demo').del();
  await knex('users').where('email', 'demo.manager@acme.demo').update({ email: 'demo.manager@facility.local' });
  await knex('users').whereRaw("email LIKE '%@facility.local' AND role = 'qc'").update({ is_active: true });
  await knex('users').whereRaw("email LIKE '%@facility.local' AND role = 'ehs'").update({ is_active: true });
  await knex('users').where('email', 'demo.employee@acme.demo').update({ email: 'ops@facility.local', name: 'Head of Operations' });
  await knex('users').where('email', 'demo.it@acme.demo').update({ email: 'admin@facility.local', name: 'System Admin' });

  await knex.raw(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await knex.raw(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'ehs', 'operations', 'qc', 'moc_manager'))`);
}
