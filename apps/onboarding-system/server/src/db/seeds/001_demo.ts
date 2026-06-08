import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * Onboarding System demo seed — the 4 standard suite users + a realistic set
 * of in-flight onboarding cases across departments at different stages of the
 * v2 (manager-first) workflow.
 *
 * Idempotent: only inserts when the users table is empty, so re-runs on an
 * already-seeded DB are a no-op (mirrors apps/it-request/.../001_demo.ts).
 *
 * All demo users are flagged is_test=true so:
 *   - the /test-login role sandbox can sign in as any of them, and
 *   - the email service keeps every notification in log-only "test ticket"
 *     mode (it never tries to email real inboxes — see services/email.ts).
 */

// role values allowed by the users_role_check constraint:
// 'employee' | 'manager' | 'it_admin' | 'hr' | 'ehs'
const DEMO_USERS = [
  { email: 'demo.it@acme.demo',       name: 'Ivy Tanaka',     role: 'it_admin', dept: 'Information Technology' },
  { email: 'demo.hr@acme.demo',       name: 'Hana Reyes',     role: 'hr',       dept: 'Human Resources'       },
  { email: 'demo.manager@acme.demo',  name: 'Marco Goldberg', role: 'manager',  dept: 'Operations'           },
  { email: 'demo.employee@acme.demo', name: 'Eli Park',       role: 'employee', dept: 'Production'            },
];

const DEPARTMENTS = [
  'Information Technology',
  'Human Resources',
  'Operations',
  'Production',
  'Quality Control',
  'Warehouse',
];

// v2 manager-first flow statuses:
//   hr_fill → hr_searching → manager_start_date → it_close → completed
// Each case below is a realistic new-hire requisition the manager submitted,
// captured at a different point in that pipeline.
interface DemoCase {
  status: 'hr_fill' | 'hr_searching' | 'manager_start_date' | 'it_close' | 'completed';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  justification: string;
  details: Record<string, unknown>;
}

const CASES: DemoCase[] = [
  {
    status: 'hr_fill',
    urgency: 'high',
    title: 'New hire — Process Engineer (Operations)',
    justification: 'Backfill for a retiring process engineer; needs to be productive before the Q3 line changeover.',
    details: {
      job_title: 'Process Engineer',
      department: 'Operations',
      employment_type: 'full_time',
      office_location: 'Plant A',
      target_start_date: '2026-07-06',
      manager_email: 'demo.manager@acme.demo',
      needs_moc: true,
      needs_qc: true,
      manager_notes: 'Standard engineering laptop + dual monitors. MOC and QC access on day one.',
    },
  },
  {
    status: 'hr_searching',
    urgency: 'medium',
    title: 'New hire — QC Lab Technician',
    justification: 'Expanding second-shift lab coverage; req approved in headcount plan.',
    details: {
      job_title: 'QC Lab Technician',
      department: 'Quality Control',
      employment_type: 'full_time',
      office_location: 'Lab',
      target_start_date: '2026-07-13',
      manager_email: 'demo.manager@acme.demo',
      needs_qc: true,
      needs_sds: true,
      manager_notes: 'Needs SDS and QC system access. No laptop — shared lab workstation login.',
      hr_search_status: 'Offer extended, awaiting signed acceptance.',
    },
  },
  {
    status: 'manager_start_date',
    urgency: 'medium',
    title: 'New hire — Warehouse Associate',
    justification: 'Peak-season throughput; one of three approved warehouse adds.',
    details: {
      full_name: 'Priya Nair',
      preferred_name: 'Priya',
      job_title: 'Warehouse Associate',
      department: 'Warehouse',
      employment_type: 'full_time',
      office_location: 'DC-1',
      employee_number: 'E10421',
      badge_number: 'B2207',
      personal_email: 'priya.nair@example.com',
      phone: '555-0142',
      manager_email: 'demo.manager@acme.demo',
      needs_shipping: true,
      hr_notes: 'Identity confirmed. Manager to set the confirmed start date.',
    },
  },
  {
    status: 'it_close',
    urgency: 'high',
    title: 'New hire — Production Supervisor',
    justification: 'New crew lead for the night shift line; start date locked.',
    details: {
      full_name: 'Daniel Osei',
      preferred_name: 'Dan',
      job_title: 'Production Supervisor',
      department: 'Production',
      employment_type: 'full_time',
      office_location: 'Plant A',
      employee_number: 'E10422',
      badge_number: 'B2208',
      personal_email: 'daniel.osei@example.com',
      phone: '555-0173',
      start_date: '2026-06-22',
      manager_email: 'demo.manager@acme.demo',
      needs_moc: true,
      hr_notes: 'All HR fields complete. Ready for IT provisioning + final close.',
    },
  },
  {
    status: 'completed',
    urgency: 'low',
    title: 'New hire — HR Generalist',
    justification: 'Backfill on the HR team; fully onboarded.',
    details: {
      full_name: 'Sofia Marchetti',
      preferred_name: 'Sofia',
      job_title: 'HR Generalist',
      department: 'Human Resources',
      employment_type: 'full_time',
      office_location: 'HQ',
      employee_number: 'E10410',
      badge_number: 'B2190',
      work_email: 'smarchetti@acme.demo',
      personal_email: 'sofia.marchetti@example.com',
      phone: '555-0108',
      start_date: '2026-05-19',
      manager_email: 'demo.hr@acme.demo',
      hr_notes: 'Provisioned and synced to the directory. Welcome packet sent.',
    },
  },
];

