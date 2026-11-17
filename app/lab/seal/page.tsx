import type { Metadata } from 'next';
import saved from '@/saved/seal.config.json';
import type { Query } from '@/lib/clock';
import type { SealCfgInput } from '@/lib/seal';
import { SealLab } from '@/components/lab/seal-lab';

export const metadata: Metadata = { title: 'Seal lab', robots: { index: false } };

/* Dynamic: ?mode= and ?seed= preview a variation */
export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  return <SealLab saved={saved as SealCfgInput} q={await searchParams} />;
}
