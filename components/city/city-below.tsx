/* The parts of a city page that do not follow the clock: how the city's session runs, and the footer. Drawn on the
   server from the schedule alone. */
import { EVENT, sched } from '@/lib/day-data';
import { cityIndex, type CityCfg } from '@/lib/city';
import { hhmm, tz } from '@/lib/format';

export function CityHow({ c }: { c: CityCfg }) {
  const S = sched(c), x = S.cs[cityIndex(c)], nm = x.city.name, off = x.city.offset, local = (m: number) => hhmm(m + off);
  return (
    <section className="how cl-how" aria-labelledby="how-h">
      <h2 className="lbl" id="how-h">How it works in {nm}</h2>
      <ol>
        <li><span className="how-k">Build</span><span>{'Build from ' + local(x.start) + ' to ' + local(x.buildEnd) + ', ' + nm + ' time (' + hhmm(x.start) + ' to ' + hhmm(x.buildEnd) + ' UTC).'}</span></li>
        <li><span className="how-k">Vote</span><span>{'Vote from ' + local(x.start) + ' to ' + local(x.end) + ', on any project as soon as it is in. The project with the most votes wins ' + nm + '.'}</span></li>
        <li><span className="how-k">Pick</span><span>{EVENT.pickers + ' pick one of the ten city winners at ' + local(S.pickAt) + '.'}</span></li>
      </ol>
    </section>
  );
}

export function CityFooter({ c }: { c: CityCfg }) {
  const x = sched(c).cs[cityIndex(c)], nm = x.city.name;
  return <footer className="ft"><span>{EVENT.name + ' · ' + nm}</span><span>{'Times are ' + nm + ' time (' + tz(x.city.offset) + ') unless marked UTC.'}</span></footer>;
}
