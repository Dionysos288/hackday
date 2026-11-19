/* GET /api/city/<id>/snapshot: the city's times, its visible entries with their counts, and the vote steps for the
   chart. Cached at the edge for two seconds, then served stale while a fresh one is fetched. */
import { citySnapshot } from '@/lib/server/snapshot';
import { no, offline } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
const CACHE = 'public, max-age=0, s-maxage=2, stale-while-revalidate=30';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = offline(); if (off) return off;
  const { id } = await params;
  const snap = await citySnapshot(id);
  if (!snap) return no('No such city, or the data cannot be read right now.', 404);
  return Response.json(snap, { headers: { 'Cache-Control': CACHE } });
}
