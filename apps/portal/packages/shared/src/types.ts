import type { ModuleKey, PortalRole, TaskSeverity } from './constants';

/**
 * The portal's view of an employee, hydrated by mixing the directory record
 * (Employee Tech Doc) with the local portal_users row (login state).
 */
export interface PortalEmployee {
  email: string;
  full_name: string;
  preferred_name?: string | null;
  department?: string | null;
  title?: string | null;
  manager_email?: string | null;
  company_name?: string | null;
  portal_role: PortalRole;
  /** Map of `<module key>` → has-access boolean. */
  access: Record<ModuleKey, boolean>;
  must_reset: boolean;
}

export interface AuthLoginResponse {
  token: string;
  employee: PortalEmployee;
}

/**
 * Aggregated work item shown in the "My Tasks" list on the home page.
 * Items come from each downstream system; the portal does not own the
 * source-of-truth — clicking opens the originating system.
 */
export interface PortalTask {
  id: string;
  module: ModuleKey;
  title: string;
  url: string;
  due_date?: string | null;
  status?: string | null;
  severity: TaskSeverity;
  /** Optional secondary line on the task card. */
  subtitle?: string | null;
}

export interface PortalAlert {
  id: string;
  module: ModuleKey;
  message: string;
  severity: TaskSeverity;
  url?: string | null;
}

export interface ModuleTile {
  key: ModuleKey;
  label: string;
  description: string;
  color: string;
  glyph: string;
  url: string;
  /** Number of open tasks the portal currently knows about for this user. */
  open_task_count: number;
  /**
   * If true, the tile is an external link (SharePoint, Outlook) and should
   * open `url` directly. If false, the tile click goes through the portal
   * SSO bridge to log the user in to the downstream app.
   */
  external: boolean;
}

export interface HomeFeed {
  greeting: string;
  tiles: ModuleTile[];
  tasks: PortalTask[];
  alerts: PortalAlert[];
  last_refreshed: string;
  is_admin: boolean;
}

export interface AdminOnboardingItem {
  ticket_id: number;
  request_number: string;
  full_name: string;
  start_date: string | null;
  manager_name: string | null;
  status: string;
  url: string;
}
