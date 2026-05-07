import { z } from 'zod';
import { REQUEST_TYPES, REQUEST_STATUSES, URGENCY_LEVELS, PERMISSION_TYPES, ACCESS_LEVELS, EMPLOYMENT_TYPES, WORK_LOCATIONS } from './constants';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const hardwareSpecsSchema = z.object({
  laptop_size: z.string().optional(),
  laptop_features: z.array(z.string()).optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().min(1).default(1),
  preferred_brand: z.string().optional(),
  current_equipment: z.string().optional(),
});

export const softwareDetailsSchema = z.object({
  software_name: z.string().min(1, 'Software name is required'),
  vendor_url: z.string().url().optional().or(z.literal('')),
  version: z.string().optional(),
  license_type: z.string().optional(),
  estimated_cost: z.string().optional(),
  number_of_licenses: z.number().int().min(1).default(1),
  business_purpose: z.string().min(1, 'Business purpose is required'),
  notes: z.string().optional(),
});

export const permissionDetailsSchema = z.object({
  permission_type: z.enum(PERMISSION_TYPES),
  resource_name: z.string().min(1, 'Resource name is required'),
  resource_path: z.string().optional(),
  access_level: z.enum(ACCESS_LEVELS),
  duration: z.string().optional(),
  current_access: z.string().optional(),
  notes: z.string().optional(),
});

export const accessDetailsSchema = z.object({
  access_type: z.enum(['shared_mailbox', 'distribution_list', 'teams_channel', 'sharepoint_site', 'network_drive', 'other']),
  resource_name: z.string().min(1, 'Resource name is required'),
  resource_email: z.string().optional(),
  access_level: z.enum(ACCESS_LEVELS),
  duration: z.string().optional(),
  notes: z.string().optional(),
});

export const otherDetailsSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional(),
});

/** HR submits this — identity only. HR doesn't know IT requirements. */
export const hrOnboardingIntakeSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  preferred_name: z.string().optional(),
  employee_number: z.string().min(1, 'Employee number is required'),
  badge_number: z.string().min(1, 'Badge number is required'),
  job_title: z.string().min(1, 'Job title is required'),
  department: z.string().min(1, 'Department is required'),
  manager_email: z.string().email('Manager email is required'),
  manager_name: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  employment_type: z.enum(EMPLOYMENT_TYPES),
  work_location: z.enum(WORK_LOCATIONS),
  office_location: z.string().optional(),
  personal_email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  hr_notes: z.string().optional(),
});

/** Manager fills this in after HR creates the ticket — they actually know what the new hire needs. */
export const managerOnboardingDetailsSchema = z.object({
  needs_laptop: z.boolean().default(true),
  laptop_preference: z.enum(['14_inch', '16_inch', 'desktop', 'no_preference']).optional(),
  needs_monitor: z.boolean().default(false),
  monitor_count: z.number().int().min(0).max(4).optional(),
  needs_phone: z.boolean().default(false),
  needs_headset: z.boolean().default(false),
  other_equipment: z.string().optional(),

  email_alias_preference: z.string().optional(),
  needs_m365: z.boolean().default(true),
  needs_vpn: z.boolean().default(false),
  software_needed: z.array(z.string()).default([]),
  shared_mailboxes: z.array(z.string()).default([]),
  distribution_lists: z.array(z.string()).default([]),
  security_groups: z.array(z.string()).default([]),
  network_drives: z.array(z.string()).default([]),

  similar_to_employee_email: z.string().optional(),
  manager_notes: z.string().optional(),
});

/** Combined schema — accepts either phase's payload (used for the JSONB column). */
export const onboardingDetailsSchema = hrOnboardingIntakeSchema.merge(managerOnboardingDetailsSchema.partial());

export const createTicketSchema = z.object({
  request_type: z.enum(REQUEST_TYPES),
  urgency: z.enum(URGENCY_LEVELS),
  title: z.string().min(1, 'Title is required').max(200),
  justification: z.string().min(1, 'Justification is required'),
  category_id: z.number().int().optional(),
  due_date: z.string().optional(),
  hardware_specs: hardwareSpecsSchema.optional(),
  software_details: softwareDetailsSchema.optional(),
  permission_details: permissionDetailsSchema.optional(),
  access_details: accessDetailsSchema.optional(),
  onboarding_details: onboardingDetailsSchema.optional(),
  other_details: otherDetailsSchema.optional(),
});

/** Backwards-compat alias. */
export const createRequestSchema = createTicketSchema;

export const reviewRequestSchema = z.object({
  decision: z.enum(['approved', 'denied']),
  notes: z.string().optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  assignee_id: z.number().int().nullable().optional(),
  category_id: z.number().int().nullable().optional(),
  due_date: z.string().nullable().optional(),
  resolution_notes: z.string().optional(),
  comment: z.string().optional(),
});

export const addCommentSchema = z.object({
  comment: z.string().min(1, 'Comment cannot be empty'),
  is_internal: z.boolean().default(false),
});
