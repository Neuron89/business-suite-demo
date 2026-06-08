import type { ComplaintStatus, ComplaintType, Role, SeverityLevel } from './constants';

export interface User {
  id: number;
  email: string;
  password_hash?: string;
  name: string;
  role: Role;
  is_active: boolean;
  refresh_token?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Complaint {
  id: number;
  complaint_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  product_name: string;
  lot_number: string | null;
  complaint_type: ComplaintType;
  severity: SeverityLevel;
  status: ComplaintStatus;
  title: string;
  description: string;
  resolution: string | null;
  resolution_date: string | null;
  created_by: number;
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  created_by_name?: string;
  assigned_to_name?: string;
  comments?: ComplaintComment[];
  attachments?: Attachment[];
}

export interface ComplaintComment {
  id: number;
  complaint_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  // Joined
  user_name?: string;
  user_role?: Role;
}

export interface Attachment {
  id: number;
  complaint_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_by: number;
  created_at: string;
  // Joined
  uploaded_by_name?: string;
}

export interface AuditEntry {
  id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  // Joined
  user_name?: string;
}

export interface DashboardStats {
  total_complaints: number;
  open_complaints: number;
  under_review: number;
  resolved: number;
  closed_this_month: number;
  by_status: { status: string; count: number }[];
  by_type: { type: string; count: number }[];
  by_severity: { severity: string; count: number }[];
  recent_complaints: Complaint[];
  my_complaints: Complaint[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'password_hash' | 'refresh_token'>;
  tokens: AuthTokens;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
