'use client';
import type { CSSProperties } from 'react';
import { EVENT } from '@/lib/day-data';
import { clamp, hhmm, r2, tz } from '@/lib/format';
import { cityHref, dayOf, localSpan, showNow, slotText, view, type HomeCfg, type HomeCity, type HomeWorld, type View } from '@/lib/home';
import { Picture } from '@/components/pictures/picture';
import { CitySeal, MergedSeal } from '@/components/seal/seal-config';
import { useDay, type Ages } from './day-context';

/* The timetable: ten cities, east to west, one fixed row each: name | strip | slot. Time runs across in UTC. */
export function Timetable() {
  const { cfg: c, W, ages } = useDay(), V = view(c, W);
  return (
    <section className="tt" aria-label="The ten cities, east to west">
      <Axis V={V} W={W} cls="tt-axis" />
      <ol className="rows">{W.cs.map((x) => <Row key={'r' + x.i} x={x} V={V} ages={ages} />)}</ol>
      <PhoneNow W={W} />
      <NowLine V={V} W={W} extra="tt-now" />
      <Trunk W={W} />
      <Join W={W} c={c} />
    </section>
  );
}

function Row({ x, V, ages }: { x: HomeCity; V: View; ages: Ages }) {
  const { cfg: c, W } = useDay(), pk = W.picked && W.pick === x;
  const s = ages['s' + x.i], l = ages['l' + x.i], age = l != null ? l : s;
  const cls = 'row is-' + x.state + (pk ? ' is-pick' : '') + (c.you === x.i ? ' is-you' : '') + ' tt-row' + (s != null ? ' swap' : '') + (l != null ? ' land' : '');
  const style = { '--i': x.i, ...(age != null ? { '--age': '-' + age + 'ms' } : {}) } as CSSProperties;
  return (
    <li className={cls} style={style}>
      <NameLink x={x} cls="name" />
      <Ruler x={x} V={V} />
      <Slot x={x} />
      <i className="tie" aria-hidden="true" data-g={pk ? '1' : undefined} />
      {c.seal && x.state === 'done' ? <span className="mark" aria-hidden="true"><CitySeal id={x.id} size={24} /></span> : null}
    </li>
  );
}

/* " · Yours" after the time zone, on the person's own city */
function You({ x, c }: { x: HomeCity; c: HomeCfg }) {
  return c.you === x.i && c.green >= 4 ? <>{' · '}<b className="you" data-g="1">Yours</b></> : null;
}
export function NameLink({ x, cls }: { x: HomeCity; cls: string }) {
  const { cfg: c, W, carry } = useDay();
  return (
    <a className={cls} href={cityHref(x, c, W, carry)} data-city={x.id}>
      {x.name}<span className="loc"><span>{localSpan(x)}</span><span>{tz(x.city.offset)}<You x={x} c={c} /></span></span>
    </a>
  );
}

