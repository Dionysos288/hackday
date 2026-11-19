import { ImageResponse } from 'next/og';
import { EVENT, cityById } from '@/lib/day-data';
import { fmtN, ord } from '@/lib/format';
import { projectOnDay } from '@/components/day/day';

/* A project's share image, drawn when a link is shared: the name, its pitch, the city, and its place and votes at that
   moment. The colours are the share card's (components/forms/forms.css, --fm-card-*), as hex for the image renderer. */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'The project’s name, pitch, place and votes at ' + EVENT.name;
const C = { ground: '#131413', ink: '#edefee', ink2: '#b9bbba', green: '#3ecf8e' };

export default async function Image({ params }: { params: Promise<{ city: string; slug: string }> }) {
  const { city, slug } = await params, c = cityById(city);
  const { W, row, listed } = c ? projectOnDay(city, decodeURIComponent(slug), {}, Date.now()) : { W: null, row: null, listed: false };
  const name = row ? row.p.name : EVENT.name, pitch = row ? row.p.pitch : '';
  const where = row && W && listed && W.votesOn ? ord(row.rank) + ' in ' + c!.name + ' · ' + fmtN(row.v) + (row.v === 1 ? ' vote' : ' votes') : c ? c.name : '';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: C.ground, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 28, color: C.ink2 }}>
          <div style={{ width: 14, height: 14, background: C.green }} />
          <span>{EVENT.name} · {EVENT.date}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: name.length > 24 ? 72 : 96, lineHeight: 1.02, letterSpacing: -2 }}>{name}</div>
          {pitch ? <div style={{ fontSize: 32, lineHeight: 1.35, color: C.ink2, maxWidth: 960 }}>{pitch}</div> : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 30, borderTop: '1px solid ' + C.ink2, paddingTop: 24 }}>
          <span>{where}</span>
          <span style={{ color: C.ink2 }}>{!W || W.voting ? 'Anyone with the link can vote' : row && listed && W.state === 'done' && row.rank <= EVENT.finalists ? 'In the final' : 'Voting has closed'}</span>
        </div>
      </div>
    ),
    size,
  );
}
