import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * IT Request demo seed — 4 demo users + 5 tickets in different states.
 * Idempotent: only inserts when the users table is empty.
 */
const DEMO_USERS = [
  { email: 'demo.it@acme.demo',       name: 'Ivy Tanaka',     role: 'it_admin' },
  { email: 'demo.hr@acme.demo',       name: 'Hana Reyes',     role: 'hr'       },
  { email: 'demo.manager@acme.demo',  name: 'Marco Goldberg', role: 'manager'  },
  { email: 'demo.employee@acme.demo', name: 'Eli Park',       role: 'employee' },
];

const TICKETS = [
  {
    title: 'New laptop for sales onboard',
    type: 'hardware',
    status: 'submitted',
    urgency: 'medium',
    requester_email: 'demo.manager@acme.demo',
    justification: 'New sales hire starts Monday — needs a standard ThinkPad image with the CRM client preloaded.',
    category: 'Hardware',
  },
  {
    title: 'Reset Salesforce password',
    type: 'permission',
    status: 'completed',
    urgency: 'low',
    requester_email: 'demo.employee@acme.demo',
    justification: 'Locked out after vacation. Need a temporary password to log back in.',
    category: 'Account',
    assignee_email: 'demo.it@acme.demo',
  },
  {
    title: 'Install AutoCAD on workstation 12',
    type: 'software',
    status: 'in_progress',
    urgency: 'medium',
    requester_email: 'demo.employee@acme.demo',
    justification: 'Engineering needs CAD on the maintenance shop workstation for a layout review.',
    category: 'Software',
    assignee_email: 'demo.it@acme.demo',
  },
  {
    title: 'Building access for new hire',
    type: 'access',
    status: 'manager_review',
    urgency: 'high',
    requester_email: 'demo.hr@acme.demo',
    justification: 'New maintenance lead starts next week — needs badge access to Plant A and the lab.',
    category: 'Access / Permissions',
  },
  {
    title: 'Slack channel creation for project Phoenix',
    type: 'other',
    status: 'completed',
    urgency: 'low',
    requester_email: 'demo.manager@acme.demo',
    justification: 'New cross-functional project kickoff; need a private channel with the named members.',
    category: 'Other',
    assignee_email: 'demo.it@acme.demo',
  },
];

export async function seed(knex: Knex): Promise<void> {
  const userCount = await knex('users').count<{ count: string }[]>('id as count');
  if (Number(userCount[0]?.count ?? 0) > 0) {
    console.log('[it-request seed] users table not empty, skipping demo seed');
    return;
  }

  const hash = await bcrypt.hash('demo', 10);

  // Departments
  const [itDept] = await knex('departments').insert({ name: 'Information Technology' }).returning('id');
  const [hrDept] = await knex('departments').insert({ name: 'Human Resources' }).returning('id');
  const [opsDept] = await knex('departments').insert({ name: 'Operations' }).returning('id');
  const [prodDept] = await knex('departments').insert({ name: 'Production' }).returning('id');

  const deptByEmail: Record<string, number> = {
    'demo.it@acme.demo':       (itDept as any).id ?? itDept,
    'demo.hr@acme.demo':       (hrDept as any).id ?? hrDept,
    'demo.manager@acme.demo':  (opsDept as any).id ?? opsDept,
    'demo.employee@acme.demo': (prodDept as any).id ?? prodDept,
  };

  // Users (manager_id = demo.manager for everyone except IT and Manager themselves)
  const userRows = await knex('users')
    .insert(
      DEMO_USERS.map((u) => ({
        email: u.email,
        name: u.name,
        role: u.role,
        password_hash: hash,
        is_active: true,
        department_id: deptByEmail[u.email],
      }))
    )
    .returning(['id', 'email']);

  const userIdByEmail = new Map(userRows.map((r: any) => [r.email, r.id]));

  // Set manager_id for the employee
  const managerId = userIdByEmail.get('demo.manager@acme.demo');
  if (managerId) {
    await knex('users').where({ email: 'demo.employee@acme.demo' }).update({ manager_id: managerId });
  }

  // Resolve category ids by name
  const categories = await knex('ticket_categories').select('id', 'name');
  const catIdByName = new Map<string, number>(categories.map((c: any) => [c.name, c.id]));

  // Insert tickets
  let n = 1001;
  for (const t of TICKETS) {
    const requesterId = userIdByEmail.get(t.requester_email);
    if (!requesterId) continue;
    await knex('tickets').insert({
      request_number: `IT-${n++}`,
      requester_id: requesterId,
      request_type: t.type,
      status: t.status,
      urgency: t.urgency,
      title: t.title,
      justification: t.justification,
      assignee_id: t.assignee_email ? userIdByEmail.get(t.assignee_email) : null,
      category_id: catIdByName.get(t.category),
      closed_at: t.status === 'completed' ? knex.fn.now() : null,
    });
  }

  console.log(`[it-request seed] inserted ${DEMO_USERS.length} users + ${TICKETS.length} tickets`);
}
