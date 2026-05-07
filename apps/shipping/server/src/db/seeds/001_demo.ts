import type { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * Shipping demo seed — 4 demo users + 3 carriers + 12 shipments across last 30 days.
 * Idempotent: only inserts when the users table is empty.
 */
const DEMO_USERS = [
  { email: 'demo.it@acme.demo',       name: 'Ivy Tanaka',     role: 'admin'  },
  { email: 'demo.hr@acme.demo',       name: 'Hana Reyes',     role: 'viewer' },
  { email: 'demo.manager@acme.demo',  name: 'Marco Goldberg', role: 'admin'  },
  { email: 'demo.employee@acme.demo', name: 'Eli Park',       role: 'viewer' },
];

const CARRIERS = [
  { code: 'FEDEX', name: 'FedEx Demo Freight', mode: 'LTL' },
  { code: 'UPS',   name: 'UPS Demo',           mode: 'LTL' },
  { code: 'RL',    name: 'R+L Demo Carriers',  mode: 'LTL' },
];

interface S {
  daysAgo: number;
  customer: string;
  customerCode: string;
  city: string;
  state: string;
  zip: string;
  part: string;
  desc: string;
  lbs: number;
  count: number;
  mode: string;
  carrierCode: string;
  rate: number;
  fscPct: number;
  status: 'pending' | 'confirmed' | 'delivered';
}

const SHIPMENTS: S[] = [
  { daysAgo: 28, customer: 'Northwind Corp',      customerCode: 'NW001', city: 'Atlanta',     state: 'GA', zip: '30303', part: 'RES-A-200', desc: 'Polymer Resin A',  lbs: 24500, count: 1, mode: 'LTL', carrierCode: 'FEDEX', rate: 2300, fscPct: 12.5, status: 'delivered' },
  { daysAgo: 26, customer: 'Vandelay Plastics',   customerCode: 'VAN02', city: 'Cleveland',   state: 'OH', zip: '44114', part: 'CAT-B-12',  desc: 'Catalyst B-12',    lbs:  9800, count: 2, mode: 'LTL', carrierCode: 'RL',    rate: 1850, fscPct: 12.5, status: 'delivered' },
  { daysAgo: 23, customer: 'Globex Industries',   customerCode: 'GLX',   city: 'Houston',     state: 'TX', zip: '77002', part: 'RES-B-150', desc: 'Polymer Resin B',  lbs: 17200, count: 1, mode: 'LTL', carrierCode: 'UPS',   rate: 3070, fscPct: 13.0, status: 'delivered' },
  { daysAgo: 20, customer: 'Hooli Materials',     customerCode: 'HOOLI', city: 'Atlanta',     state: 'GA', zip: '30308', part: 'RES-A-200', desc: 'Polymer Resin A',  lbs: 12300, count: 1, mode: 'LTL', carrierCode: 'FEDEX', rate: 2110, fscPct: 12.0, status: 'delivered' },
  { daysAgo: 17, customer: 'Initech Polymers',    customerCode: 'INIT',  city: 'Boston',      state: 'MA', zip: '02110', part: 'PLT-Y-7',   desc: 'Pellet Y-7',       lbs:  8400, count: 3, mode: 'LTL', carrierCode: 'RL',    rate: 1620, fscPct: 12.5, status: 'delivered' },
  { daysAgo: 14, customer: 'Northwind Corp',      customerCode: 'NW001', city: 'Atlanta',     state: 'GA', zip: '30303', part: 'RES-A-200', desc: 'Polymer Resin A',  lbs: 22000, count: 1, mode: 'LTL', carrierCode: 'FEDEX', rate: 2200, fscPct: 12.5, status: 'delivered' },
  { daysAgo: 10, customer: 'Vandelay Plastics',   customerCode: 'VAN02', city: 'Cleveland',   state: 'OH', zip: '44114', part: 'SOL-C',     desc: 'Solvent C',        lbs:  4500, count: 5, mode: 'LTL', carrierCode: 'RL',    rate: 1450, fscPct: 12.5, status: 'delivered' },
  { daysAgo:  8, customer: 'Globex Industries',   customerCode: 'GLX',   city: 'Houston',     state: 'TX', zip: '77002', part: 'RES-B-150', desc: 'Polymer Resin B',  lbs: 14800, count: 1, mode: 'LTL', carrierCode: 'UPS',   rate: 2890, fscPct: 13.0, status: 'confirmed' },
  { daysAgo:  6, customer: 'Acme Plant B',        customerCode: 'PLANT_B',  city: 'Manchester',  state: 'NH', zip: '03103', part: 'CAT-B-12',  desc: 'Catalyst B-12',    lbs:  6200, count: 2, mode: 'LTL', carrierCode: 'FEDEX', rate:  980, fscPct: 11.0, status: 'confirmed' },
  { daysAgo:  4, customer: 'Hooli Materials',     customerCode: 'HOOLI', city: 'Atlanta',     state: 'GA', zip: '30308', part: 'RES-A-200', desc: 'Polymer Resin A',  lbs: 11900, count: 1, mode: 'LTL', carrierCode: 'FEDEX', rate: 2050, fscPct: 12.0, status: 'confirmed' },
  { daysAgo:  2, customer: 'Initech Polymers',    customerCode: 'INIT',  city: 'Boston',      state: 'MA', zip: '02110', part: 'ADD-X-04',  desc: 'Additive X-04',    lbs:  3200, count: 4, mode: 'LTL', carrierCode: 'RL',    rate: 1180, fscPct: 12.5, status: 'pending'   },
  { daysAgo:  1, customer: 'Northwind Corp',      customerCode: 'NW001', city: 'Atlanta',     state: 'GA', zip: '30303', part: 'RES-A-200', desc: 'Polymer Resin A',  lbs: 23500, count: 1, mode: 'LTL', carrierCode: 'FEDEX', rate: 2280, fscPct: 12.5, status: 'pending'   },
];

export async function seed(knex: Knex): Promise<void> {
  const userCount = await knex('users').count<{ count: string }[]>('id as count');
  if (Number(userCount[0]?.count ?? 0) > 0) {
    console.log('[shipping seed] users table not empty, skipping');
    return;
  }

  const hash = await bcrypt.hash('demo', 10);

  // Users
  await knex('users').insert(
    DEMO_USERS.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      password_hash: hash,
    }))
  );

  // Carriers
  const carrierRows = await knex('carriers')
    .insert(
      CARRIERS.map((c) => ({
        code: c.code,
        name: c.name,
        mode: c.mode,
        active: true,
      }))
    )
    .returning(['id', 'code']);
  const carrierIdByCode = new Map(carrierRows.map((r: any) => [r.code, r.id]));

  // Shipments
  const today = new Date();
  for (const s of SHIPMENTS) {
    const ship = new Date(today);
    ship.setDate(ship.getDate() - s.daysAgo);
    const fscAmount = +(s.rate * (s.fscPct / 100)).toFixed(2);
    const totalCost = +(s.rate + fscAmount).toFixed(2);
    await knex('shipments').insert({
      source: 'manual',
      ship_date: ship.toISOString().slice(0, 10),
      customer_name: s.customer,
      customer_code: s.customerCode,
      ship_to_state: s.state,
      ship_to_city: s.city,
      ship_to_zip: s.zip,
      part_number: s.part,
      part_description: s.desc,
      total_lbs: s.lbs,
      count: s.count,
      mode: s.mode,
      carrier_id: carrierIdByCode.get(s.carrierCode) ?? null,
      rate: s.rate,
      fsc_pct: s.fscPct,
      fsc_amount: fscAmount,
      total_cost: totalCost,
      cost_per_lb: +(totalCost / s.lbs).toFixed(6),
      status: s.status,
    });
  }

  console.log(`[shipping seed] inserted ${DEMO_USERS.length} users, ${CARRIERS.length} carriers, ${SHIPMENTS.length} shipments`);
}
