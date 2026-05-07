export const ROLES = ['admin', 'shipping_head', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const SHIPMENT_MODES = ['FTL', 'LTL', 'RAIL', 'COLLECT', 'PARCEL', 'BULK', 'OTHER'] as const;
export type ShipmentMode = (typeof SHIPMENT_MODES)[number];

export const SHIPMENT_STATUS = ['pending', 'shipped', 'in_storage', 'cancelled', 'voided'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUS)[number];

export const SHIPMENT_CATEGORIES = [
  'customer',
  'sample',
  'rma',
  'inbound',
  'scrap',
  'intercompany',
  'other',
] as const;
export type ShipmentCategory = (typeof SHIPMENT_CATEGORIES)[number];

export const ACME_EPLANT_ID = 2;
export const ACME_MAIN_ADDRESS = '333 Sundial Avenue, Manchester, NH 03103';
export const LOWELL_LOCATION_ID = 29713;
export const LOWELL_ADDRESS = 'Lowell, MA';

export const WAREHOUSE_KEYS = ['acme_main', 'lowell'] as const;
export type WarehouseKey = (typeof WAREHOUSE_KEYS)[number];
