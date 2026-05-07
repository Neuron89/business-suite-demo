import { z } from 'zod';
import { ROLES, SHIPMENT_MODES, SHIPMENT_STATUS, SHIPMENT_CATEGORIES } from './constants';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(ROLES).default('viewer'),
});

export const updateShipmentSchema = z.object({
  pu_number: z.string().nullable().optional(),
  carrier_id: z.number().int().nullable().optional(),
  carrier_name_raw: z.string().nullable().optional(),
  rate: z.number().nullable().optional(),
  fsc_pct: z.number().nullable().optional(),
  fsc_amount: z.number().nullable().optional(),
  detention: z.number().nullable().optional(),
  dwell: z.number().nullable().optional(),
  tolls: z.number().nullable().optional(),
  other_charges: z.number().nullable().optional(),
  total_cost: z.number().nullable().optional(),
  mode: z.enum(SHIPMENT_MODES).nullable().optional(),
  category: z.enum(SHIPMENT_CATEGORIES).optional(),
  status: z.enum(SHIPMENT_STATUS).optional(),
  notes: z.string().nullable().optional(),
});

export const createShipmentSchema = z.object({
  pu_number: z.string().nullable().optional(),
  ship_date: z.string(),
  customer_name: z.string().nullable().optional(),
  customer_code: z.string().nullable().optional(),
  ship_to_state: z.string().nullable().optional(),
  ship_to_city: z.string().nullable().optional(),
  ship_to_zip: z.string().nullable().optional(),
  part_number: z.string().nullable().optional(),
  part_description: z.string().nullable().optional(),
  total_lbs: z.number().nullable().optional(),
  count: z.number().int().nullable().optional(),
  mode: z.enum(SHIPMENT_MODES).nullable().optional(),
  category: z.enum(SHIPMENT_CATEGORIES).default('customer'),
  carrier_id: z.number().int().nullable().optional(),
  carrier_name_raw: z.string().nullable().optional(),
  rate: z.number().nullable().optional(),
  fsc_pct: z.number().nullable().optional(),
  fsc_amount: z.number().nullable().optional(),
  detention: z.number().nullable().optional(),
  dwell: z.number().nullable().optional(),
  tolls: z.number().nullable().optional(),
  other_charges: z.number().nullable().optional(),
  total_cost: z.number().nullable().optional(),
  status: z.enum(SHIPMENT_STATUS).default('pending'),
  notes: z.string().nullable().optional(),
});

export const shipmentFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  from: z.string().optional(),
  to: z.string().optional(),
  customer: z.string().optional(),
  state: z.string().optional(),
  mode: z.enum(SHIPMENT_MODES).optional(),
  carrier_id: z.coerce.number().int().optional(),
  status: z.enum(SHIPMENT_STATUS).optional(),
  category: z.enum(SHIPMENT_CATEGORIES).optional(),
  q: z.string().optional(),
  date: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export const createCarrierSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  mode: z.enum(SHIPMENT_MODES),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

export const createRateBookEntrySchema = z.object({
  carrier_id: z.number().int(),
  origin_code: z.string().nullable().optional(),
  destination_state: z.string().nullable().optional(),
  destination_zip: z.string().nullable().optional(),
  mode: z.enum(SHIPMENT_MODES),
  rate: z.number(),
  rate_unit: z.enum(['flat', 'per_mile', 'per_lb', 'per_cwt']).default('flat'),
  fsc_pct: z.number().nullable().optional(),
  detention_rate: z.number().nullable().optional(),
  effective_from: z.string(),
  effective_to: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createFscWeeklySchema = z.object({
  week_start: z.string(),
  diesel_price: z.number().nullable().optional(),
  surcharge_pct: z.number().nullable().optional(),
  source: z.string().default('manual'),
});
