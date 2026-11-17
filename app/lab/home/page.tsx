import type { Metadata } from 'next';
import saved from '@/saved/lab-home.config.json';
import type { Query } from '@/lib/clock';
import type { HomeCfg } from '@/lib/home';
import { HomeLab } from '@/components/lab/home-lab';

export const metadata: Metadata = { title: 'Home lab', description: 'Tuning page for the home: the first viewport and the final below it, six moments.', robots: { index: false } };

/* Dynamic: the page starts from the URL (?dir=, ?moment=, ?t=, ?seed=, ?panel=0 and the knobs) */
export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  return <HomeLab saved={saved as Partial<HomeCfg>} q={await searchParams} />;
}
