import type { Metadata } from 'next';
import { DeskLive } from '@/components/desk/live';
import { mailDriver } from '@/lib/server/mail';
import { siteUrl } from '@/lib/server/env';
import { EVENT } from '@/lib/day-data';

export const metadata: Metadata = { title: 'Desk · ' + EVENT.name, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/* /desk: hosts, judges and super admins. ?city=<id> picks the city, ?tab= a screen. Signing in is the six-digit code. */
type Q = Record<string, string | string[] | undefined>;
export default async function DeskPage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v) ? v : null);
  return <DeskLive city={one(q.city)} tab={one(q.tab) || undefined} mail={mailDriver()} site={siteUrl()} />;
}
