import db from '../db/connection';
import { sendEmail } from './email';

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string,
  entityType: string,
  entityId: number
): Promise<void> {
  await db('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    entity_type: entityType,
    entity_id: entityId,
  });
}

export async function notifyRoleUsers(
  role: string,
  title: string,
  message: string,
  type: string,
  entityType: string,
  entityId: number
): Promise<void> {
  const users = await db('users').where({ role, is_active: true }).select('id', 'email');
  const inserts = users.map((u: { id: number; email: string }) => ({
    user_id: u.id,
    title,
    message,
    type,
    entity_type: entityType,
    entity_id: entityId,
  }));
  if (inserts.length > 0) {
    await db('notifications').insert(inserts);
  }
}

/**
 * Send email notifications to all active users with a given role.
 */
export async function emailRoleUsers(
  role: string,
  subject: string,
  html: string
): Promise<void> {
  const users = await db('users').where({ role, is_active: true }).select('email');
  const emails = users.map((u: { email: string }) => u.email).filter(Boolean);
  if (emails.length > 0) {
    await sendEmail(emails, subject, html);
  }
}
