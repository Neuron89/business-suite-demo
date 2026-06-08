/**
 * Email notifications.
 *
 * Designed to fail gracefully — if SMTP isn't configured (e.g., dev), the
 * helpers log and return without throwing so the calling route still
 * succeeds. The caller's UX shouldn't depend on email going out.
 *
 * All notification HTML is rendered through the shared branded layout in
 * ./email-template (table-based + inline styles for email-client safety).
 */
import nodemailer from 'nodemailer';
import db from '../db/connection';
import { renderEmail, EmailRow } from './email-template';

// Env is read LAZILY (inside functions). index.ts's route imports are hoisted
// above its dotenv.config(), so module-level process.env reads here would
// capture undefined — same gotcha documented in directory.ts.
function fromAddr(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'onboarding@nycoa.com';
}
function itNotify(): string {
  return process.env.IT_NOTIFY_EMAIL || 'it@nycoa.com';
}
function hiringNotify(): string {
  return process.env.HIRING_NOTIFY_EMAIL || 'hiring@nycoa.com';
}
// Test/preview mode: when EMAIL_REDIRECT_TO is set, ALL emails go only to that
// address and the real recipients are shown in a "[→ ...]" subject prefix.
// Overrides the test-ticket log-only guard so you can see the whole workflow
// in one inbox. Unset for prod.
function redirectTo(): string {
  return (process.env.EMAIL_REDIRECT_TO || '').trim();
}
function onboardingBaseUrl(): string {
  return (process.env.CLIENT_URL || 'https://onboarding.nycoa.io').replace(/\/$/, '');
}

