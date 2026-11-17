'use client';
import type { CSSProperties, MouseEvent } from 'react';
import { cutText, footText, headLabel, local, tz, projectHref, sessionBar, slotText, ticks, trace, type CityCfg, type CityWorld, type Row, type View } from '@/lib/city';
import { Picture } from '@/components/pictures/picture';
import { CitySeal } from '@/components/seal/seal-config';
import { useCity } from './city-context';

/* The pieces a city row is made of, shared by the sheet, the table, the project sheet and the tuning page's other
   layouts: name | strip | slot, the vote button, the winner's tie and seal, the cut line. */
const css = (o: Record<string, string | number>) => o as CSSProperties;

/* ---------------- the session strip ---------------- */
export function Ticks({ W, V }: { W: CityWorld; V: View }) {
  return (
    <>
      {ticks(W, V).map((t) => <i key={t.m} className={'cl-tick' + (t.cut ? ' is-cut' : '') + (t.major ? ' major' : '')} style={{ left: t.left + '%' }}>{t.label != null ? <span>{t.label}</span> : null}</i>)}
      <span className="cl-tz">{tz(W.off)}</span>
    </>
  );
}
export function SessionBar({ W, V }: { W: CityWorld; V: View }) {
  const b = sessionBar(W, V);
  return (
    <span className={'cl-bar is-' + W.st.state}>
      <i className="bar" style={css({ left: b.l + '%', width: b.w + '%', '--bf': b.bf + '%', '--fill': b.fill + '%' })}><i className="bar-b" /><i className="bar-v" /><i className="bar-run" /></i>
      <span className="sb-k" style={{ left: b.l + '%' }}>{b.build}</span>
      {b.last ? <span className="sb-k" style={{ left: b.last.l + '%' }}>{b.last.t}</span> : null}
      {b.now != null ? <i className="sb-now" style={{ left: b.now + '%' }} data-g="1" /> : null}
    </span>
  );
}
export function NowLine({ W, V }: { W: CityWorld; V: View }) {
  if (W.now < V.v0 || W.now > V.v1) return null;
  return <div className="now cl-now" aria-hidden="true" data-g="1"><b style={{ transform: 'translateX(' + Math.round(V.nx * 100) / 100 + '%)' }}><i /><span>{local(W, W.now)}</span></b></div>;
}
/* one entry's line: the arrival mark, then its votes as steps from its arrival to now */
export function Trace({ W, V, o, c, big }: { W: CityWorld; V: View; o: Row; c: CityCfg; big?: boolean }) {
  const t = trace(W, V, o, c, big); if (!t) return null;
  return (
    <>
      <svg className="tr" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path d={t.d!} /></svg>
      {t.arr != null ? <i className="arr" style={{ left: t.arr + '%' }} /> : null}
    </>
  );
}
/* a vote someone else cast lands as a tick at the now line (its age goes in as a negative delay, so a re-render never restarts it) */
export function FlashTick({ W, V, o }: { W: CityWorld; V: View; o: Row }) {
  const { flash } = useCity(), age = flash[o.p.id];
  return age != null && W.voting ? <i className="vtick" style={css({ left: Math.round(V.nx * 100) / 100 + '%', '--fage': '-' + age + 'ms' })} data-g="1" /> : null;
}
export function SheetHead({ W, V }: { W: CityWorld; V: View }) {
  return <div className="cl-head" aria-hidden="true"><span className="cl-head-k">{headLabel(W)}</span><span className="cl-axis"><Ticks W={W} V={V} /><SessionBar W={W} V={V} /></span></div>;
}

