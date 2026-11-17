'use client';
import clsx from 'clsx';
import { EVENT } from '@/lib/day-data';
import { PRIZES } from '@/lib/prizes';
import { BELOW, LABEL } from '@/components/shared/page-parts';
import { cityPrizeName, globalPrizeName } from '@/components/home/final-parts';
import { FinalTable, Steps } from './ledger';

/* The object: the prize is the picture. A flat line drawing of the city prize with dimension lines, and the global
   prize as a box drawn dashed until it is named; then the final and how it works as quiet rows. The drawings are code,
   in the seals' pen: hairlines, no fills, no green. Both are placeholders (the laptop stands in for a prize that is not
   confirmed), and drawings break today's rule that every picture is a project picture: that is the owner's call.
   Knob: objDim (dimension lines on or off). */
export function PrizeObject({ dim }: { dim: boolean }) {
  return (
    <>
      <section className={clsx(BELOW, 'py-10')} id="prizes" aria-labelledby="lo-p">
        <h2 className={clsx(LABEL, 'mb-8')} id="lo-p">Prizes</h2>
        <div className="lb-cols items-end">
          <figure className="lb-1 grid gap-y-6">
            <Laptop dim={dim} />
            <figcaption className="grid gap-y-1 rule-t pt-4">
              <span className="type-label text-ink-2">City prize</span>
              <span className="text-h1 leading-[1.1] tracking-d48">{cityPrizeName()}</span>
              <span className="text-sm text-ink-2">1st place in each city, ten in all.{PRIZES.city.confirmed ? '' : ' Placeholder.'}</span>
            </figcaption>
          </figure>
          <figure className="lb-2 grid gap-y-6">
            <Box dim={dim} />
            <figcaption className="grid gap-y-1 rule-t pt-4">
              <span className="type-label text-ink-2">Global prize</span>
              <span className="text-h1 leading-[1.1] tracking-d48 text-ink-2">{globalPrizeName()}</span>
              <span className="text-sm text-ink-2">The one {EVENT.pickers} pick from the finalists.</span>
            </figcaption>
          </figure>
        </div>
      </section>
      <FinalTable />
      <Steps />
    </>
  );
}

/* a dimension line: end ticks, the line, and a label */
function DimH({ x0, x1, y, label }: { x0: number; x1: number; y: number; label: string }) {
  return (
    <g className="lb-dim">
      <path d={`M${x0} ${y - 8}V${y + 8}M${x1} ${y - 8}V${y + 8}M${x0} ${y}H${x1}`} />
      <path d={`M${x0} ${y}l7 -3v6zM${x1} ${y}l-7 -3v6z`} className="lb-arrow" />
      <text x={(x0 + x1) / 2} y={y + 22} textAnchor="middle">{label}</text>
    </g>
  );
}
function DimV({ x, y0, y1, label }: { x: number; y0: number; y1: number; label: string }) {
  return (
    <g className="lb-dim">
      <path d={`M${x - 8} ${y0}H${x + 8}M${x - 8} ${y1}H${x + 8}M${x} ${y0}V${y1}`} />
      <path d={`M${x} ${y0}l-3 7h6zM${x} ${y1}l-3 -7h6z`} className="lb-arrow" />
      <text x={x - 14} y={(y0 + y1) / 2} textAnchor="middle" transform={`rotate(-90 ${x - 14} ${(y0 + y1) / 2})`}>{label}</text>
    </g>
  );
}

/* the city prize, drawn flat from the front: lid, display, hinge, base */
function Laptop({ dim }: { dim: boolean }) {
  return (
    <svg className="lb-svg w-full" viewBox="0 0 640 420" role="img" aria-label="A line drawing of a laptop, the city prize (placeholder)">
      <g className="lb-ink">
        <rect x="100" y="30" width="440" height="282" />
        <rect x="114" y="44" width="412" height="250" />
        <path d="M304 44h32v9h-32z" />
        <path d="M100 312H540" />
        <path d="M64 318H576L558 334H82Z" />
        <path d="M290 318v4h60v-4" />
      </g>
      <g className="lb-hatch">
        {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${130 + i * 32} 278l60 -60`} />)}
      </g>
      {dim ? (
        <>
          <DimH x0={64} x1={576} y={372} label={'× 10 · one for 1st place in each city'} />
          <DimV x={44} y0={30} y1={334} label="the city prize" />
        </>
      ) : null}
    </svg>
  );
}

/* the global prize: a box, dashed until it is named */
function Box({ dim }: { dim: boolean }) {
  return (
    <svg className="lb-svg w-full" viewBox="0 0 480 420" role="img" aria-label="A dashed box: the global prize, not named yet">
      <g className="lb-dash">
        <path d="M100 110L240 50L380 110L240 170Z" />
        <path d="M100 110V270L240 330V170" />
        <path d="M380 110V270L240 330" />
      </g>
      {dim ? (
        <>
          <DimH x0={100} x1={380} y={372} label="× 1 · the pick" />
          <DimV x={64} y0={110} y1={270} label="to be announced" />
        </>
      ) : null}
    </svg>
  );
}
