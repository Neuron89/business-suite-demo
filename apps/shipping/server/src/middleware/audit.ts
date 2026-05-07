import { Request, Response, NextFunction } from 'express';
import db from '../db/connection';

export function logAudit(action: string, entityType: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      db('audit_log')
        .insert({
          user_id: req.user?.id || null,
          action,
          entity_type: entityType,
          entity_id: req.params.id || null,
          changes: req.method === 'GET' ? null : JSON.stringify(req.body || {}),
          ip_address: req.ip,
        })
        .catch((err) => console.error('Audit log failed:', err));
    });
    next();
  };
}
