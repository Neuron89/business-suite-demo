import db from '../db/connection';
import { queryIqms } from '../db/iqms';
import { ACME_EPLANT_ID, LOWELL_LOCATION_ID } from '@shipping/shared';

// Columns we're certain of live in SHIPMENTS (verified against the Oracle
// dictionary during setup). SHIPMENT_DTL rolls up QTYSHIPPED per shipment for
// count + weight estimates. Weight-in-lbs comes from ARINVT.WEIGHT_LB per item.

interface SyncResult {
  rows_in: number;
  rows_upserted: number;
}

async function recordRun<T>(job: string, fn: () => Promise<SyncResult & T>): Promise<SyncResult & T> {
  const [run] = await db('sync_runs').insert({ job }).returning('id');
  const runId = run.id || run;
  try {
    const result = await fn();
    await db('sync_runs')
      .where({ id: runId })
      .update({
        status: 'ok',
        finished_at: db.fn.now(),
        rows_in: result.rows_in,
        rows_upserted: result.rows_upserted,
      });
    return result;
  } catch (err: any) {
    await db('sync_runs')
      .where({ id: runId })
      .update({
        status: 'error',
        finished_at: db.fn.now(),
        error_message: String(err?.message || err),
      });
    throw err;
  }
}

interface IqmsShipmentRow {
  ID: number;
  PACKSLIPNO: string | null;
  SHIP_VIA: string | null;
  SHIPDATE: Date | null;
  ARCUSTO_CUSTNO: string | null;
  ARCUSTO_COMPANY: string | null;
  SHIP_TO_STATE: string | null;
  SHIP_TO_CITY: string | null;
  SHIP_TO_ZIP: string | null;
  SHIP_TO_COUNTRY: string | null;
  BOL_ID: number | null;
  FREIGHT_ID: number | null;
  PRO_NO: string | null;
  TRACKING_NUM: string | null;
  PALLET_COUNT: number | null;
  UPS_BOXCOUNT: number | null;
  UPS_BOXWEIGHT: number | null;
  TOTAL_LBS: number | null;
  QTY_SHIPPED: number | null;
  LINE_COUNT: number | null;
  PART_NUMBER: string | null;
  PART_DESCRIPTION: string | null;
  FREIGHT_DESCRIP: string | null;
}

function classifyMode(shipVia: string | null, freight: string | null): string | null {
  const raw = `${shipVia || ''} ${freight || ''}`.toUpperCase();
  if (!raw.trim()) return null;
  if (/\b(RAIL|INTERMODAL|JB ?HUNT)\b/.test(raw)) return 'RAIL';
  if (/\b(LTL)\b/.test(raw)) return 'LTL';
  if (/\b(FTL|TRUCKLOAD|TL)\b/.test(raw)) return 'FTL';
  if (/\b(UPS|FEDEX|USPS|PARCEL)\b/.test(raw)) return 'PARCEL';
  if (/\b(BULK|TANKER|BULKMATIC|DANA)\b/.test(raw)) return 'BULK';
  if (/\b(COLLECT)\b/.test(raw)) return 'COLLECT';
  return null;
}