// DEMO-safe transport. In the sanitized demo suite we never want to open a
// real SMTP connection: if DEMO_MODE is on (or SMTP host/user/pass are unset),
// return null so the helpers below log "[onboarding] DEMO — would email …"
// and no-op instead of sending. Mirrors apps/portal/server/src/services/mailer.ts.
function transporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  if (process.env.DEMO_MODE === 'true' || !host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

interface OnboardingTicket {
  id: number;
  request_number: string | null;
  title: string | null;
  status?: string | null;
  due_date?: string | null;
  onboarding_details?: any;
  requester_id?: number | null;
  manager_id?: number | null;
}

async function sendBulk(to: string[], subject: string, html: string, attachments?: any[]): Promise<void> {
  const recipients = Array.from(new Set(to.filter(Boolean).map((e) => e.toLowerCase().trim())));
  if (recipients.length === 0) return;
  // Redirect/preview mode: send only to REDIRECT_TO, with the real recipients
  // surfaced in the subject so you can validate routing from one inbox.
  let finalTo = recipients;
  let finalSubject = subject;
  const redirect = redirectTo();
  if (redirect) {
    finalSubject = `[→ ${recipients.join(', ')}] ${subject}`;
    finalTo = [redirect];
  }
  const t = transporter();
  if (!t) {
    console.warn('[onboarding] DEMO — would email', finalTo, '| subject:', finalSubject);
    return;
  }
  try {
    await t.sendMail({ from: fromAddr(), to: finalTo.join(','), subject: finalSubject, html, attachments });
    console.log('[email] sent', { subject: finalSubject, recipients: finalTo, attachments: (attachments || []).length });
  } catch (err) {
    console.error('[email] send failed:', (err as Error).message);
  }
}

function detailUrl(ticketId: number): string {
  return `${onboardingBaseUrl()}/onboarding/${ticketId}`;
}

/** Short one-line plain-text summary, used for subjects + inbox preheaders. */
function summarize(t: OnboardingTicket): string {
  const d = t.onboarding_details || {};
  const parts: string[] = [];
  const name = d.full_name || [d.first_name, d.last_name].filter(Boolean).join(' ');
  if (name) parts.push(name);
  const jobTitle = d.job_title || d.title;
  if (jobTitle) parts.push(jobTitle);
  if (d.start_date) parts.push(`starts ${d.start_date}`);
  if (d.department) parts.push(d.department);
  return parts.join(' · ') || 'New onboarding request';
}

function fmtDate(s?: string): string {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return String(s);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** Standard labeled detail rows for the email body table. */
function hireRows(ticket: OnboardingTicket): EmailRow[] {
  const d = ticket.onboarding_details || {};
  const name = d.full_name || [d.first_name, d.last_name].filter(Boolean).join(' ');
  const rows: EmailRow[] = [{ label: 'Ticket', value: ticket.request_number || `#${ticket.id}` }];
  if (name) rows.push({ label: 'New hire', value: name });
  if (d.job_title || d.title) rows.push({ label: 'Role', value: d.job_title || d.title });
  if (d.department) rows.push({ label: 'Department', value: d.department });
  if (d.employment_type) rows.push({ label: 'Employment', value: String(d.employment_type).replace(/_/g, ' ') });
  if (d.office_location) rows.push({ label: 'Location', value: d.office_location });
  if (d.start_date) rows.push({ label: 'Start date', value: fmtDate(d.start_date) });
  else if (d.target_start_date) rows.push({ label: 'Target start', value: fmtDate(d.target_start_date) });
  return rows;
}

async function coreRecipients(ticket: OnboardingTicket): Promise<string[]> {
  const out: string[] = [itNotify(), hiringNotify()];
  if (ticket.manager_id) {
    const m = await db('users').where({ id: ticket.manager_id, is_active: true }).first();
    if (m?.email) out.push(m.email);
  } else if (ticket.onboarding_details?.manager_email) {
    out.push(String(ticket.onboarding_details.manager_email));
  }
  return out;
}

// Test sandbox safety: tickets submitted by a test user log instead of sending,
// so validating the flow never emails real it@/hiring@ inboxes.
async function isTestTicket(ticket: OnboardingTicket): Promise<boolean> {
  if (!ticket.requester_id) return false;
  const u = await db('users').where({ id: ticket.requester_id }).first();
  return !!u?.is_test;
}

async function deliver(ticket: OnboardingTicket, to: string[], subject: string, html: string, attachments?: any[]): Promise<void> {
  // In redirect/preview mode, send everything (incl. test tickets) to redirectTo().
  if (!redirectTo() && await isTestTicket(ticket)) {
    console.log('[email] test ticket — not sending. Subject:', subject, '| would-be recipients:', Array.from(new Set(to.filter(Boolean))));
    return;
  }
  await sendBulk(to, subject, html, attachments);
}

/**
 * Fired when a manager submits a new hire requisition.
 * Recipients: IT_NOTIFY, HIRING_NOTIFY, and the hiring manager.
 */
export async function notifyOnboardingCreated(ticket: OnboardingTicket): Promise<void> {
  const recipients = await coreRecipients(ticket);
  const num = ticket.request_number || `#${ticket.id}`;
  const subject = `[Onboarding] ${num} — ${summarize(ticket).slice(0, 80)}`;
  const html = renderEmail({
    statusLabel: 'New requisition',
    title: 'New hire requisition submitted',
    intro: 'A hiring manager submitted a new onboarding requisition. HR can review and confirm receipt.',
    rows: hireRows(ticket),
    ctaUrl: detailUrl(ticket.id),
    ctaLabel: 'Open requisition',
    preheader: summarize(ticket),
  });
  await deliver(ticket, recipients, subject, html);
}

/**
 * v1 legacy — fired when the manager completes the equipment/access step.
 * Recipients: every active it_admin.
 */
export async function notifyManagerCompleted(ticket: OnboardingTicket): Promise<void> {
  const itAdmins = await db('users').where({ role: 'it_admin', is_active: true }).select('email');
  const recipients = itAdmins.map((u) => u.email).filter(Boolean);
  if (recipients.length === 0) return;
  const subject = `[Onboarding] Ready for IT — ${ticket.request_number || `#${ticket.id}`}`;
  const html = renderEmail({
    statusLabel: 'Ready for IT',
    title: 'Equipment & access ready for IT',
    intro: 'The manager has filled in the equipment and access requirements.',
    rows: hireRows(ticket),
    ctaUrl: detailUrl(ticket.id),
    ctaLabel: 'Open in onboarding',
  });
  await sendBulk(recipients, subject, html);
}

/**
 * Fired when IT closes/approves the ticket. Recipients: core set.
 */
export async function notifyOnboardingCompleted(ticket: OnboardingTicket): Promise<void> {
  const to = await coreRecipients(ticket);
  const subject = `[Onboarding] Completed — ${ticket.request_number || `#${ticket.id}`}`;
  const html = renderEmail({
    accent: '#16a34a',
    statusLabel: 'Completed',
    title: 'Onboarding completed',
    intro: 'This onboarding has been approved and closed by IT — accounts and credentials are provisioned.',
    rows: hireRows(ticket),
    ctaUrl: detailUrl(ticket.id),
    ctaLabel: 'View final record',
  });
  await deliver(ticket, to, subject, html);
}

/** Fired on any comment / HR note (confirmation, search update). */
export async function notifyActivity(ticket: OnboardingTicket, actorName: string, body: string, kind: string): Promise<void> {
  const to = await coreRecipients(ticket);
  const num = ticket.request_number || `#${ticket.id}`;
  const subject = `[Onboarding] New ${kind} — ${num}`;
  const html = renderEmail({
    statusLabel: 'Update',
    title: `New ${kind}`,
    intro: `<b>${actorName}</b> added a ${kind} on this onboarding.`,
    note: { label: kind, body },
    rows: hireRows(ticket),
    ctaUrl: detailUrl(ticket.id),
    ctaLabel: 'Open ticket',
  });
  await deliver(ticket, to, subject, html);
}

/** Fired when HR submits identity — prompts the hiring manager for a start date. */
export async function notifyManagerSetStartDate(ticket: OnboardingTicket): Promise<void> {
  const to = await coreRecipients(ticket);
  const num = ticket.request_number || `#${ticket.id}`;
  const subject = `[Onboarding] Set start date — ${num}`;
  const html = renderEmail({
    accent: '#f97316',
    statusLabel: 'Action needed',
    title: 'Set the confirmed start date',
    intro: 'HR has submitted the new hire&rsquo;s details. As the hiring manager, please set the confirmed start date — the ticket then goes to IT for final approval.',
    rows: hireRows(ticket),
    ctaUrl: detailUrl(ticket.id),
    ctaLabel: 'Set start date',
  });
  await deliver(ticket, to, subject, html);
}

/** Fired when the manager sets the start date — ready for IT close-out. */
export async function notifyReadyForItClose(ticket: OnboardingTicket): Promise<void> {
  const to = await coreRecipients(ticket);
  const num = ticket.request_number || `#${ticket.id}`;
  const subject = `[Onboarding] Ready for IT final approval — ${num}`;
  const html = renderEmail({
    statusLabel: 'Ready for IT',
    title: 'Ready for IT final approval',
    intro: 'The confirmed start date is set. This is ready for IT final approval and provisioning.',
    rows: hireRows(ticket),
    ctaUrl: detailUrl(ticket.id),
    ctaLabel: 'Open ticket',
  });
  await deliver(ticket, to, subject, html);
}

/** Email the new hire's welcome packet to HR + manager as a print-ready PDF attachment. */
export async function sendWelcomePacket(ticket: OnboardingTicket, pdf: Buffer): Promise<void> {
  const to: string[] = [];
  if (ticket.requester_id) {
    const hr = await db('users').where({ id: ticket.requester_id, is_active: true }).first();
    if (hr?.email) to.push(hr.email);
  }
  if (ticket.manager_id) {
    const m = await db('users').where({ id: ticket.manager_id, is_active: true }).first();
    if (m?.email) to.push(m.email);
  } else if (ticket.onboarding_details?.manager_email) {
    to.push(String(ticket.onboarding_details.manager_email));
  }
  const d = ticket.onboarding_details || {};
  const hireName = (d.full_name || [d.first_name, d.last_name].filter(Boolean).join(' ') || 'the new hire').toString();
  const fileSafe = hireName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'employee';
  const html = renderEmail({
    accent: '#16a34a',
    statusLabel: 'Welcome packet',
    title: `Welcome packet — ${hireName}`,
    intro: 'The new hire&rsquo;s welcome packet is attached as a <b>PDF</b> — open the attachment to view and print it (credentials, first sign-in, manager, systems, WiFi, and helpdesk info).',
    rows: hireRows(ticket),
  });
  await deliver(ticket, to, `[Onboarding] Welcome packet — ${hireName}`, html, [
    { filename: `welcome-packet-${fileSafe}.pdf`, content: pdf, contentType: 'application/pdf' },
  ]);
}

/** Scheduled reminder before a new hire's start date. */
export async function notifyStartReminder(ticket: OnboardingTicket, daysOut: number): Promise<void> {
  const to = await coreRecipients(ticket);
  const num = ticket.request_number || `#${ticket.id}`;
  const when = daysOut <= 0 ? 'today' : daysOut === 1 ? 'tomorrow' : `in ${daysOut} days`;
  const subject = `[Onboarding] New employee starting ${when} — ${num}`;
  const html = renderEmail({
    accent: '#0ea5e9',
    statusLabel: 'Reminder',
    title: `New employee starting ${when}`,
    intro: `Heads-up: a new employee is starting <b>${when}</b>. Make sure their equipment, accounts, and workspace are ready.`,
    rows: hireRows(ticket),
    ctaUrl: detailUrl(ticket.id),
    ctaLabel: 'Open ticket',
  });
  await deliver(ticket, to, subject, html);
}

/** IT pinged a role for info. Email the pinged role (manager → the hire's
 *  manager; hr → hiring@; ehs → ehs@). Also surfaces on their onboarding home. */
export async function notifyPing(ticket: OnboardingTicket, toRole: string, message: string, fromName: string): Promise<void> {
  const to: string[] = [];
  if (toRole === 'manager') {
    if (ticket.manager_id) {
      const m = await db('users').where({ id: ticket.manager_id, is_active: true }).first();
      if (m?.email) to.push(m.email);
    } else if (ticket.onboarding_details?.manager_email) {
      to.push(String(ticket.onboarding_details.manager_email));
    }
  } else if (toRole === 'hr') {
    to.push(hiringNotify());
  } else if (toRole === 'ehs') {
    to.push(process.env.EHS_NOTIFY_EMAIL || 'ehs@nycoa.com');
  }
  const num = ticket.request_number || `#${ticket.id}`;
  const subject = `[Onboarding] Action needed (ping) — ${num}`;
  const html = renderEmail({
    accent: '#0ea5e9',
    statusLabel: 'Action needed',
    title: `${fromName} needs your input`,
    intro: `<b>${fromName}</b> pinged <b>${toRole.toUpperCase()}</b> on this onboarding. It&rsquo;s also waiting on your onboarding home page.`,
    note: { label: 'Message', body: message },
    rows: hireRows(ticket),
    ctaUrl: detailUrl(ticket.id),
    ctaLabel: 'Open ticket',
  });
  await deliver(ticket, to, subject, html);
}
