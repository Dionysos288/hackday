/* GET /api/desk/state?city=<id>: what the desk shows for one city, by role. Never cached. */
import { no, offline, ok } from '@/lib/server/http';
import { deskUser } from '@/lib/server/roles';
import { deskState } from '@/lib/server/desk';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const off = offline(); if (off) return off;
  const d = await deskUser();
  if ('error' in d) return no(d.error, d.status);
  const city = new URL(req.url).searchParams.get('city');
  return ok(await deskState(d, city), { headers: { 'Cache-Control': 'no-store' } });
}
