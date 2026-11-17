/* The parts of the home that do not follow the clock: how it works, the questions, past hackathons and the footer.
   Server components. */
import type { ReactNode } from 'react';
import { EVENT, pastEvents } from '@/lib/day-data';
import { FAQ } from '@/lib/data';
import { NB, dur, hhmm } from '@/lib/format';
import type { HomeCfg } from '@/lib/home';

export function HowItWorks({ c }: { c: Pick<HomeCfg, 'buildMin' | 'startHour' | 'schedule' | 'voteAfter'> }) {
  return (
    <section className="how" aria-labelledby="how-h">
      <h2 className="lbl" id="how-h">How it works</h2>
      <ol>
        <li><span className="how-k">Build</span><span>{'Each city builds for ' + dur(c.buildMin) + ', starting ' + hhmm(c.startHour * 60) + ' local' + (c.schedule === 'same' ? ' UTC' : '') + '.'}</span></li>
        <li><span className="how-k">Vote</span><span>{'Voting opens when building starts' + (c.voteAfter ? ' and closes ' + dur(c.voteAfter) + ' after it ends' : ' and closes when it ends') + '. The project with the most votes wins its city.'}</span></li>
        <li><span className="how-k">Pick</span><span>{EVENT.pickers + ' pick one of the ten city winners.'}</span></li>
      </ol>
    </section>
  );
}

export function Questions() {
  if (!FAQ.length) return null;
  return (
    <section className="qa" aria-labelledby="qa-h">
      <h2 className="lbl" id="qa-h">Questions</h2>
      <dl>{FAQ.map((f) => <div key={f[0]}><dt>{f[0]}</dt><dd>{f[1]}</dd></div>)}</dl>
    </section>
  );
}

/* first: the row this hackathon adds to the list once it is over (it follows the clock, so it is passed in) */
export function PastHackathons({ first }: { first: ReactNode }) {
  return (
    <section className="past" aria-labelledby="past-h">
      <h2 className="lbl" id="past-h">Past hackathons</h2>
      <ol>
        {first}
        {pastEvents().map((e) => (
          <li key={e.name}>
            <span className="ps-d">{e.date}</span><span className="ps-n">{e.name}</span><span className="ps-f">{e.format}</span>
            <span className="ps-e">{e.submissions ? e.submissions + NB + 'entries' : 'Not listed'}</span><span className="ps-w" /><span className="ps-pic" />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomeFooter() {
  return <footer className="ft"><span>{EVENT.name}</span><span>Times are UTC on the strip and local in each row.</span></footer>;
}
