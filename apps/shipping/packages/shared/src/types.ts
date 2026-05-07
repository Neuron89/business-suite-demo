import type {
  Role,
  ShipmentMode,
  ShipmentStatus,
  ShipmentCategory,
  WarehouseKey,
} from './constants';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Carrier {
  id: number;
  code: string;
  name: string;
  mode: ShipmentMode;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: number;
  // Source of record
  source: 'iqms' | 'manual';
  iqms_shipment_id: number | null;
  iqms_bol_id: number | null;
  iqms_so_number: string | null;

  // Business data
  pu_number: string | null;
  ship_date: string | null;
  customer_name: string | null;
  customer_code: string | null;
  ship_to_state: string | null;
  ship_to_city: string | null;
  ship_to_zip: string | null;
  destination_country: string | null;

  // Cargo
  part_number: string | null;
  part_description: string | null;
  total_lbs: number | null;
  count: number | null;

  // Mode / carrier
  mode: ShipmentMode | null;
  category: ShipmentCategory;
  carrier_id: number | null;
  carrier_name_raw: string | null;

  // Costing
  rate: number | null;
  fsc_pct: number | null;
  fsc_amount: number | null;
  detention: number | null;
  dwell: number | null;
  tolls: number | null;
  other_charges: number | null;
  total_cost: number | null;
  cost_per_lb: number | null;

  // Status
  status: ShipmentStatus;

  // Audit
  notes: string | null;
  confirmed_by: number | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RateBookEntry {
  id: number;
  carrier_id: number;
  origin_code: string | null;
  destination_state: string | null;
  destination_zip: string | null;
  mode: ShipmentMode;
  rate: number;
  rate_unit: 'flat' | 'per_mile' | 'per_lb' | 'per_cwt';
  fsc_pct: number | null;
  detention_rate: number | null;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FscWeekly {
  id: number;
  week_start: string;
  diesel_price: number | null;
  surcharge_pct: number | null;
  source: string;
  created_at: string;
}

export interface InventorySnapshot {
  id: number;
  snapshot_date: string;
  warehouse: WarehouseKey;
  iqms_location_id: number | null;
  part_number: string;
  part_description: string | null;
  qty_on_hand: number;
  uom: string | null;
  created_at: string;
}

export interface RoutingCache {
  id: number;
  from_zip: string;
  to_zip: string;
  miles: number | null;
  drive_minutes: number | null;
  fetched_at: string;
}

export interface DashboardTodayRow {
  shipment_id: number;
  pu_number: string | null;
  customer_name: string | null;
  ship_to_state: string | null;
  carrier_name: string | null;
  mode: ShipmentMode | null;
  total_lbs: number | null;
  total_cost: number | null;
  cost_per_lb: number | null;
  status: ShipmentStatus;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
