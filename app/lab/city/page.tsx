import type { Metadata } from 'next';
import saved from '@/saved/lab-city.config.json';
import type { Query } from '@/lib/clock';
import type { CityCfg } from '@/lib/city';
import { CityDirsLab } from '@/components/lab/city-dirs-lab';

export const metadata: Metadata = { title: 'City lab', description: 'Tuning page for a city’s page: today’s Tower and three directions, three project views, as a visitor, a builder or a judge.', robots: { index: false } };

/* Dynamic: the page starts from the URL (?city=, ?mode=, ?moment=, ?t=, ?ht= from the home lab, ?panel=0 and the knobs) */
export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  return <CityDirsLab saved={saved as Partial<CityCfg>} q={await searchParams} />;
}
