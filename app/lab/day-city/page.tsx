import type { Metadata } from 'next';
import saved from '@/saved/day-city.config.json';
import parts from '@/saved/parts.config.json';
import { DayCityLab, type DayCityCfg } from '@/components/lab/day-city-lab';
import type { PartsCfg } from '@/components/board/config';

export const metadata: Metadata = { title: 'Day city lab', description: 'Tuning page for a city’s page on the day: today’s Tower on the screen kit, board and pylon, scope, and wall.', robots: { index: false } };

/* ?dir= base, board, scope or wall; ?city=; ?moment= before, build, vote, last, closed or picked; ?m= a minute; ?worst=0; ?still=1 stops the clock; ?panel=0 or ?bare hides the panel */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <DayCityLab saved={saved as Partial<DayCityCfg>} parts={parts as Partial<PartsCfg>} q={await searchParams} />;
}
