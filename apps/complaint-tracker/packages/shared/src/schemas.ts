import { z } from 'zod';
import { COMPLAINT_STATUSES, COMPLAINT_TYPES, ROLES, SEVERITY_LEVELS } from './constants';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// Complaint schemas
export const createComplaintSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_email: z.string().email().optional().or(z.literal('')).nullable(),
  customer_phone: z.string().optional().nullable(),
  customer_company: z.string().optional().nullable(),
  product_name: z.string().min(1, 'Product name is required'),
  lot_number: z.string().optional().nullable(),
  complaint_type: z.enum(COMPLAINT_TYPES),
  severity: z.enum(SEVERITY_LEVELS),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
});

export const updateComplaintSchema = z.object({
  customer_name: z.string().min(1).optional(),
  customer_email: z.string().email().optional().or(z.literal('')).nullable(),
  customer_phone: z.string().optional().nullable(),
  customer_company: z.string().optional().nullable(),
  product_name: z.string().min(1).optional(),
  lot_number: z.string().optional().nullable(),
  complaint_type: z.enum(COMPLAINT_TYPES).optional(),
  severity: z.enum(SEVERITY_LEVELS).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  resolution: z.string().optional().nullable(),
});

export const transitionSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES),
  comment: z.string().optional(),
});

export const commentSchema = z.object({
  comment: z.string().min(1, 'Comment is required'),
});

export const assignSchema = z.object({
  assigned_to: z.number().int().positive().nullable(),
});

export const complaintsFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(COMPLAINT_STATUSES).optional(),
  complaint_type: z.enum(COMPLAINT_TYPES).optional(),
  severity: z.enum(SEVERITY_LEVELS).optional(),
  assigned_to: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'severity', 'status', 'complaint_number']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// User schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(ROLES),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  is_active: z.boolean().optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintInput = z.infer<typeof updateComplaintSchema>;
export type TransitionInput = z.infer<typeof transitionSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
export type ComplaintsFilterInput = z.infer<typeof complaintsFilterSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
