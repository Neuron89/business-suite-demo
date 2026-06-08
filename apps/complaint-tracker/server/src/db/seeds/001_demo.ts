import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * Complaint Tracker demo seed — 4 standard demo users + a batch of realistic
 * fake manufacturing/quality complaints in varied states.
 *
 * Idempotent: only seeds when the users table is empty, so re-running on an
 * existing demo database is a no-op (mirrors apps/it-request/.../001_demo.ts).
 *
 * Role mapping (this app's roles are admin | operations | qc):
 *   IT + HR  -> admin       (full access)
 *   Manager  -> operations
 *   Employee -> operations
 */
const DEMO_USERS = [
  { email: 'demo.it@acme.demo',       name: 'Ivy Tanaka',     role: 'admin'      },
  { email: 'demo.hr@acme.demo',       name: 'Hana Reyes',     role: 'admin'      },
  { email: 'demo.manager@acme.demo',  name: 'Marco Goldberg', role: 'operations' },
  { email: 'demo.employee@acme.demo', name: 'Eli Park',       role: 'operations' },
];

type DemoComplaint = {
  customer_name: string;
  customer_email?: string;
  customer_company?: string;
  product_name: string;
  lot_number?: string;
  complaint_type: 'quality' | 'delivery' | 'packaging' | 'documentation' | 'contamination' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'submitted' | 'under_review' | 'resolved' | 'closed' | 'rejected' | 'returned';
  title: string;
  description: string;
  resolution?: string;
  created_by_email: string;
  assigned_to_email?: string;
  /** days before "now" the complaint was created */
  age_days: number;
};

const COMPLAINTS: DemoComplaint[] = [
  {
    customer_name: 'Dana Whitfield',
    customer_email: 'dana.whitfield@northstar-mfg.example',
    customer_company: 'Northstar Manufacturing',
    product_name: 'Industrial Resin Pellets',
    lot_number: 'RP-2231',
    complaint_type: 'quality',
    severity: 'high',
    status: 'under_review',
    title: 'Resin pellets discolored on arrival',
    description: 'Multiple bags from lot RP-2231 contained yellow/brown discolored pellets. Color is well outside our incoming spec and is causing scrap on the extrusion line.',
    created_by_email: 'demo.employee@acme.demo',
    assigned_to_email: 'demo.manager@acme.demo',
    age_days: 4,
  },
  {
    customer_name: 'Reuben Acosta',
    customer_email: 'racosta@apexpackaging.example',
    customer_company: 'Apex Packaging Co.',
    product_name: 'Stretch Film Rolls',
    lot_number: 'SF-0098',
    complaint_type: 'delivery',
    severity: 'medium',
    status: 'submitted',
    title: 'Order arrived three days late, line idled',
    description: 'PO #44821 was promised for the 2nd but did not arrive until the 5th. Production line sat idle for half a shift waiting on film.',
    created_by_email: 'demo.manager@acme.demo',
    age_days: 1,
  },
  {
    customer_name: 'Priya Nair',
    customer_email: 'priya.nair@summitlabs.example',
    customer_company: 'Summit Labs',
    product_name: 'Reagent Grade Solvent',
    lot_number: 'RGS-5512',
    complaint_type: 'contamination',
    severity: 'critical',
    status: 'under_review',
    title: 'Particulate contamination found in solvent drum',
    description: 'Visible particulate suspended in a sealed drum from lot RGS-5512. Drum has been quarantined. Requesting urgent investigation and CoA review.',
    created_by_email: 'demo.employee@acme.demo',
    assigned_to_email: 'demo.it@acme.demo',
    age_days: 2,
  },
  {
    customer_name: 'Liam OConnor',
    customer_email: 'loconnor@harborfoods.example',
    customer_company: 'Harbor Foods',
    product_name: 'Food-Grade Lubricant',
    lot_number: 'FGL-3140',
    complaint_type: 'documentation',
    severity: 'low',
    status: 'resolved',
    title: 'Missing certificate of analysis with shipment',
    description: 'Shipment received without the CoA required for our incoming QA. Customer requested the document be emailed.',
    resolution: 'CoA for lot FGL-3140 located and emailed to customer; copy attached to the order record. Confirmed received.',
    created_by_email: 'demo.manager@acme.demo',
    assigned_to_email: 'demo.hr@acme.demo',
    age_days: 18,
  },
  {
    customer_name: 'Sofia Marchetti',
    customer_email: 'sofia.m@veltrispecialty.example',
    customer_company: 'Veltri Specialty Chemicals',
    product_name: 'Caprolactam Flake',
    lot_number: 'CPL-7720',
    complaint_type: 'quality',
    severity: 'high',
    status: 'closed',
    title: 'Moisture content above spec',
    description: 'Incoming test showed moisture at 0.18% against a 0.10% max spec. Material caused foaming in the customer melt process.',
    resolution: 'Root cause traced to a humidity excursion in the bagging area. Affected lot credited and replacement shipped from dry stock. CAPA opened on dehumidifier maintenance.',
    created_by_email: 'demo.employee@acme.demo',
    assigned_to_email: 'demo.manager@acme.demo',
    age_days: 40,
  },
  {
    customer_name: 'Grace Tan',
    customer_email: 'gtan@meridianplastics.example',
    customer_company: 'Meridian Plastics',
    product_name: 'Color Masterbatch',
    lot_number: 'CMB-1187',
    complaint_type: 'packaging',
    severity: 'medium',
    status: 'returned',
    title: 'Box crushed in transit, inner bags split',
    description: 'Outer carton arrived crushed on one corner and two inner bags had split, spilling masterbatch into the box. Photos provided by customer.',
    created_by_email: 'demo.manager@acme.demo',
    assigned_to_email: 'demo.it@acme.demo',
    age_days: 9,
  },
  {
    customer_name: 'Marcus Webb',
    customer_email: 'mwebb@cascadecoatings.example',
    customer_company: 'Cascade Coatings',
    product_name: 'Titanium Dioxide Powder',
    lot_number: 'TDP-4402',
    complaint_type: 'quality',
    severity: 'medium',
    status: 'under_review',
    title: 'Inconsistent opacity between bags',
    description: 'Opacity readings vary noticeably bag-to-bag within lot TDP-4402. Customer is seeing color drift in finished paint batches.',
    created_by_email: 'demo.employee@acme.demo',
    assigned_to_email: 'demo.manager@acme.demo',
    age_days: 6,
  },
  {
    customer_name: 'Helena Ford',
    customer_email: 'hford@brightlinemedical.example',
    customer_company: 'Brightline Medical',
    product_name: 'Medical Grade Tubing',
    lot_number: 'MGT-2050',
    complaint_type: 'delivery',
    severity: 'low',
    status: 'rejected',
    title: 'Claimed short shipment on tubing order',
    description: 'Customer reported receiving 18 of 20 cases. Investigation requested.',
    resolution: 'Carrier POD and warehouse scan logs confirm all 20 cases shipped and were signed for. Two cases located on customer dock. Claim rejected with documentation.',
    created_by_email: 'demo.manager@acme.demo',
    assigned_to_email: 'demo.hr@acme.demo',
    age_days: 25,
  },
  {
    customer_name: 'Theo Nguyen',
    customer_email: 'theo.nguyen@orbitalcomposites.example',
    customer_company: 'Orbital Composites',
    product_name: 'Carbon Fiber Tow',
    lot_number: 'CFT-6611',
    complaint_type: 'quality',
    severity: 'critical',
    status: 'submitted',
    title: 'Fiber breakage during unspooling',
    description: 'Repeated tow breakage during unspooling on lot CFT-6611, halting layup. Suspect sizing or winding tension issue. Requesting immediate hold on remaining inventory.',
    created_by_email: 'demo.employee@acme.demo',
    age_days: 0,
  },
  {
    customer_name: 'Aisha Bello',
    customer_email: 'abello@pinnacleadhesives.example',
    customer_company: 'Pinnacle Adhesives',
    product_name: 'Epoxy Hardener',
    lot_number: 'EH-9034',
    complaint_type: 'other',
    severity: 'low',
    status: 'closed',
    title: 'Label language did not match destination',
    description: 'Hazard labels were in English only; customer site requires bilingual labeling per their import requirements.',
    resolution: 'Bilingual labels provided and shipping templates updated for this customer. Closed with no material impact.',
    created_by_email: 'demo.manager@acme.demo',
    assigned_to_email: 'demo.it@acme.demo',
    age_days: 33,
  },
  {
    customer_name: 'Quinn Alvarez',
    customer_email: 'qalvarez@delta-extrusion.example',
    customer_company: 'Delta Extrusion',
    product_name: 'HDPE Compound',
    lot_number: 'HDPE-2299',
    complaint_type: 'contamination',
    severity: 'high',
    status: 'resolved',
    title: 'Foreign metal fragments detected',
    description: 'Metal detector on the customer line flagged HDPE-2299. Small metal fragments confirmed on screen inspection.',
    resolution: 'Traced to a worn screen pack on our compounding line; screen replaced and magnet inspection added to the line checklist. Affected lot recalled and credited.',
    created_by_email: 'demo.employee@acme.demo',
    assigned_to_email: 'demo.manager@acme.demo',
    age_days: 14,
  },
];

export async function seed(knex: Knex): Promise<void> {
  const userCount = await knex('users').count<{ count: string }[]>('id as count');
  if (Number(userCount[0]?.count ?? 0) > 0) {
    console.log('[complaint seed] users table not empty, skipping demo seed');
    return;
  }

  const hash = await bcrypt.hash('demo', 10);

  const userRows = await knex('users')
    .insert(
      DEMO_USERS.map((u) => ({
        email: u.email,
        name: u.name,
        role: u.role,
        password_hash: hash,
        is_active: true,
      }))
    )
    .returning(['id', 'email']);

  const userIdByEmail = new Map<string, number>(userRows.map((r: any) => [r.email, r.id]));

  const year = new Date().getFullYear();
  let seq = 1;
  for (const c of COMPLAINTS) {
    const createdBy = userIdByEmail.get(c.created_by_email);
    if (!createdBy) continue;
    const assignedTo = c.assigned_to_email ? userIdByEmail.get(c.assigned_to_email) ?? null : null;

    const createdAt = new Date(Date.now() - c.age_days * 24 * 60 * 60 * 1000);
    const isClosed = c.status === 'resolved' || c.status === 'closed';
    const resolutionDate = isClosed
      ? new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000)
      : null;

    await knex('complaints').insert({
      complaint_number: `CC-${year}-${String(seq++).padStart(3, '0')}`,
      customer_name: c.customer_name,
      customer_email: c.customer_email ?? null,
      customer_company: c.customer_company ?? null,
      product_name: c.product_name,
      lot_number: c.lot_number ?? null,
      complaint_type: c.complaint_type,
      severity: c.severity,
      status: c.status,
      title: c.title,
      description: c.description,
      resolution: c.resolution ?? null,
      resolution_date: resolutionDate,
      created_by: createdBy,
      assigned_to: assignedTo,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  // Keep the complaint_number sequence ahead of the seeded rows so the first
  // app-created complaint doesn't collide with a seeded CC-YYYY-00N number.
  await knex.raw('SELECT setval(?, ?, true)', ['complaint_number_seq', COMPLAINTS.length]);

  console.log(`[complaint seed] inserted ${DEMO_USERS.length} users + ${COMPLAINTS.length} complaints`);
}
