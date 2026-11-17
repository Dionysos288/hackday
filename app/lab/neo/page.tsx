import type { Metadata } from 'next';
import saved from '@/saved/neo.config.json';
import { clampNeo, type NeoLook } from '@/components/day/neo-config';
import { NeoLab } from '@/components/lab/neo-lab';

export const metadata: Metadata = { title: 'City prize lab', description: 'The city prize, a MacBook Neo given ten times, drawn four ways, with every value on a knob.', robots: { index: false } };

/* ?mode=stack|ajar|screen|row opens on that mode */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return <NeoLab saved={clampNeo({ ...(saved as Partial<NeoLook>), ...(q.mode ? { mode: q.mode as NeoLook['mode'] } : {}) })} />;
}
