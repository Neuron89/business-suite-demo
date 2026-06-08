/**
 * Client for the Employee Tech Doc directory API.
 *
 * Used at the very end of the onboarding workflow: when IT marks the ticket
 * "completed", we POST the new employee to the directory so they show up in
 * the org-wide phone book, the portal access matrix, and downstream syncs.
 *
 * Failure here is logged but doesn't block the ticket completion — the
 * directory can be re-synced manually from the ticket detail page if needed.
 */
import db from '../db/connection';

// Read env lazily — ESM hoists imports above dotenv.config() in index.ts, so
// module-level reads of process.env capture undefined and fall back to ''.
function directoryBase(): string {
  return (process.env.DIRECTORY_BASE_URL || 'http://localhost:5065').replace(/\/$/, '');
}
function serviceToken(): string {
  return process.env.DIRECTORY_SERVICE_TOKEN || process.env.PORTAL_SERVICE_TOKEN || '';
}

/**
 * Ensure a manager-added job title exists in the ETD canonical catalog.
 * Called from the HR-accept (hr-fill) step. Best-effort: the caller logs
 * and swallows failures so a catalog hiccup never blocks the ticket.
 */
export async function persistNewRole(label: string, department?: string): Promise<void> {
  const base = directoryBase();
  // Best-effort + demo-safe: a slow/unreachable directory must never bubble up
  // and block the onboarding step. Swallow everything (timeout, network, non-2xx)
  // and just log — the catalog can be re-synced later.
  try {
    const resp = await fetch(`${base}/api/lookups/job-titles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, department }),
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) {
      console.warn(`[role-persist] directory returned ${resp.status} for "${label}" — skipping`);
      return;
    }
    console.log(`[role-persist] ensured catalog role "${label}" (${department || 'no dept'})`);
  } catch (err: any) {
    console.warn(`[role-persist] directory unreachable for "${label}":`, err?.message || err);
  }
}

interface OnboardingTicket {
  id: number;
  request_number?: string | null;
  status?: string | null;
  request_type?: string | null;
  manager_id?: number | null;
  onboarding_details?: any;
}

/** Map manager-resolved access flags (Z M365/VPN/etc) into directory access keys.
 *  The directory's per-system access flags are: moc, it, qc, sds, complaint,
 *  iqms_chat, employee_db, shipping, it_test. The manager phase doesn't yet
 *  collect these directly — we infer a sensible default set when the
 *  shipping/etc booleans are unset. Expand as the manager form evolves. */
function deriveAccessFlags(details: any): Record<string, boolean> {
  const access: Record<string, boolean> = {};
  // For now, derive from explicit manager checkboxes if present, otherwise
  // leave the access map empty so existing flags don't get clobbered.
  if (details?.needs_moc === true) access.moc = true;
  if (details?.needs_qc === true) access.qc = true;
  if (details?.needs_sds === true) access.sds = true;
  if (details?.needs_complaint === true) access.complaint = true;
  if (details?.needs_shipping === true) access.shipping = true;
  if (details?.needs_iqms_chat === true) access.iqms_chat = true;
  return access;
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/** Derive the work email from the manager's email_alias_preference if set,
 *  otherwise apply NYCOA's first-initial + lastname convention. Returns null
 *  if we can't construct anything. */
function deriveWorkEmail(details: any): string | null {
  const pref = (details?.email_alias_preference || '').toString().trim().toLowerCase();
  if (pref && pref.includes('@')) return pref;
  const full = (details?.full_name || details?.name || '').toString();
  const { first, last } = splitName(full);
  if (!first && !last) return null;
  // firstinitial+lastname when both present; fall back to the single name given.
  const base = first && last ? `${first[0]}${last.replace(/\s+/g, '')}` : (first || last);
  const local = base.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!local) return null;
  return `${local}@nycoa.com`;
}

/**
 * Fetch the ETD onboarding welcome-packet HTML for this ticket's new hire.
 * Best-effort: returns { ok:false, reason } on any problem so the caller can
 * log and move on. Requires the employee to already exist in ETD (the
 * directory sync at it-close creates them first).
 */
export async function fetchWelcomePacket(ticket: { onboarding_details?: any }): Promise<{ ok: boolean; html?: string; reason?: string }> {
  const token = serviceToken();
  if (!token) return { ok: false, reason: 'service token not configured' };
  const details = typeof ticket.onboarding_details === 'string'
    ? JSON.parse(ticket.onboarding_details)
    : (ticket.onboarding_details || {});
  const email = details.work_email || deriveWorkEmail(details) || details.email;
  if (!email) return { ok: false, reason: 'cannot derive employee email' };
  try {
    const resp = await fetch(`${directoryBase()}/api/directory/employees/${encodeURIComponent(email)}/welcome-packet`, {
      headers: { 'X-Service-Token': token },
    });
    if (!resp.ok) return { ok: false, reason: `ETD returned ${resp.status}` };
    const data = await resp.json() as { html?: string };
    return { ok: true, html: data.html };
  } catch (err: any) {
    return { ok: false, reason: `network: ${err?.message || err}` };
  }
}

/**
 * Fetch the ETD welcome packet as a print-ready PDF (Buffer) for this hire.
 * Best-effort, same email-derivation as fetchWelcomePacket.
 */
export async function fetchWelcomePacketPdf(ticket: { onboarding_details?: any }): Promise<{ ok: boolean; pdf?: Buffer; reason?: string }> {
  const token = serviceToken();
  if (!token) return { ok: false, reason: 'service token not configured' };
  const details = typeof ticket.onboarding_details === 'string'
    ? JSON.parse(ticket.onboarding_details)
    : (ticket.onboarding_details || {});
  const email = details.work_email || deriveWorkEmail(details) || details.email;
  if (!email) return { ok: false, reason: 'cannot derive employee email' };
  try {
    const resp = await fetch(`${directoryBase()}/api/directory/employees/${encodeURIComponent(email)}/welcome-packet.pdf`, {
      headers: { 'X-Service-Token': token },
    });
    if (!resp.ok) return { ok: false, reason: `ETD returned ${resp.status}` };
    const buf = Buffer.from(await resp.arrayBuffer());
    return { ok: true, pdf: buf };
  } catch (err: any) {
    return { ok: false, reason: `network: ${err?.message || err}` };
  }
}

export async function syncEmployeeToDirectory(ticket: OnboardingTicket): Promise<{ ok: boolean; reason?: string }> {
  const token = serviceToken();
  if (!token) {
    console.warn('[directory] DIRECTORY_SERVICE_TOKEN / PORTAL_SERVICE_TOKEN not set — skipping sync');
    return { ok: false, reason: 'service token not configured' };
  }

  const details = typeof ticket.onboarding_details === 'string'
    ? JSON.parse(ticket.onboarding_details)
    : (ticket.onboarding_details || {});

  // v2 flow: onboarding_details holds BOTH the manager intake and HR fill.
  // Work email is derived (not user-entered), since the manager doesn't know
  // it at intake time. v1 fallback: trust whatever HR typed.
  const email = String(
    details.work_email
    || deriveWorkEmail(details)
    || details.personal_email
    || details.email
    || ''
  ).toLowerCase().trim();
  const fullName = String(details.full_name || details.name || '').trim();
  if (!email) return { ok: false, reason: 'employee email missing/un-derivable on ticket' };
  if (!fullName) return { ok: false, reason: 'employee full name missing on ticket' };

  const { first, last } = splitName(fullName);
  const payload: Record<string, unknown> = {
    email,
    first_name: first,
    last_name: last,
    preferred_name: details.preferred_name || null,
    department: details.department || null,
    // v2 captures these at manager intake / HR fill; ETD just got the columns.
    employee_number: details.employee_number || null,
    title: details.job_title || details.title || null,
    // start_date is HR's confirmed date; target_start_date is the manager's
    // requested date (used as a fallback if HR forgot to override).
    start_date: details.start_date || details.target_start_date || null,
    manager_email: details.manager_email || null,
    phone: details.phone || null,
    office_location: details.office_location || null,
    notes: [details.manager_notes, details.hr_notes].filter(Boolean).join('\n\n') || null,
    account_type: 'domain',
    status: 'active',
    access: deriveAccessFlags(details),
    // Triggers ETD's ONBOARD_DEFAULTS provisioning job → M365 / AD / UniFi /
    // distribution-list pipeline. Errors there log but don't fail the ticket
    // close (ETD has retry buttons on the provisioning_jobs admin page).
    provision: true,
  };

  let resp: Response;
  try {
    resp = await fetch(`${directoryBase()}/api/directory/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': token,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err: any) {
    console.error('[directory] POST failed:', err?.message || err);
    return { ok: false, reason: `network: ${err?.message || err}` };
  }

  if (!resp.ok) {
    let body = '';
    try { body = await resp.text(); } catch { /* ignore */ }
    console.error(`[directory] POST ${resp.status} from ${directoryBase()}: ${body.slice(0, 300)}`);
    return { ok: false, reason: `directory ${resp.status}` };
  }

  // Log the sync attempt to ticket history so it's auditable from the UI.
  await db('ticket_history').insert({
    ticket_id: ticket.id,
    from_status: ticket.status || null,
    to_status: ticket.status || null,
    changed_by: null,
    comment: `Synced employee to directory (${email}).`,
  });

  return { ok: true };
}
