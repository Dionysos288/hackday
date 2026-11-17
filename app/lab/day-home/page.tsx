import type { Metadata } from 'next';
import saved from '@/saved/day-home.config.json';
import parts from '@/saved/parts.config.json';
import { DayHomeLab, type DayHomeCfg } from '@/components/lab/day-home-lab';
import type { PartsCfg } from '@/components/board/config';

export const metadata: Metadata = { title: 'Day home lab', description: 'Tuning page for the home on the day: today’s home on the screen kit, the departures board, the control wall, and the board with strips.', robots: { index: false } };

/* ?dir= base, board, wall or strips; ?moment= a moment of the day; ?m= a minute; ?t=; ?worst=0; ?still=1 stops the clock; ?panel=0 or ?bare hides the panel */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <DayHomeLab saved={saved as Partial<DayHomeCfg>} parts={parts as Partial<PartsCfg>} q={await searchParams} />;
}
