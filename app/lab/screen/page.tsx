import type { Metadata } from 'next';
import saved from '@/saved/screen.config.json';
import { clampScreen } from '@/components/screen/config';
import { ScreenLab } from '@/components/lab/screen-lab';

export const metadata: Metadata = { title: 'Screen lab', description: 'Tuning page for the screen kit on the real home and city page, at three depths.', robots: { index: false } };

/* ?page= home, city or project; ?depth= big, all or none; ?bare hides the lab chrome */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams, cfg = clampScreen({ ...saved, ...(q.depth ? { depth: q.depth } : {}) });
  return <ScreenLab saved={cfg} page={q.page === 'city' || q.page === 'project' ? q.page : 'home'} bare={q.bare !== undefined} />;
}
