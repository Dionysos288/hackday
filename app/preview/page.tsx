import saved from '@/saved/wheel.config.json';
import { clampWheel } from '@/components/wheel/config';
import { Preview } from '@/components/preview/preview';
import { ourWheel } from '@/components/preview/facts';
import { pageMeta } from '@/lib/meta';
import { CITY_WORD, CITY_WORD_CAP } from '@/lib/day-data';

export const metadata = pageMeta(
  `Supabase Hackday: ${CITY_WORD} cities, one day`,
  `${CITY_WORD_CAP} cities, east to west on 10 December 2026. Each builds for 90 minutes from 09:00 local time and votes until 30 minutes after. The top 3 in each city go to the final; one pick wins $10,000.`,
);

/* The preview home, until the day. ?city= opens on a city by its place in the list (from 0), ?gl=0 draws the flat globe, ?globe=glass, ascii or
   none overrides the saved globe, ?admin shows the wheel's knobs. */
export default async function PreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return <Preview saved={clampWheel({ ...saved, ...(q.globe ? { globe: q.globe } : {}) })} ours={ourWheel()} q={q} />;
}
