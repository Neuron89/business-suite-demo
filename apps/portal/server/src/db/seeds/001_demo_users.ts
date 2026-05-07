import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * Portal demo seed — inserts the four demo users into portal_users so that
 * /api/auth/me has something to read after a demo login. Idempotent.
 */
const DEMO_EMAILS = [
  'demo.it@acme.demo',
  'demo.hr@acme.demo',
  'demo.manager@acme.demo',
  'demo.employee@acme.demo',
];

const ANNOUNCEMENTS = [
  {
    title: 'Welcome to the Acme demo suite',
    body: 'This is a public showcase of the internal business suite. All data is fake. Click the role dropdown on the login page to switch personas.',
    severity: 'info',
  },
  {
    title: 'Q2 inventory audit kickoff Monday',
    body: 'Plant A and Plant B will run a coordinated inventory audit on Monday. Logistics team — see the shared playbook.',
    severity: 'info',
  },
  {
    title: 'Reminder: MOC reviews due by EOW',
    body: 'Three MOC requests are pending review (HE-204 swap, Solvent A spec, R-3 decom). HR + Manager: please clear your queues by Friday.',
    severity: 'warning',
  },
];

export async function seed(knex: Knex): Promise<void> {
  const hash = await bcrypt.hash('demo', 10);

  for (const email of DEMO_EMAILS) {
    const exists = await knex('portal_users').where({ email }).first();
    if (!exists) {
      await knex('portal_users').insert({
        email,
        password_hash: hash,
        is_active: true,
        must_reset: false,
      });
    }
  }

  // announcements (only if table empty — keeps seed idempotent without duplicating)
  const annCount = await knex('announcements').count<{ count: string }[]>('id as count');
  if (Number(annCount[0]?.count ?? 0) === 0) {
    for (const a of ANNOUNCEMENTS) {
      await knex('announcements').insert({
        title: a.title,
        body: a.body,
        severity: a.severity,
        author_email: 'demo.it@acme.demo',
        published_at: knex.fn.now(),
      });
    }
  }

  console.log(`[portal seed] ensured ${DEMO_EMAILS.length} demo users`);
}
