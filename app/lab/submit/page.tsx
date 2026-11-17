import type { Metadata } from 'next';
import { SubmitLab } from '@/components/lab/submit-lab';

export const metadata: Metadata = { title: 'Submit lab', description: 'Get ready and the two ways to submit: the block in each state, the editor picker, the submit sheet’s two parts and what each check says.', robots: { index: false } };

/* ?only=<closed|open|building|sheet|door> shows one state alone (for stills) */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return <SubmitLab only={q.only} />;
}
