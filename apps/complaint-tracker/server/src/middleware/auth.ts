import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@complaint/shared';

// Read JWT_SECRET lazily on every call instead of at module load. Under tsx
// watch, ESM-style import hoisting means this module evaluates before
// `dotenv.config()` runs in index.ts, so a top-level read of process.env
// silently fell back to 'dev-secret'. Lazy read sees the loaded value.
function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'dev-secret';
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate() {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export { getJwtSecret };