export async function syncShipments(daysBack = 14): Promise<SyncResult> {
  return recordRun('shipments', async () => {
    // Pull SHIPMENTS + aggregate SHIPMENT_DTL (qty, weight, item snippet) +
    // FREIGHT descrip. Archived flag excluded intentionally — head of shipping
    // wants to see everything from the window, including completed ones.
    const sql = `
      SELECT
        s.ID,
        s.PACKSLIPNO,
        s.SHIP_VIA,
        s.SHIPDATE,
        s.ARCUSTO_CUSTNO,
        s.ARCUSTO_COMPANY,
        s.SHIP_TO_STATE,
        s.SHIP_TO_CITY,
        s.SHIP_TO_ZIP,
        s.SHIP_TO_COUNTRY,
        s.BOL_ID,
        s.FREIGHT_ID,
        s.PRO_NO,
        s.TRACKING_NUM,
        s.PALLET_COUNT,
        s.UPS_BOXCOUNT,
        s.UPS_BOXWEIGHT,
        f.DESCRIP AS FREIGHT_DESCRIP,
        agg.QTY_SHIPPED,
        agg.TOTAL_LBS,
        agg.LINE_COUNT,
        agg.PART_NUMBER,
        agg.PART_DESCRIPTION
      FROM IQMS.SHIPMENTS s
      LEFT JOIN IQMS.FREIGHT f ON f.ID = s.FREIGHT_ID
      LEFT JOIN (
        SELECT
          d.SHIPMENTS_ID,
          SUM(d.QTYSHIPPED) AS QTY_SHIPPED,
          SUM(
            CASE WHEN UPPER(a.UNIT) IN ('LB','LBS','POUND','POUNDS')
                 THEN d.QTYSHIPPED
                 ELSE d.QTYSHIPPED * NVL(a.PK_WEIGHT, 0)
            END
          ) AS TOTAL_LBS,
          COUNT(*) AS LINE_COUNT,
          MIN(a.ITEMNO) KEEP (DENSE_RANK FIRST ORDER BY d.ID) AS PART_NUMBER,
          MIN(a.DESCRIP) KEEP (DENSE_RANK FIRST ORDER BY d.ID) AS PART_DESCRIPTION
        FROM IQMS.SHIPMENT_DTL d
        LEFT JOIN IQMS.ORD_DETAIL od ON od.ID = d.ORDER_DTL_ID
        LEFT JOIN IQMS.ARINVT a ON a.ID = od.ARINVT_ID
        GROUP BY d.SHIPMENTS_ID
      ) agg ON agg.SHIPMENTS_ID = s.ID
      WHERE s.EPLANT_ID = :eplant
        AND s.SHIPDATE >= TRUNC(SYSDATE) - :days
      ORDER BY s.SHIPDATE DESC, s.ID DESC
    `;

    const rows = await queryIqms<IqmsShipmentRow>(sql, {
      binds: { eplant: ACME_EPLANT_ID, days: daysBack },
      maxRows: 50000,
    });

    let upserted = 0;
    for (const r of rows) {
      const shipDate = r.SHIPDATE ? new Date(r.SHIPDATE).toISOString().slice(0, 10) : null;
      const mode = classifyMode(r.SHIP_VIA, r.FREIGHT_DESCRIP);

      // Prefer ARCUSTO_COMPANY → customer_name. SHIP_VIA or FREIGHT_DESCRIP
      // seeds carrier_name_raw so the user can match to a carrier record.
      await db('shipments')
        .insert({
          source: 'iqms',
          iqms_shipment_id: r.ID,
          iqms_bol_id: r.BOL_ID,
          pu_number: r.PRO_NO || r.TRACKING_NUM || r.PACKSLIPNO,
          ship_date: shipDate,
          customer_name: r.ARCUSTO_COMPANY,
          customer_code: r.ARCUSTO_CUSTNO,
          ship_to_state: r.SHIP_TO_STATE,
          ship_to_city: r.SHIP_TO_CITY,
          ship_to_zip: r.SHIP_TO_ZIP,
          destination_country: r.SHIP_TO_COUNTRY,
          part_number: r.PART_NUMBER,
          part_description: r.PART_DESCRIPTION,
          total_lbs: r.TOTAL_LBS ?? r.UPS_BOXWEIGHT,
          count: r.LINE_COUNT ?? r.UPS_BOXCOUNT,
          mode,
          category: 'customer',
          carrier_name_raw: r.FREIGHT_DESCRIP || r.SHIP_VIA,
          status: 'shipped',
        })
        .onConflict('iqms_shipment_id')
        .merge([
          'pu_number',
          'ship_date',
          'customer_name',
          'customer_code',
          'ship_to_state',
          'ship_to_city',
          'ship_to_zip',
          'destination_country',
          'part_number',
          'part_description',
          'total_lbs',
          'count',
          'mode',
          'carrier_name_raw',
          'updated_at',
        ]);
      upserted++;
    }

    return { rows_in: rows.length, rows_upserted: upserted };
  });
}

interface IqmsInventoryRow {
  LOCATION_ID: number;
  LOC_DESC: string;
  PART_NO: string;
  DESCRIPTION: string | null;
  QTY_ON_HAND: number;
  UOM: string | null;
}

export async function syncInventory(): Promise<SyncResult> {
  return recordRun('inventory', async () => {
    // FGMULTI is IQMS's per-lot inventory table — each row = one lot at one
    // location. LOC_ID → LOCATIONS (warehouse). ONHAND is the current qty.
    // Sum lots per (part, location) to get on-hand. EPLANT filter keeps us to
    // Acme Industries, and we flag Lowell vs main by LOC_ID (LOWELL = 29713).
    const sql = `
      SELECT
        f.LOC_ID AS LOCATION_ID,
        l.LOC_DESC,
        a.ITEMNO AS PART_NO,
        a.DESCRIP AS DESCRIPTION,
        SUM(f.ONHAND) AS QTY_ON_HAND,
        a.UNIT AS UOM
      FROM IQMS.FGMULTI f
      JOIN IQMS.LOCATIONS l ON l.ID = f.LOC_ID
      JOIN IQMS.ARINVT a ON a.ID = f.ARINVT_ID
      WHERE f.EPLANT_ID = :eplant
        AND f.ONHAND <> 0
      GROUP BY f.LOC_ID, l.LOC_DESC, a.ITEMNO, a.DESCRIP, a.UNIT
    `;

    const rows = await queryIqms<IqmsInventoryRow>(sql, {
      binds: { eplant: ACME_EPLANT_ID },
      maxRows: 200000,
    });

    const today = new Date().toISOString().slice(0, 10);
    let upserted = 0;

    for (const r of rows) {
      const warehouse = r.LOCATION_ID === LOWELL_LOCATION_ID ? 'lowell' : 'acme_main';
      await db('inventory_snapshot')
        .insert({
          snapshot_date: today,
          warehouse,
          iqms_location_id: r.LOCATION_ID,
          part_number: r.PART_NO,
          part_description: r.DESCRIPTION,
          qty_on_hand: r.QTY_ON_HAND,
          uom: r.UOM,
        })
        .onConflict(['snapshot_date', 'warehouse', 'part_number'])
        .merge(['qty_on_hand', 'part_description', 'uom', 'iqms_location_id']);
      upserted++;
    }

    return { rows_in: rows.length, rows_upserted: upserted };
  });
}

export async function runAllSyncs(): Promise<Record<string, SyncResult>> {
  const shipments = await syncShipments(14).catch((err) => {
    console.error('syncShipments failed:', err);
    return { rows_in: 0, rows_upserted: 0 };
  });
  const inventory = await syncInventory().catch((err) => {
    console.error('syncInventory failed:', err);
    return { rows_in: 0, rows_upserted: 0 };
  });
  return { shipments, inventory };
}
