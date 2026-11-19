/* GET /api/day/snapshot: the ten cities' snapshots in one answer, for the home's rows and the other cities on a city
   page. Without the vote steps (a city's own snapshot has them), so it stays small. Cached like a city's. */
import { daySnapshot } from '@/lib/server/snapshot';
import { no, offline } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
const CACHE = 'public, max-age=0, s-maxage=2, stale-while-revalidate=30';

export async function GET() {
  const off = offline(); if (off) return off;
  const snap = await daySnapshot();
  if (!snap) return no('The data cannot be read right now.', 503);
  return Response.json({ ...snap, cities: snap.cities.map((c) => ({ ...c, steps: [] })) }, { headers: { 'Cache-Control': CACHE } });
}
