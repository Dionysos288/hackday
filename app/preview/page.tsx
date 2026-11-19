import saved from '@/saved/fold.config.json';
import wheel from '@/saved/wheel.config.json';
import { clampWheel } from '@/components/wheel/config';
import { ourWheel } from '@/components/preview/facts';
import type { FoldCfg } from '@/components/preview/fold/config';
import { FoldPreview } from '@/components/preview/fold/preview-page';
import { pageMeta } from '@/lib/meta';
import { EVENT, CITY_WORD, CITY_WORD_CAP } from '@/lib/day-data';
import { backendOn } from '@/lib/server/env';
import { headers } from 'next/headers';
import { FormsProvider } from '@/components/forms/forms-provider';

export const metadata = pageMeta(
  `${EVENT.name}: ${CITY_WORD} cities, one day`,
  `${CITY_WORD_CAP} cities, east to west on 10 December 2026. Each builds for 90 minutes from 09:00 local time and votes until 30 minutes after. The top 3 in each city go to the final; one pick wins $10,000.`,
);

/* The preview home, until the day: the wheel, then the day under the fold (saved/fold.config.json, tuned at
   /lab/fold). ?city= opens on a city by its place in the list (from 0), ?gl=0 draws without WebGL, ?mark= and ?globe= try the wheel's others, ?admin shows the page's knobs. */
/* the time of the request: the end board is drawn at it */
function requestTime() { return Date.now(); }

/* ?mark= and ?globe= try the wheel's other marks and globes without saving (the admin panel holds them too) */
const pick = (q: Record<string, string | undefined>) => ({ ...(q.mark ? { mark: q.mark } : {}), ...(q.globe ? { globe: q.globe } : {}) });

/* where the visitor is: the host's IP lookup (Vercel sends the position as headers), or ?at=lat,lon to try one. With
   neither, the nearest city is found by time zone. */
function whereFrom(h: Headers, at?: string) {
  const [a, b] = at ? at.split(',').map(Number) : [Number(h.get('x-vercel-ip-latitude')), Number(h.get('x-vercel-ip-longitude'))];
  return h.get('x-vercel-ip-latitude') || at ? (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lon: b } : null) : null;
}

export default async function PreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams, here = whereFrom(await headers(), q.at);
  return <FormsProvider live={backendOn()}><FoldPreview saved={saved as Partial<FoldCfg>} wheel={clampWheel({ ...wheel, ...pick(q) })} ours={ourWheel()} here={here} q={q} nowMs={requestTime()} /></FormsProvider>;
}
