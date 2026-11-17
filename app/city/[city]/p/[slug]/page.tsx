import { notFound } from 'next/navigation';
import saved from '@/saved/day-city.config.json';
import parts from '@/saved/parts.config.json';
import { EVENT, cityById } from '@/lib/day-data';
import { ord, pluralN as plural } from '@/lib/format';
import { pageMeta } from '@/lib/meta';
import type { PartsCfg } from '@/components/board/config';
import { FormsProvider } from '@/components/forms/forms-provider';
import { DayCity, type DayCityCfg } from '@/components/day/day-city';
import { flatQuery as flat, projectOnDay } from '@/components/day/day';

/* A project's own address: its city's page, drawn with the project open over it. It is the page a shared link opens,
   so it has its own title, description and share image. */
type Q = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ city: string; slug: string }>; searchParams: Promise<Q> };

export async function generateMetadata({ params, searchParams }: Props) {
  const { city, slug } = await params, c = cityById(city);
  if (!c) return {};
  const { W, row, listed } = projectOnDay(city, decodeURIComponent(slug), flat(await searchParams), Date.now());
  if (!row) return {};
  const pitch = /[.!?…]$/.test(row.p.pitch) ? row.p.pitch : row.p.pitch + '.';
  const done = W.state === 'done', finalist = done && listed && row.rank <= EVENT.finalists;
  const where = listed && W.votesOn ? ord(row.rank) + ' in ' + c.name + ' with ' + plural(row.v, 'vote') + (finalist ? ', in the final.' : '.') : 'In ' + c.name + '.';
  return pageMeta(row.p.name + ' · ' + c.name + ' · Supabase Hackday', pitch + ' ' + where + (W.voting ? ' Anyone with the link can vote.' : ''));
}

function requestTime() { return Date.now(); }

export default async function Project({ params, searchParams }: Props) {
  const { city, slug } = await params;
  if (!cityById(city)) notFound();
  const q = flat(await searchParams), nowMs = requestTime(), s = decodeURIComponent(slug);
  if (!projectOnDay(city, s, q, nowMs).row) notFound();
  return (
    <>
      <FormsProvider><DayCity saved={saved as Partial<DayCityCfg>} parts={parts as Partial<PartsCfg>} q={q} page={{ nowMs, city, slug: s }} /></FormsProvider>
      <noscript><p className="m-0 p-8 text-lg text-ink-2">This page needs JavaScript to follow the clock and to vote.</p></noscript>
    </>
  );
}
