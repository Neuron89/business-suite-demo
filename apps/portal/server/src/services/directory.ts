/**
 * Client for the Employee Tech Doc directory API.
 *
 * In production, the directory is the source of truth for who works at Acme,
 * what department they're in, etc. The portal pulls fresh data on every login.
 *
 * In DEMO_MODE the portal short-circuits the HTTP call and serves a hardcoded
 * directory of four demo users — no dependency on the Employee Directory app.
 */
import type { ModuleKey, PortalRole } from '@portal/shared';

export interface DirectoryEmployee {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  preferred_name?: string | null;
  full_name: string;
  department?: string | null;
  title?: string | null;
  account_type?: string | null;
  manager_email?: string | null;
  status?: string | null;
  company_id?: number | null;
  company_name?: string | null;
  office_location?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  extension?: string | null;
  portal_role: PortalRole;
  moc_role?: string | null;
  access: Record<ModuleKey, boolean>;
}

// ---------------------------------------------------------------- demo mode
const DEMO_MODE = process.env.DEMO_MODE === 'true';

const ALL_ACCESS: Record<ModuleKey, boolean> = {
  moc: true,
  it: true,
  it_test: true,
  qc: true,
  shipping: true,
  complaint: true,
  onboarding: true,
  iqms_chat: true,
  employee_db: true,
  sds: true,
  sharepoint: true,
  outlook: true,
} as Record<ModuleKey, boolean>;

const DEMO_USERS: DirectoryEmployee[] = [
  {
    id: 1,
    email: 'demo.it@acme.demo',
    first_name: 'Ivy',
    last_name: 'Tanaka',
    full_name: 'Ivy Tanaka',
    department: 'IT',
    title: 'IT Administrator',
    account_type: 'staff',
    manager_email: null,
    status: 'active',
    company_id: 1,
    company_name: 'Acme Industries — Plant A',
    portal_role: 'admin' as PortalRole,
    moc_role: 'super_admin',
    access: ALL_ACCESS,
  },
  {
    id: 2,
    email: 'demo.hr@acme.demo',
    first_name: 'Hana',
    last_name: 'Reyes',
    full_name: 'Hana Reyes',
    department: 'Human Resources',
    title: 'HR Lead',
    account_type: 'staff',
    manager_email: null,
    status: 'active',
    company_id: 1,
    company_name: 'Acme Industries — Plant A',
    portal_role: 'admin' as PortalRole,
    moc_role: 'originator',
    access: ALL_ACCESS,
  },
  {
    id: 3,
    email: 'demo.manager@acme.demo',
    first_name: 'Marco',
    last_name: 'Goldberg',
    full_name: 'Marco Goldberg',
    department: 'Operations',
    title: 'Plant Manager',
    account_type: 'staff',
    manager_email: null,
    status: 'active',
    company_id: 1,
    company_name: 'Acme Industries — Plant A',
    portal_role: 'user' as PortalRole,
    moc_role: 'originator',
    access: ALL_ACCESS,
  },
  {
    id: 4,
    email: 'demo.employee@acme.demo',
    first_name: 'Eli',
    last_name: 'Park',
    full_name: 'Eli Park',
    department: 'Production',
    title: 'Operator',
    account_type: 'staff',
    manager_email: 'demo.manager@acme.demo',
    status: 'active',
    company_id: 1,
    company_name: 'Acme Industries — Plant A',
    portal_role: 'user' as PortalRole,
    moc_role: 'originator',
    access: ALL_ACCESS,
  },
];

function findDemo(email: string): DirectoryEmployee | null {
  const e = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email === e) ?? null;
}

// ---------------------------------------------------------------- live api
function base(): string {
  return (process.env.DIRECTORY_BASE_URL || 'http://localhost:5065').replace(/\/$/, '');
}

function headers(): Record<string, string> {
  const token = process.env.PORTAL_SERVICE_TOKEN || '';
  if (!token) {
    throw new Error('PORTAL_SERVICE_TOKEN not configured');
  }
  return { 'X-Service-Token': token, Accept: 'application/json' };
}

// ---------------------------------------------------------------- exports
export async function lookupEmployee(email: string): Promise<DirectoryEmployee | null> {
  if (DEMO_MODE) return findDemo(email);

  const url = `${base()}/api/directory/employees/${encodeURIComponent(
    email.trim().toLowerCase()
  )}`;
  const resp = await fetch(url, { headers: headers() });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    throw new Error(`directory ${resp.status}: ${await resp.text()}`);
  }
  const json = (await resp.json()) as { employee: DirectoryEmployee };
  return json.employee;
}

export async function listEmployees(opts: { has_access?: ModuleKey } = {}): Promise<
  DirectoryEmployee[]
> {
  if (DEMO_MODE) {
    if (opts.has_access) {
      return DEMO_USERS.filter((u) => u.access[opts.has_access!]);
    }
    return DEMO_USERS;
  }

  const url = new URL(`${base()}/api/directory/employees`);
  if (opts.has_access) url.searchParams.set('has_access', opts.has_access);
  const resp = await fetch(url.toString(), { headers: headers() });
  if (!resp.ok) {
    throw new Error(`directory ${resp.status}: ${await resp.text()}`);
  }
  const json = (await resp.json()) as { employees: DirectoryEmployee[] };
  return json.employees ?? [];
}

export async function patchAccess(
  email: string,
  payload: { access?: Partial<Record<ModuleKey, boolean>>; portal_role?: PortalRole; moc_role?: string }
): Promise<DirectoryEmployee> {
  if (DEMO_MODE) {
    const existing = findDemo(email);
    if (!existing) throw new Error(`demo: unknown user ${email}`);
    return existing; // no-op in demo
  }
  const url = `${base()}/api/directory/employees/${encodeURIComponent(
    email
  )}/access`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`directory ${resp.status}: ${await resp.text()}`);
  const json = (await resp.json()) as { employee: DirectoryEmployee };
  return json.employee;
}
