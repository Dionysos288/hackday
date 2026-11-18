import saved from '@/saved/day-home.config.json';
import parts from '@/saved/parts.config.json';
import type { PartsCfg } from '@/components/board/config';
import { DayHome, type DayHomeCfg } from '@/components/day/day-home';
import { pageMeta } from '@/lib/meta';
import { flatQuery as flat } from '@/components/day/day';
import { CITY_WORD, CITY_WORD_CAP, FINALIST_COUNT } from '@/lib/day-data';

export const metadata = pageMeta(
  `Supabase Hackday: ${CITY_WORD} cities, one day`,
  `${CITY_WORD_CAP} cities, east to west on one day. Each builds for 90 minutes, and voting runs from the start until 30 minutes after building ends. The top 3 in each city go to the final, and Ant and Copple pick one of the ${FINALIST_COUNT}.`,
);

/* Dynamic: the first frame is drawn at the real time of the request (or the moment the URL asks for: ?moment=, ?m=,
   ?t=), so the page arrives finished. ?still=1 stops the clock; ?admin shows the panel. */
function requestTime() { return Date.now(); }
type Q = Record<string, string | string[] | undefined>;

export default async function Home({ searchParams }: { searchParams: Promise<Q> }) {
  return (
    <>
      <DayHome saved={saved as Partial<DayHomeCfg>} parts={parts as Partial<PartsCfg>} q={flat(await searchParams)} page={{ nowMs: requestTime() }} />
      <noscript><p className="m-0 p-8 text-lg text-ink-2">The day needs JavaScript to follow the clock. Supabase Hackday runs in {CITY_WORD} cities on Dec 10, 2026.</p></noscript>
    </>
  );
}