/* ---------------- a row ---------------- */
/* a row's li attributes: its key for the glide, its place for the arrival stagger, a fresh vote's flash */
export function useRowAttrs() {
  const { flash } = useCity();
  return (o: Row, cls: string, j?: number, prefix = 'p') => {
    const age = flash[o.p.id];
    return { className: cls + (age != null ? ' is-flash' : ''), 'data-k': prefix + o.p.id, style: css({ ...(j != null ? { '--i': j } : {}), ...(age != null ? { '--fage': '-' + age + 'ms' } : {}) }) };
  };
}
/* the name opens the project's sheet; a modified click still opens the project's own address */
export function useOpenRow() {
  const { openProject, cur: curRef } = useCity();
  return (e: MouseEvent<HTMLAnchorElement>, id: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault(); const links = Array.from(document.querySelectorAll('a[data-row]')); curRef.current = links.indexOf(e.currentTarget);
    openProject(id, e.currentTarget);
  };
}
export function NameLink({ o, cls }: { o: Row; cls?: string }) {
  const { W, L } = useCity(), open = useOpenRow();
  return (
    <a className={'cl-pn' + (cls ? ' ' + cls : '')} href={projectHref(W, o.p, L)} data-pid={o.p.id} data-row onClick={(e) => open(e, o.p.id)}>
      <span className="rk">{W.votesOn ? o.rank : ''}</span><span className="pn">{o.p.name}</span>
      {W.c.you === o.k ? <b className="you" data-g="1">Yours</b> : null}
    </a>
  );
}
export function VoteBtn({ o, cls }: { o: Row; cls?: string }) {
  const { W, votes, vote } = useCity(), on = W.voting, v = !!votes[o.p.id];
  return (
    <button type="button" className={'vb' + (cls ? ' ' + cls : '') + (v ? ' is-on' : '')} data-vote={o.p.id} aria-pressed={v} disabled={!on} hidden={!on}
      aria-label={(v ? 'Take back your vote for ' : 'Vote for ') + o.p.name} onClick={(e) => { e.preventDefault(); vote(o.p.id); }}>{v ? 'Voted' : 'Vote'}</button>
  );
}
export function Slot({ o, c }: { o: Row | null; c: CityCfg }) {
  const { W } = useCity(), t = slotText(W, o), g = !!o && o === W.lead;
  return (
    <div className={'slot cl-slot' + (g ? ' g' : '')}>
      <span className="slot-pic"><Picture p={o && o.p} />{c.peek && o ? <Picture p={o.p} cls="peek" /> : null}</span>
      <span className="slot-k">{g ? <i className="gsq" data-g="1" /> : null}{t.k}</span><span className="slot-a">{t.a}</span><span className="slot-b">{t.b}</span>
    </div>
  );
}
export function SealMark({ o, c }: { o: Row; c: CityCfg }) {
  const { W } = useCity();
  return c.seal && W.state === 'done' && o === W.lead ? <span className="mark cl-seal" aria-hidden="true"><CitySeal id={W.city.id} size={28} draw /></span> : null;
}
export function Tie({ o }: { o: Row }) {
  const { W } = useCity();
  return o === W.lead && W.state === 'done' ? <i className="tie cl-tie" data-g={W.picked && W.isPick ? '1' : undefined} aria-hidden="true" /> : null;
}
export function Cut({ c, j }: { c: CityCfg; j: number }) {
  const { W } = useCity(), t = cutText(W, c);
  return j === 0 && W.votesOn && t ? <span className="cut" aria-hidden="true"><span>{t}</span></span> : null;
}
export function Placeholder({ j }: { j: number }) {
  const { W } = useCity(), dash = W.state === 'next' && j < 3;
  return (
    <li className={'cl-row is-empty' + (dash ? ' is-dash' : '')} data-k={'e' + j}>
      <span className="cl-pn"><span className="rk" /><span className="pn">{dash ? <i className="dash" /> : null}</span></span><span className="cl-strip" />
      <div className="slot cl-slot"><span className="slot-pic">{dash ? <i className="pic pic-empty" /> : null}</span><span className="slot-k" /><span className="slot-a" /><span className="slot-b" /></div>
    </li>
  );
}
/* under the sheet: your project, and the founders' pick. One line each, always present, so nothing moves. */
export function SheetFoot({ c }: { c: CityCfg }) {
  const { W, shownIds } = useCity(), f = footText(W, c, shownIds);
  return (
    <p className="cl-foot">
      <span className="ft-you">{f.you ? <><b className="you" data-g="1">Yours</b>{' ' + f.you}</> : null}</span>
      <span className={'ft-pick' + (f.pickG ? ' g' : '')} data-g={f.pickG ? '1' : undefined}>{f.pick}</span>
    </p>
  );
}
