import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import dns from 'dns';
import db from '../db/connection';
import { GLOBAL_MOC_ROLES, ALL_AREA_ROLES, ALWAYS_NOTIFY_EMAILS, type Role } from '@moc/shared';

// Force IPv4 DNS resolution — this server has no IPv6 connectivity
dns.setDefaultResultOrder('ipv4first');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const API_URL = process.env.SERVER_URL || `http://${process.env.CLIENT_URL ? new URL(process.env.CLIENT_URL).hostname : 'localhost'}:${process.env.PORT || 4000}`;

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // STARTTLS for MS365 on port 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  cc?: string | string[]
): Promise<void> {
  if (!transporter) {
    console.warn('Email not configured (SMTP_HOST missing), skipping email to:', to);
    return;
  }

  // Filter out test/local addresses that can't receive real email
  const filterReal = (addr: string) => !addr.endsWith('@localhost') && !addr.endsWith('@facility.local') && !addr.endsWith('@test.local');
  const toList = Array.isArray(to) ? to.filter(filterReal) : (filterReal(to) ? [to] : []);
  if (toList.length === 0) return;

  const recipients = toList.join(', ');
  const ccList = cc ? (Array.isArray(cc) ? cc.filter(filterReal) : (filterReal(cc) ? [cc] : [])) : [];
  const ccRecipients = ccList.length > 0 ? ccList.join(', ') : undefined;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'moc@facility.local',
      to: recipients,
      cc: ccRecipients,
      subject,
      html,
    });
    console.log(`Email sent to ${recipients}${ccRecipients ? ` (cc: ${ccRecipients})` : ''}: ${subject}`);
  } catch (err) {
    // Log but don't throw — email failure shouldn't block the workflow
    console.error('Failed to send email:', err);
  }
}

/**
 * Generate a magic link that auto-logs in a user and redirects to a MOC.
 */
