import { HomePage } from '@/components/home/home-page';
import type { Query } from '@/lib/clock';
import { pageMeta } from '@/lib/meta';

export const metadata = pageMeta(
  'Supabase Hackathon: ten cities, one day',
  'Ten cities, east to west on one day. Each builds for 90 minutes and votes from the start until 30 minutes after building ends. Each city’s top project wins it, then Ant and Copple pick one of the ten.',
);

/* Dynamic: the first frame is drawn at the moment the URL asks for (?moment=, ?t=), or at the real time of the
   request, so the page arrives finished instead of filling in after load. */
function requestTime() { return Date.now(); }

export default async function Home({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  return (
    <>
      <HomePage q={q} nowMs={requestTime()} />
      <noscript><p className="noscript">The timetable needs JavaScript to follow the clock. Supabase Hackathon runs in ten cities on Dec 11, 2026.</p></noscript>
    </>
  );
}