/* the daylight band: drawn whole, the strip clips it, so its soft edge never moves */
function Band({ x, V, c }: { x: HomeCity; V: View; c: HomeCfg }) {
  const out = [];
  for (let d = -1; d <= 2; d++) {
    const a = d * 1440 + x.city.rise - x.city.offset, b = d * 1440 + x.city.set - x.city.offset;
    if (b <= V.v0 || a >= V.v1) continue;
    const s = r2(clamp(c.soft / (b - a) * 100, 0, 49));
    out.push(<i key={d} className="day" style={{ left: r2(V.x(a)) + '%', width: r2(V.x(b) - V.x(a)) + '%', '--s': s + '%' } as CSSProperties} />);
  }
  return <>{out}</>;
}
export function Bar({ x, V }: { x: HomeCity; V: View }) {
  const { cfg: c } = useDay();
  const l = V.x(x.start), w = V.x(x.end) - l, bf = (x.buildEnd - x.start) / (x.end - x.start) * 100;
  let fill = 0;
  if (x.state === 'build') fill = x.f! * bf; else if (x.state === 'vote') fill = bf + x.f! * (100 - bf); else if (x.state === 'done') fill = 100;
  return (
    <i className="bar" style={{ left: r2(l) + '%', width: r2(w) + '%', '--bf': r2(bf) + '%', '--fill': r2(fill) + '%' } as CSSProperties} data-i={x.i}>
      <i className="bar-b" /><i className="bar-v" /><i className="bar-run" />
      <span className={'bar-t' + (l + w > 72 ? ' r' : '')}>{localSpan(x)} <span>{tz(x.city.offset)}<You x={x} c={c} /></span></span>
    </i>
  );
}
export function Ruler({ x, V }: { x: HomeCity; V: View }) {
  const { cfg: c } = useDay();
  return (
    <span className="strip" aria-hidden="true">
      <Band x={x} V={V} c={c} />
      <i className="wire" style={{ left: r2(V.x(x.end)) + '%' }} />
      <Bar x={x} V={V} />
    </span>
  );
}
export function Axis({ V, W, cls }: { V: View; W: HomeWorld; cls: string }) {
  const first = Math.ceil(V.v0 / 180) * 180, live = showNow(W), ticks = [];
  for (let m = first; m <= V.v1; m += 180) {
    const x = V.x(m); if (x < 0 || x > 100) continue;
    const lbl = ((m % 1440) + 1440) % 1440 === 0 ? dayOf(m) : hhmm(m), hide = x < 4 || x > 97 || (live && Math.abs(x - V.nx) < 8);
    ticks.push(<i key={m} className="tick" style={{ left: r2(x) + '%' }}>{hide ? null : <span>{lbl}</span>}</i>);
  }
  return (
    <div className={'axis ' + cls} aria-hidden="true">
      {ticks}
      <span className="axis-utc" style={live && V.nx < 8 ? { opacity: 0 } : undefined}>UTC</span>
    </div>
  );
}
/* the now line shows only while the clock is inside the strip */
export function NowLine({ V, W, extra }: { V: View; W: HomeWorld; extra: string }) {
  if (!showNow(W)) return null;
  return <div className={'now ' + extra} aria-hidden="true" data-g="1"><b style={{ transform: 'translateX(' + r2(V.nx) + '%)' }}><i /><span>{hhmm(W.now)}</span></b></div>;
}
export function Slot({ x }: { x: HomeCity }) {
  const { cfg: c, W } = useDay(), t = slotText(x, W), p = x.lead ? x.lead.p : null, pk = W.picked && W.pick === x;
  const g = ((x.state === 'build' || x.state === 'vote') && c.green >= 3) || (pk && c.green >= 3);
  return (
    <div className={'slot' + (g ? ' g' : '')}>
      <span className="slot-pic"><Picture p={p} />{c.peek && p ? <Picture p={p} cls="peek" /> : null}</span>
      <span className="slot-k">{g ? <i className="gsq" data-g="1" /> : null}{t.k}</span><span className="slot-a">{t.a}</span><span className="slot-b">{t.b}</span>
    </div>
  );
}
/* phone: time runs down, so now sits on the boundary between the cities that have started and those that have not */
export function PhoneNow({ W }: { W: HomeWorld }) {
  if (!showNow(W)) return null;
  const ny = W.cs.filter((x) => x.start <= W.now).length;
  return <i className="pnow" style={{ '--ny': ny } as CSSProperties} aria-hidden="true" data-g="1"><span>Now {hhmm(W.now)} UTC</span></i>;
}
export function Trunk({ W }: { W: HomeWorld }) {
  return (
    <>
      <i className="trunk" aria-hidden="true" />
      {W.picked ? <i className="trunk-g" data-g="1" aria-hidden="true" style={{ '--pi': W.pick.i } as CSSProperties} /> : null}
    </>
  );
}
export function Join({ W, c, cls }: { W: HomeWorld; c: HomeCfg; cls?: string }) {
  const pc = W.pick, lbl = W.picked ? 'Picked: ' + pc.win.p.name + ', ' + pc.name : EVENT.pickers + ' pick one at ' + hhmm(W.S.pickAt) + ' UTC';
  return (
    <div className={'join' + (cls ? ' ' + cls : '') + (W.picked ? ' is-picked' : '') + (W.allDone ? ' is-full' : '')}>
      <span className="join-lbl">{lbl}</span>
      <i className="join-o" data-g={W.picked ? '1' : undefined}>{W.picked && c.seal ? <MergedSeal ids={W.cs.map((x) => x.id)} size={40} /> : null}</i>
    </div>
  );
}
