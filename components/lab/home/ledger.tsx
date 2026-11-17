'use client';
import clsx from 'clsx';
import { EVENT } from '@/lib/day-data';
import { dur, hhmm } from '@/lib/format';
import { PRIZES } from '@/lib/prizes';
import { BELOW, LABEL } from '@/components/shared/page-parts';
import { useDay } from '@/components/home/day-context';
import { CityCell, PickBlock, PlaceText, cityPrizeName, finalLine, globalPrizeName, places } from '@/components/home/final-parts';

/* Ledger: the final, the prizes and how it works as three quiet sections in the row grammar, so the first viewport
   stays the only loud thing. The final fills in as cities close: ten rows, each with its three places. */
export function Ledger() {
  return (<><FinalTable /><Prizes /><Steps /></>);
}

/* the final: a sentence, the pick, then a row per city with its three places */
export function FinalTable({ id = 'final' }: { id?: string }) {
  const { W } = useDay();
  return (
    <section className={clsx(BELOW, 'py-8')} id={id} aria-labelledby="lg-f">
      <div className="lg-cols items-end pb-6">
        <h2 className={clsx(LABEL, 'lg-1')} id="lg-f">The final</h2>
        <p className="lg-2 text-h2/[1.2] tracking-snug text-ink phone:text-xl/[1.3]">{finalLine(W)}</p>
      </div>
      <div className="lg-cols items-start py-4 rule-t">
        <span className="lg-1 type-label text-ink-2">The pick</span>
        <PickBlock cls="lg-2" bare />
      </div>
      <ol>
        {W.cs.map((x) => {
          const ps = places(x, W);
          return (
            <li key={x.i} className={clsx('lg-row lg-cols items-center rule-t', x.state === 'next' && 'lg-next')}>
              <CityCell x={x} cls="lg-1" />
              {x.state === 'done' && !x.top.length
                ? <span className="lg-2 text-sm text-ink-3">No entries came in, so no finalists.</span>
                : <span className="lg-2 lg-three grid gap-x-(--g)">{ps.map((p) => <PlaceText key={p.k} p={p} cls={clsx('text-sm', p.sure === 'pick' && 'lg-pick')} />)}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* the prizes: two rows, each named once */
export function Prizes({ id = 'prizes' }: { id?: string }) {
  return (
    <section className={clsx(BELOW, 'py-8')} id={id} aria-labelledby="lg-p">
      <h2 className={clsx(LABEL, 'mb-4')} id="lg-p">Prizes</h2>
      <dl>
        <div className="lg-cols items-baseline py-4"><dt className="lg-1 type-label text-ink-2">City prize</dt><dd className="lg-2a text-h2 tracking-snug">{cityPrizeName()}</dd><dd className="lg-2b text-sm text-ink-2">1st place in each city, ten in all.{PRIZES.city.confirmed ? '' : ' Placeholder.'}</dd></div>
        <div className="lg-cols items-baseline py-4 rule-t"><dt className="lg-1 type-label text-ink-2">Global prize</dt><dd className="lg-2a text-h2 tracking-snug text-ink-2">{globalPrizeName()}</dd><dd className="lg-2b text-sm text-ink-2">The one {EVENT.pickers} pick from the finalists.</dd></div>
      </dl>
    </section>
  );
}

/* how it works: build, vote, the final */
export function Steps() {
  const { cfg: c, W } = useDay();
  const steps: [string, string][] = [
    ['Build', 'Each city builds for ' + dur(c.buildMin) + ', from ' + hhmm(c.startHour * 60) + ' local time. Share your project as soon as it is in.'],
    ['Vote', 'Anyone with the link can vote, after confirming an email once. Voting is open the whole time and ' + dur(c.voteAfter) + ' after. Judges add their votes to the same count.'],
    ['The final', 'The top 3 in each city go to the final. ' + EVENT.pickers + ' pick one at ' + hhmm(W.S.pickAt) + ' UTC.'],
  ];
  return (
    <section className={clsx(BELOW, 'py-8')} aria-labelledby="lg-h">
      <h2 className={clsx(LABEL, 'mb-4')} id="lg-h">How it works</h2>
      <ol>{steps.map((s, j) => (
        <li key={s[0]} className={clsx('lg-cols items-baseline py-3 text-xl leading-[1.3] tracking-snug phone:text-lg', j > 0 && 'rule-t')}>
          <span className={clsx(LABEL, 'lg-1')}>{s[0]}</span><span className="lg-2 max-w-[60ch]">{s[1]}</span>
        </li>
      ))}</ol>
    </section>
  );
}
