# Shipping Command

Freight-cost and shipping operations dashboard that replaces a hand-maintained
freight spreadsheet. Part of the
[Acme Industries Business Suite demo](../../README.md).

## What it does

- **Shipments**: daily shipment list with carrier, mode, weight and freight cost.
- **Rate book**: carriers, lanes and effective dates drive default costs on new shipments.
- **Fuel surcharge (FSC)**: weekly surcharge table.
- **Routing**: distance and drive time from the plant and the overflow warehouse to each ship-to, cached.
- **Dashboards**: cost by customer, state and carrier, cost per pound, monthly rollups.
- **Inventory**: snapshot split between the main plant and the overflow warehouse.

In production a nightly job pulls shipments, bills of lading, freight and
inventory from the ERP's Oracle database (read-only). In the demo that sync is
not run; the app reads the seeded `shipments` and related tables instead. The
sync code is kept in `server/src/services/iqms-sync.ts` for reference.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (port 3030) |
| Backend | Express 4 + TypeScript (port 4030) |
| Database | PostgreSQL (`shipping_db`) with Knex migrations |
| ERP source | Oracle via `oracledb`, read-only (production only) |

## Running

Built and started by the suite's `docker-compose.yml`. To run it on its own:

```bash
npm install
createdb shipping_db
npm run migrate
npm run seed
npm run dev
```

## Access

Shipping Command keeps its own `users` table and accepts portal SSO tokens. In
the demo, users arrive from the portal already signed in; accounts are created
on first SSO login.
