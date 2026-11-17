import type { Metadata } from 'next';
import saved from '@/saved/explain.config.json';
import { clampScope, type ScopeCfg } from '@/components/day/scope';
import { ExplainLab } from '@/components/lab/explain-lab';

export const metadata: Metadata = { title: 'Tube lab', description: 'Tuning page for the how-it-works and prize drawings: every scene, its modes and the beam.', robots: { index: false } };

/* ?bare hides the lab chrome; ?only=<direction or scene>&at=<0..1>&r=<beam|canvas> draws one tube full width (for stills);
   &look=first draws it as first built; ?compare shows the picked direction in the two looks side by side */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return <ExplainLab saved={clampScope(saved as Partial<ScopeCfg>)} bare={q.bare !== undefined} only={q.only} at={q.at !== undefined ? Number(q.at) : undefined} r={q.r} compare={q.compare !== undefined} look={q.look} />;
}
