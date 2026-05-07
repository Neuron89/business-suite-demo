import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@moc/shared';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  secondary_roles?: string[];
  admin_access?: boolean;
  is_approver?: boolean;
}

/** Check if user has a given role (primary or secondary) */
export function userHasRole(user: AuthUser, role: string): boolean {
  if (user.role === role) return true;
  if (user.secondary_roles?.includes(role)) return true;
  // Super admin/admin/moc_manager or users with admin_access can act as any role
  if (isAdminUser(user)) return true;
  return false;
}

/** Check if user has admin-level permissions (super_admin, admin, moc_manager, or admin_access flag) */
export function isAdminUser(user: AuthUser): boolean {
  return ['super_admin', 'admin', 'moc_manager'].includes(user.role) || user.admin_access === true;
}

/** Check if user is a super admin */
export function isSuperAdmin(user: AuthUser): boolean {
  return user.role === 'super_admin';
}

/**
 * Owner check for an MOC. Treats both the original creator (created_by) and
 * the active transferee (transferred_to, when set) as owners. This keeps the
 * historical "Created By" intact while letting the current responsible party
 * exercise owner-level permissions.
 */
export function isMocOwner(
  moc: { created_by?: number | null; transferred_to?: number | null } | null | undefined,
  user: Pick<AuthUser, 'id'>
): boolean {
  if (!moc) return false;
  if (moc.created_by === user.id) return true;
  if (moc.transferred_to != null && moc.transferred_to === user.id) return true;
  return false;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or invalid authorization header' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }
    if (roles.length > 0) {
      // Users with admin-level access (super_admin, admin, moc_manager, or admin_access) always pass admin checks
      if (roles.includes('admin' as Role) && isAdminUser(req.user)) {
        next();
        return;
      }
      // super_admin always passes
      if (req.user.role === 'super_admin') {
        next();
        return;
      }
      const effectiveRoles = roles.includes('admin')
        ? [...new Set([...roles, 'moc_manager' as Role])]
        : roles;
      if (!effectiveRoles.includes(req.user.role)) {
        res.status(403).json({ message: 'Insufficient permissions' });
        return;
      }
    }
    next();
  };
}
