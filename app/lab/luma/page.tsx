import type { Metadata } from 'next';
import { ourWheel } from '@/components/preview/facts';
import { LumaThumb, THUMB } from '@/components/luma/luma-thumb';
import '@/components/luma/luma-lab.css';

export const metadata: Metadata = { title: 'Luma thumbnails', description: 'The Luma cover for each city, from the City headline frame.', robots: { index: false } };

/* The Luma covers: a section with every city's cover, each linking to its own page at full size. ?city=<id> draws that
   one cover alone at 1024 px in the top left corner, for a still:
     W=1024 H=1024 node tools/still.mjs "http://localhost:4320/lab/luma?city=tokyo" shots/luma/tokyo.png 3000 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { city } = await searchParams, ours = ourWheel();
  const one = city ? ours.cities.find((c) => c.id === city) : undefined;
  /* PLACEHOLDER: every cover says registration is open; the site's states are seeded, not real sign-ups */
  if (one) return <main className="ll-solo"><LumaThumb name={one.name} status="open" session={one.session} date={ours.dateShort} size={THUMB} /></main>;
  return (
    <main className="ll">
      <section className="ll-section" aria-labelledby="ll-h">
        <h1 id="ll-h">Luma thumbnails</h1>
        <p className="ll-lede">One cover for each city, 1024 by 1024. Open one for the full-size image.</p>
        <ul className="ll-grid">
          {ours.cities.map((c) => (
            <li key={c.id}>
              <a href={`/lab/luma?city=${c.id}`} className="ll-card">
                <LumaThumb name={c.name} status="open" session={c.session} date={ours.dateShort} size={300} />
                <span>{c.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
