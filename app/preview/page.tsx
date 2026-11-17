import saved from '@/saved/wheel.config.json';
import { clampWheel } from '@/components/wheel/config';
import { Preview } from '@/components/preview/preview';
import { ourWheel } from '@/components/preview/facts';
import { pageMeta } from '@/lib/meta';

export const metadata = pageMeta(
  'Supabase Hackday: ten cities, one day',
  'Ten cities, east to west on 10 December 2026. Each builds for 90 minutes from 09:00 local time and votes until 30 minutes after. The top 3 in each city go to the final; one pick wins $10,000.',
);

/* The preview home, until the day. ?city= opens on a city (0 to 9), ?gl=0 draws the flat globe, ?admin shows the
   wheel's knobs. */
export default async function PreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <Preview saved={clampWheel(saved)} ours={ourWheel()} q={await searchParams} />;
}