export async function seed(knex: Knex): Promise<void> {
  const userCount = await knex('users').count<{ count: string }[]>('id as count');
  if (Number(userCount[0]?.count ?? 0) > 0) {
    console.log('[onboarding seed] users table not empty, skipping demo seed');
    return;
  }

  // Departments
  const deptRows = await knex('departments')
    .insert(DEPARTMENTS.map((name) => ({ name })))
    .returning(['id', 'name']);
  const deptIdByName = new Map<string, number>(deptRows.map((d: any) => [d.name, d.id]));

  // Users — all demo users are test users (password login is gated off; entry
  // is via portal SSO or the /test-login sandbox).
  const hash = await bcrypt.hash('demo', 10);
  const userRows = await knex('users')
    .insert(
      DEMO_USERS.map((u) => ({
        email: u.email,
        name: u.name,
        role: u.role,
        password_hash: hash,
        is_active: true,
        is_test: true,
        department_id: deptIdByName.get(u.dept) ?? null,
      }))
    )
    .returning(['id', 'email']);
  const userIdByEmail = new Map<string, number>(userRows.map((r: any) => [r.email, r.id]));

  // Employee reports to the manager.
  const managerId = userIdByEmail.get('demo.manager@acme.demo');
  if (managerId) {
    await knex('users')
      .where({ email: 'demo.employee@acme.demo' })
      .update({ manager_id: managerId });
  }

  // Onboarding category id (seeded by migration 002).
  const onboardingCat = await knex('ticket_categories').where({ name: 'Onboarding' }).first();

  // In-flight onboarding cases. Requisitions are raised by the manager (v2
  // manager-first flow); the HR-team-owned one is raised by HR.
  let n = 1001;
  for (const c of CASES) {
    const isHrOwned = (c.details.department as string) === 'Human Resources';
    const requesterId = isHrOwned ? userIdByEmail.get('demo.hr@acme.demo') : managerId;
    if (!requesterId) continue;
    await knex('tickets').insert({
      request_number: `ONB-${n++}`,
      requester_id: requesterId,
      request_type: 'onboarding',
      status: c.status,
      urgency: c.urgency,
      title: c.title,
      justification: c.justification,
      manager_id: managerId ?? null,
      category_id: onboardingCat?.id ?? null,
      flow_version: 2,
      onboarding_details: JSON.stringify(c.details),
      closed_at: c.status === 'completed' ? knex.fn.now() : null,
    });
  }

  console.log(`[onboarding seed] inserted ${DEMO_USERS.length} users + ${CASES.length} onboarding cases`);
}
