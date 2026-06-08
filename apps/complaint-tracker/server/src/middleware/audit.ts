import { Request } from 'express';
import db from '../db/connection';

export async function logAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId: number | null,
  changes?: Record<string, unknown>
) {
  try {
    await db('audit_log').insert({
      user_id: req.user?.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changes: changes ? JSON.stringify(changes) : null,
      ip_address: req.ip || req.socket.remoteAddress || null,
    });
  } catch (err) {
    console.error('Failed to log audit entry:', err);
  }
}
