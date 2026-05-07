import { Request } from 'express';
import db from '../db/connection';

export async function logAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId: number,
  changes: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db('audit_log').insert({
      user_id: req.user?.id || 0,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changes: JSON.stringify(changes),
      ip_address: req.ip || req.socket.remoteAddress || '',
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
