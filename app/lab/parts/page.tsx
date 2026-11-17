import type { Metadata } from 'next';
import saved from '@/saved/parts.config.json';
import { PartsLab } from '@/components/lab/parts-lab';
import type { PartsCfg } from '@/components/board/config';

export const metadata: Metadata = { title: 'Parts lab', description: 'Tuning page for the parts of the day pages: header row, announcement line, split-flap, segment countdown, state chips, change flash, test cards, boarding pass, bug.', robots: { index: false } };

/* ?moment= a moment of the day (announced, first, mid, closed, picked, archived); ?t=; ?still=1 stops the clock; ?face=; ?bare hides the panel */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <PartsLab saved={saved as Partial<PartsCfg>} q={await searchParams} />;
}