export function generateMagicLink(userId: number, mocId: number): string {
  const token = jwt.sign(
    { id: userId, redirect: `/moc/${mocId}` },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  return `${API_URL}/api/auth/magic/${token}`;
}

/**
 * Send a personalized email to each active user with a given role.
 * Each user gets their own magic link.
 */
export async function emailRoleUsersWithLink(
  role: string,
  subject: string,
  buildHtml: (magicLink: string) => string
): Promise<void> {
  const users = await db('users').where({ role, is_active: true }).select('id', 'email');
  for (const user of users) {
    if (!user.email) continue;
    const magicLink = generateMagicLink(user.id, 0); // fallback, prefer mocId version
    await sendEmail(user.email, subject, buildHtml(magicLink));
  }
}

/**
 * Send a personalized email to each active user with a given role, with a link to a specific MOC.
 */
export async function emailRoleUsersForMoc(
  role: string,
  subject: string,
  mocId: number,
  buildHtml: (magicLink: string) => string,
  cc?: string | string[]
): Promise<void> {
  const users = await db('users').where({ role, is_active: true }).select('id', 'email');
  for (const user of users) {
    if (!user.email) continue;
    const magicLink = generateMagicLink(user.id, mocId);
    await sendEmail(user.email, subject, buildHtml(magicLink), cc);
  }
}

/**
 * Send a personalized email to a specific user with a link to a MOC.
 */
export async function emailUserForMoc(
  userId: number,
  subject: string,
  mocId: number,
  buildHtml: (magicLink: string) => string
): Promise<void> {
  const user = await db('users').where({ id: userId, is_active: true }).select('id', 'email').first();
  if (!user?.email) return;
  const magicLink = generateMagicLink(user.id, mocId);
  await sendEmail(user.email, subject, buildHtml(magicLink));
}

// ── Area-Aware Recipient Resolution ────────────────────────────────────

interface MocRecipient {
  id: number;
  email: string;
  name: string;
}

/**
 * Get deduplicated list of recipients for a MOC based on affected areas, departments involved,
 * global roles, and user-location assignments.
 *
 * Logic:
 * 1. Users with global roles (ehs, moc_manager) — always included
 * 2. Admin users — always included
 * 3. Users with ALL_AREA_ROLES (maintenance) — included if maintenance is in departments_involved
 * 4. Users assigned to any of the affected areas AND whose role is in departments_involved
 * 5. Deduplicate by user ID
 */
export async function getMocRecipients(mocId: number): Promise<MocRecipient[]> {
  const moc = await db('moc_requests').where('id', mocId).first();
  if (!moc) return [];

  const affectedAreas: string[] = moc.affected_areas || [];
  const deptsInvolved: string[] = moc.departments_involved || [];
  const recipientMap = new Map<number, MocRecipient>();

  // 1. Global roles — always included (ehs, moc_manager)
  const globalUsers = await db('users')
    .whereIn('role', GLOBAL_MOC_ROLES as string[])
    .where('is_active', true)
    .select('id', 'email', 'name');
  for (const u of globalUsers) {
    recipientMap.set(u.id, u);
  }

  // 2. Admin users — always included
  const admins = await db('users')
    .where({ role: 'admin', is_active: true })
    .select('id', 'email', 'name');
  for (const u of admins) {
    recipientMap.set(u.id, u);
  }

  // 3. ALL_AREA_ROLES (maintenance) — if in departments_involved
  for (const role of ALL_AREA_ROLES) {
    if (deptsInvolved.includes(role)) {
      const users = await db('users')
        .where({ role, is_active: true })
        .select('id', 'email', 'name');
      for (const u of users) {
        recipientMap.set(u.id, u);
      }
    }
  }

  // 4. Users assigned to affected areas whose role is in departments_involved
  if (affectedAreas.length > 0 && deptsInvolved.length > 0) {
    const areaUsers = await db('users')
      .join('user_locations', 'users.id', 'user_locations.user_id')
      .whereIn('user_locations.area', affectedAreas)
      .whereIn('users.role', deptsInvolved)
      .where('users.is_active', true)
      .select('users.id', 'users.email', 'users.name')
      .distinct();
    for (const u of areaUsers) {
      recipientMap.set(u.id, u);
    }
  }

  // 5. Always-notify users (Ryan Emerson, Plant Manager) — regardless of role/department
  if (ALWAYS_NOTIFY_EMAILS.length > 0) {
    const alwaysNotify = await db('users')
      .whereIn('email', ALWAYS_NOTIFY_EMAILS)
      .where('is_active', true)
      .select('id', 'email', 'name');
    for (const u of alwaysNotify) {
      recipientMap.set(u.id, u);
    }
  }

  return Array.from(recipientMap.values());
}

/**
 * Send a single MOC notification email to all recipients.
 * All recipients go in TO, creator goes in CC (if not already a recipient).
 * Uses a direct link to the MOC page instead of per-user magic links.
 */
export async function sendMocNotification(
  mocId: number,
  subject: string,
  buildHtml: (link: string) => string,
  creatorId?: number,
): Promise<void> {
  const recipients = await getMocRecipients(mocId);
  if (recipients.length === 0 && !creatorId) return;

  // Direct link to the MOC (users log in normally)
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const mocLink = `${clientUrl}/moc/${mocId}`;

  // Collect all TO addresses
  const toEmails = recipients.map((r) => r.email);

  // Get creator email for CC
  let ccEmail: string | undefined;
  if (creatorId) {
    const creator = await db('users').where({ id: creatorId, is_active: true }).select('id', 'email').first();
    if (creator?.email) {
      const creatorInRecipients = recipients.some((r) => r.id === creatorId);
      if (!creatorInRecipients) {
        ccEmail = creator.email;
      }
    }
  }

  // Send one email to everyone
  if (toEmails.length > 0) {
    await sendEmail(toEmails, subject, buildHtml(mocLink), ccEmail);
  } else if (ccEmail) {
    // Only creator — send directly to them
    await sendEmail(ccEmail, subject, buildHtml(mocLink));
  }
}

/**
 * Send a single notification to specific role users for a MOC.
 * All role users go in TO, creator goes in CC.
 * Used for targeted notifications (e.g., "EHS needs to do DSR").
 */
export async function sendRoleNotification(
  roles: string[],
  subject: string,
  mocId: number,
  buildHtml: (link: string) => string,
  creatorId?: number,
): Promise<void> {
  const recipientMap = new Map<number, { id: number; email: string }>();

  for (const role of roles) {
    const users = await db('users').where({ role, is_active: true }).select('id', 'email');
    for (const u of users) {
      if (u.email) recipientMap.set(u.id, u);
    }
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const mocLink = `${clientUrl}/moc/${mocId}`;

  const toEmails = [...recipientMap.values()].map((r) => r.email);

  let ccEmail: string | undefined;
  if (creatorId) {
    const creator = await db('users').where({ id: creatorId, is_active: true }).select('id', 'email').first();
    if (creator?.email && !recipientMap.has(creatorId)) {
      ccEmail = creator.email;
    }
  }

  if (toEmails.length > 0) {
    await sendEmail(toEmails, subject, buildHtml(mocLink), ccEmail);
  } else if (ccEmail) {
    await sendEmail(ccEmail, subject, buildHtml(mocLink));
  }
}

// ── Email Templates ─────────────────────────────────────────────────────

function emailWrapper(content: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e40af; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 18px;">Management of Change</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        ${content}
      </div>
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 16px;">
        Automated notification from the MOC system. Do not reply to this email.
      </p>
    </div>
  `;
}

function mocTable(mocId: number, mocTitle: string, description: string, extra?: Record<string, string>, mocNumber?: string): string {
  const descSnippet = description && description.length > 200 ? description.substring(0, 200) + '...' : (description || 'No description provided');
  const displayId = mocNumber || `#${mocId}`;
  let rows = `
    <tr>
      <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb; width: 130px;">MOC ID</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${displayId}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Title</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${mocTitle}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">Description</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${descSnippet}</td>
    </tr>
  `;
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      rows += `
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">${key}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${value}</td>
        </tr>
      `;
    }
  }
  return `<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">${rows}</table>`;
}

