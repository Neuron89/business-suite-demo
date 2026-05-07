import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * MOC demo seed — 4 demo users + 3 sample MOC requests in different states.
 * Idempotent: only inserts when the users table is empty.
 */
const DEMO_USERS = [
  { email: 'demo.it@acme.demo',       name: 'Ivy Tanaka',     role: 'super_admin', admin_access: true,  is_approver: true  },
  { email: 'demo.hr@acme.demo',       name: 'Hana Reyes',     role: 'admin',       admin_access: true,  is_approver: true  },
  { email: 'demo.manager@acme.demo',  name: 'Marco Goldberg', role: 'moc_manager', admin_access: true,  is_approver: true  },
  { email: 'demo.employee@acme.demo', name: 'Eli Park',       role: 'operations',  admin_access: false, is_approver: false },
];

interface MocSeed {
  title: string;
  description: string;
  change_type: string;
  status: string;
  affected_areas: string[];
  affected_chemicals: string[];
  justification: string;
  proposed_start_date: string;
  proposed_end_date: string;
  is_psm_relevant: boolean;
  emergency_change: boolean;
  created_by_email: string;
}

const MOCS: MocSeed[] = [
  {
    title: 'Replace heat exchanger HE-204',
    description: 'Existing shell-and-tube heat exchanger HE-204 in Reactor Loop B has shown progressive tube fouling. Replacement with a plate-frame model will improve heat transfer efficiency and simplify CIP cycles.',
    change_type: 'equipment_change',
    status: 'under_review',
    affected_areas: ['Plant A — Loop B', 'Maintenance shop'],
    affected_chemicals: ['Cooling water', 'Polymer Resin A'],
    justification: 'Tube fouling has reduced heat duty 18% over the last 6 months, forcing operators to slow line speed.',
    proposed_start_date: '2026-06-15',
    proposed_end_date: '2026-06-22',
    is_psm_relevant: true,
    emergency_change: false,
    created_by_email: 'demo.manager@acme.demo',
  },
  {
    title: 'Update raw material spec for Solvent C',
    description: 'Tightening the upper limit on water content from 0.5% to 0.25% for Solvent C to match new customer specs from Northwind Corp.',
    change_type: 'chemical_change',
    status: 'approved',
    affected_areas: ['QC Lab', 'Receiving'],
    affected_chemicals: ['Solvent C'],
    justification: 'Northwind contract update requires lower water spec on Solvent C to meet downstream coating performance.',
    proposed_start_date: '2026-04-01',
    proposed_end_date: '2026-04-08',
    is_psm_relevant: false,
    emergency_change: false,
    created_by_email: 'demo.hr@acme.demo',
  },
  {
    title: 'Decommission Reactor R-3',
    description: 'Remove and decommission legacy Reactor R-3, which has been idle since the line consolidation in 2024. Drain residual material, blind off connections, and clean the foundation pad.',
    change_type: 'facility_change',
    status: 'draft',
    affected_areas: ['Plant A — Bay 3'],
    affected_chemicals: [],
    justification: 'R-3 has not run product since the consolidation. Removal frees ~400 sq ft for the new tableting line.',
    proposed_start_date: '2026-08-01',
    proposed_end_date: '2026-08-21',
    is_psm_relevant: true,
    emergency_change: false,
    created_by_email: 'demo.employee@acme.demo',
  },
];

export async function seed(knex: Knex): Promise<void> {
  const userCount = await knex('users').count<{ count: string }[]>('id as count');
  if (Number(userCount[0]?.count ?? 0) > 0) {
    console.log('[moc seed] users table not empty, skipping demo seed');
    return;
  }

  const hash = await bcrypt.hash('demo', 10);

  // Insert demo users
  const userRows = await knex('users')
    .insert(
      DEMO_USERS.map((u) => ({
        email: u.email,
        name: u.name,
        role: u.role,
        password_hash: hash,
        admin_access: u.admin_access,
        is_approver: u.is_approver,
        is_active: true,
      }))
    )
    .returning(['id', 'email']);

  const userIdByEmail = new Map(userRows.map((r: any) => [r.email, r.id]));

  for (const m of MOCS) {
    const createdBy = userIdByEmail.get(m.created_by_email);
    if (!createdBy) continue;
    await knex('moc_requests').insert({
      title: m.title,
      description: m.description,
      change_type: m.change_type,
      status: m.status,
      affected_areas: m.affected_areas,
      affected_chemicals: m.affected_chemicals,
      justification: m.justification,
      proposed_start_date: m.proposed_start_date,
      proposed_end_date: m.proposed_end_date,
      is_psm_relevant: m.is_psm_relevant,
      emergency_change: m.emergency_change,
      created_by: createdBy,
    });
  }

  console.log(`[moc seed] inserted ${DEMO_USERS.length} users + ${MOCS.length} MOC requests`);
}
