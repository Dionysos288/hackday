import { notFound } from 'next/navigation';
import { CITY_IDS, cityById } from '@/lib/day-data';
import type { Query } from '@/lib/clock';
import { pageMeta } from '@/lib/meta';
import { CityPage } from '@/components/city/city-page';

const DESCRIPTION = 'One city’s hackathon: build for 90 minutes from 09:00 local. Voting opens at 09:00 and closes 30 minutes after building ends. The project with the most votes wins the city.';

/* The ten cities are known, so any other id is a 404 */
export const dynamicParams = false;
export function generateStaticParams() { return CITY_IDS.map((city) => ({ city })); }

type Props = { params: Promise<{ city: string }>; searchParams: Promise<Query> };
export async function generateMetadata({ params }: Props) {
  const c = cityById((await params).city);
  return c ? pageMeta(c.name + ' · Supabase Hackathon', DESCRIPTION) : {};
}

/* Dynamic: the first frame is drawn at the moment the URL asks for (?moment=, ?t=), or at the real time of the
   request, so the page arrives finished instead of filling in after load. */
function requestTime() { return Date.now(); }

export default async function City({ params, searchParams }: Props) {
  const { city } = await params;
  if (!cityById(city)) notFound();
  const q = await searchParams;
  return (
    <>
      <CityPage id={city} q={q} nowMs={requestTime()} />
      <noscript><p className="noscript">This page needs JavaScript to follow the clock and to vote.</p></noscript>
    </>
  );
}
