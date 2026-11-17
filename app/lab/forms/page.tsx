import type { Metadata } from 'next';
import { param, type Query } from '@/lib/clock';
import { FormsLab } from '@/components/lab/forms-lab';

export const metadata: Metadata = { title: 'Forms lab', description: 'Try each sheet: sign in, the email step for voting, submit, remind me and share.', robots: { index: false } };

/* Dynamic: ?ground= picks the ground */
export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  return <FormsLab ground={param(await searchParams, 'ground')} />;
}