function actionButton(link: string, label: string): string {
  return `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${link}" style="background: #1e40af; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
        ${label}
      </a>
    </div>
  `;
}

export function mocSubmittedEmail(mocId: number, mocTitle: string, description: string, submittedBy: string, magicLink: string, mocNumber?: string): string {
  const id = mocNumber || `MOC #${mocId}`;
  return emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">New MOC Submitted — ${id}</h2>
    <p>A new MOC has been submitted by <strong>${submittedBy}</strong> and requires review.</p>
    ${mocTable(mocId, mocTitle, description, { 'Submitted By': submittedBy }, mocNumber)}
    ${actionButton(magicLink, 'View MOC')}
  `);
}

export function mocReviewNeededEmail(mocId: number, mocTitle: string, description: string, approvedBy: string, magicLink: string, mocNumber?: string): string {
  const id = mocNumber || `MOC #${mocId}`;
  return emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">Your Review is Needed — ${id}</h2>
    <p>An MOC has been approved by <strong>${approvedBy}</strong> and is now waiting for your review.</p>
    ${mocTable(mocId, mocTitle, description, { 'Approved By': approvedBy }, mocNumber)}
    ${actionButton(magicLink, 'Review MOC')}
  `);
}

export function mocReadyForReviewEmail(mocId: number, mocTitle: string, description: string, magicLink: string, mocNumber?: string): string {
  const id = mocNumber || `MOC #${mocId}`;
  return emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">MOC Ready for Your Review — ${id}</h2>
    <p>The following MOC has moved to review stage and needs your approval.</p>
    ${mocTable(mocId, mocTitle, description, undefined, mocNumber)}
    ${actionButton(magicLink, 'Review MOC')}
  `);
}

export function mocApprovedEmail(mocId: number, mocTitle: string, description: string, magicLink: string, mocNumber?: string): string {
  const id = mocNumber || `MOC #${mocId}`;
  return emailWrapper(`
    <h2 style="color: #059669; margin-top: 0;">MOC Approved — ${id}</h2>
    <p>Your MOC has been <strong>approved</strong> by all required reviewers.</p>
    ${mocTable(mocId, mocTitle, description, undefined, mocNumber)}
    ${actionButton(magicLink, 'View MOC')}
  `);
}

export function mocRejectedEmail(mocId: number, mocTitle: string, description: string, rejectedBy: string, comments: string, magicLink: string, mocNumber?: string): string {
  const id = mocNumber || `MOC #${mocId}`;
  return emailWrapper(`
    <h2 style="color: #dc2626; margin-top: 0;">MOC Rejected — ${id}</h2>
    <p>Your MOC has been <strong>rejected</strong> by <strong>${rejectedBy}</strong>.</p>
    ${mocTable(mocId, mocTitle, description, { 'Rejected By': rejectedBy, 'Comments': comments || 'No comments provided' }, mocNumber)}
    ${actionButton(magicLink, 'View MOC')}
  `);
}

export function mocReturnedEmail(mocId: number, mocTitle: string, description: string, returnedBy: string, comments: string, magicLink: string, mocNumber?: string): string {
  const id = mocNumber || `MOC #${mocId}`;
  return emailWrapper(`
    <h2 style="color: #d97706; margin-top: 0;">MOC Returned for Revision — ${id}</h2>
    <p>Your MOC has been <strong>returned</strong> for more information by <strong>${returnedBy}</strong>.</p>
    ${mocTable(mocId, mocTitle, description, { 'Returned By': returnedBy, 'Comments': comments || 'No comments provided' }, mocNumber)}
    ${actionButton(magicLink, 'Edit MOC')}
  `);
}

export function mocTransitionEmail(mocId: number, mocTitle: string, description: string, newStatus: string, detail: string, magicLink: string, mocNumber?: string): string {
  const id = mocNumber || `MOC #${mocId}`;
  return emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">MOC Status Update — ${id}</h2>
    <p>${detail}</p>
    ${mocTable(mocId, mocTitle, description, { 'New Status': newStatus }, mocNumber)}
    ${actionButton(magicLink, 'View MOC')}
  `);
}

// Keep simple version for non-MOC emails (feedback tickets, etc.)
export function mocStatusEmail(mocId: number, mocTitle: string, newStatus: string, detail: string): string {
  return emailWrapper(`
    <h2 style="color: #1e40af; margin-top: 0;">${newStatus === 'New' ? 'New Feedback Ticket' : 'Status Update'}</h2>
    <p>${detail}</p>
    ${mocTable(mocId, mocTitle, '', { 'Status': newStatus })}
  `);
}
