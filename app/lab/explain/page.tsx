import type { Metadata } from 'next';
import saved from '@/saved/explain.config.json';
import { clampScope, type ScopeCfg } from '@/components/day/scope';
import { ExplainLab } from '@/components/lab/explain-lab';

export const metadata: Metadata = { title: 'Tube lab', description: 'Tuning page for the how-it-works and prize drawings: every scene, its modes and the beam.', robots: { index: false } };

/* ?bare hides the lab chrome */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return <ExplainLab saved={clampScope(saved as Partial<ScopeCfg>)} bare={q.bare !== undefined} />;
}
