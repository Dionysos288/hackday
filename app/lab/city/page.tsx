import type { Metadata } from 'next';
import type { Query } from '@/lib/clock';
import { savedCityCfg } from '@/components/city/city-page';
import { CityLab } from '@/components/lab/city-lab';

export const metadata: Metadata = { title: 'City lab', description: 'Tuning page for one city: the home’s row, opened. Four layouts, six moments.', robots: { index: false } };

/* Dynamic: the page starts from the URL (?city=, ?moment=, ?t=, ?ht= from the day lab, ?panel=0 and the knobs) */
export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  return <CityLab saved={savedCityCfg()} q={await searchParams} />;
}
