import db from '../db/connection';

// OSRM expects lon,lat pairs. We resolve ZIPs to coords via zippopotam.us (free,
// no key). Results are cached in routing_cache keyed by ZIP pair so the
// downstream dashboards just read, never fetch.

const OSRM_BASE = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

async function geocodeZip(zip: string): Promise<{ lat: number; lng: number } | null> {
  const clean = zip.replace(/\s+/g, '').slice(0, 5);
  if (!/^\d{5}$/.test(clean)) return null;
  const res = await fetch(`https://api.zippopotam.us/us/${clean}`);
  if (!res.ok) return null;
  const body: any = await res.json();
  const place = body?.places?.[0];
  if (!place) return null;
  return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
}

export async function getRoute(fromZip: string, toZip: string): Promise<{ miles: number | null; drive_minutes: number | null } | null> {
  const cached = await db('routing_cache').where({ from_zip: fromZip, to_zip: toZip }).first();
  if (cached && cached.miles != null) {
    return { miles: Number(cached.miles), drive_minutes: Number(cached.drive_minutes) };
  }

  const [from, to] = await Promise.all([geocodeZip(fromZip), geocodeZip(toZip)]);
  if (!from || !to) return null;

  const url = `${OSRM_BASE}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const body: any = await res.json();
  const route = body?.routes?.[0];
  if (!route) return null;

  const miles = route.distance / 1609.344;
  const drive_minutes = route.duration / 60;

  await db('routing_cache')
    .insert({ from_zip: fromZip, to_zip: toZip, miles, drive_minutes })
    .onConflict(['from_zip', 'to_zip'])
    .merge(['miles', 'drive_minutes', 'fetched_at']);

  return { miles, drive_minutes };
}
