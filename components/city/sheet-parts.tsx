'use client';
import type { CSSProperties, MouseEvent } from 'react';
import clsx from 'clsx';
import { cutText, footText, headLabel, local, tz, projectHref, sessionBar, slotText, ticks, trace, type CityCfg, type CityWorld, type Row, type View } from '@/lib/city';
import { Picture } from '@/components/pictures/picture';
import { CitySeal } from '@/components/seal/seal-config';
import { NOW_TAG, SlotText } from '@/components/home/timetable';
import { useCity } from './city-context';

/* The pieces a city row is made of, shared by the sheet, the table, the project sheet and the tuning page's other
   layouts: name | strip | slot, the vote button, the winner's tie and seal, the cut line. */
const css = (o: Record<string, string | number>) => o as CSSProperties;
/* mono figures on the session's axis: the tick times and the time zone (no caps: they are figures) */
const AXIS_FIG = 'font-mono text-label/[1.2] font-medium tracking-label text-ink-2 whitespace-nowrap';
/* a line that marks the project you entered */
export const YOURS = 'you type-label text-accent';

/* ---------------- the session strip ---------------- */
export function Ticks({ W, V }: { W: CityWorld; V: View }) {
  return (
    <>
      {ticks(W, V).map((t) => <i key={t.m} className={clsx('cl-tick absolute top-0 h-full w-0', t.cut && 'is-cut', t.major && 'major')} style={{ left: t.left + '%' }}>{t.label != null ? <span className={clsx(AXIS_FIG, 'absolute top-0.5 left-0 tabular-nums [transform:translateX(-50%)]')}>{t.label}</span> : null}</i>)}
      <span className={clsx('cl-tz', AXIS_FIG, 'absolute top-0.5 right-[calc(100%+var(--s-3))] phone:hidden')}>{tz(W.off)}</span>
    </>
  );
}
export function SessionBar({ W, V }: { W: CityWorld; V: View }) {
  const b = sessionBar(W, V), st = W.st.state;
  const k = (live: boolean) => clsx('sb-k absolute bottom-3.5 z-5 pl-1 font-sans text-xs/none font-regular whitespace-nowrap tabular-nums knockout phone:hidden', live ? 'text-ink' : 'text-ink-2');
  return (
    <span className={'cl-bar absolute right-0 bottom-0 left-0 h-6 phone:bottom-2 phone:h-4 is-' + st}>
      <i className="bar" style={css({ left: b.l + '%', width: b.w + '%', '--bf': b.bf + '%', '--fill': b.fill + '%' })}><i className="bar-b" /><i className="bar-v" /><i className="bar-run" /></i>
      <span className={k(st === 'build')} style={{ left: b.l + '%' }}>{b.build}</span>
      {b.last ? <span className={k(st === 'vote')} style={{ left: b.last.l + '%' }}>{b.last.t}</span> : null}
      {b.now != null ? <i className="sb-now absolute -top-1.5 z-2 -ml-px hidden h-[18px] w-0.5 bg-accent phone:block" style={{ left: b.now + '%' }} data-g="1" /> : null}
    </span>
  );
}
/* cls places the line: over the sheet's rows, or over the project sheet's strip */
export function NowLine({ W, V, cls }: { W: CityWorld; V: View; cls: string }) {
  if (W.now < V.v0 || W.now > V.v1) return null;
  return (
    <div className={clsx('now cl-now pointer-events-none absolute top-0 z-4', cls)} aria-hidden="true" data-g="1">
      <b className="absolute inset-0 block" style={{ transform: 'translateX(' + Math.round(V.nx * 100) / 100 + '%)' }}><i className="absolute top-0 bottom-0 -left-px w-0.5 bg-accent" /><span className={clsx(NOW_TAG, 'top-0.5 left-0 [transform:translateX(-50%)]')}>{local(W, W.now)}</span></b>
    </div>
  );
}
/* one entry's line: the arrival mark, then its votes as steps from its arrival to now */
export function Trace({ W, V, o, c, big }: { W: CityWorld; V: View; o: Row; c: CityCfg; big?: boolean }) {
  const t = trace(W, V, o, c, big); if (!t) return null;
  return (
    <>
      <svg className="tr" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path d={t.d!} /></svg>
      {/* in the project sheet (outside the page) the mark stays ink */}
      {t.arr != null ? <i className={clsx('arr absolute bottom-[8%] -ml-px h-3 w-0.5 phone:hidden', big || W.state === 'next' ? 'bg-ink' : 'bg-ink-2')} style={{ left: t.arr + '%' }} /> : null}
    </>
  );
}
/* a vote someone else cast lands as a tick at the now line (its age goes in as a negative delay, so a re-render never restarts it) */
export function FlashTick({ W, V, o }: { W: CityWorld; V: View; o: Row }) {
  const { flash } = useCity(), age = flash[o.p.id];
  return age != null && W.voting ? <i className="vtick absolute top-[18%] bottom-[8%] z-2 -ml-px w-0.5 bg-accent phone:hidden" style={css({ left: Math.round(V.nx * 100) / 100 + '%', '--fage': '-' + age + 'ms' })} data-g="1" /> : null;
}
export function SheetHead({ W, V }: { W: CityWorld; V: View }) {
  return (
    <div className="cl-head relative grid h-(--headh) grid-cols-[var(--nameW)_var(--stripW)_var(--slotW)] gap-x-(--g) phone:grid-cols-[minmax(0,1fr)]" aria-hidden="true">
      <span className="cl-head-k type-label self-end pb-1 text-ink-2 phone:hidden">{headLabel(W)}</span>
      <span className="cl-axis relative block h-(--headh)"><Ticks W={W} V={V} /><SessionBar W={W} V={V} /></span>
    </div>
  );
}

/* ---------------- a row ---------------- */
/* a row of the sheet: the grid is in city.css (.cl-row), the rest is here */
export const ROW = 'relative grid h-(--rowh) items-center gap-x-(--g) hover:bg-tint-1 phone:h-16 phone:content-center phone:gap-x-3 phone:rule-t';
/* a row's li attributes: its key for the glide, its place for the arrival stagger, a fresh vote's flash */
export function useRowAttrs() {
  const { flash } = useCity();
  return (o: Row, cls: string, j?: number, prefix = 'p') => {
    const age = flash[o.p.id];
    return { className: clsx(cls, age != null && 'is-flash'), 'data-k': prefix + o.p.id, style: css({ ...(j != null ? { '--i': j } : {}), ...(age != null ? { '--fage': '-' + age + 'ms' } : {}) }) };
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
/* the rank before a name: none before the first votes; green on the leader while the city is live */
export function rankCls(W: CityWorld, o: Row | null): string {
  const g = !!o && o === W.lead && (W.state === 'build' || W.state === 'vote');
  return clsx('rk flex-none text-right tracking-[0] tabular-nums', g ? 'text-accent' : 'text-ink-3');
}
/* the name is the row's link: a stretched link, so the strip and the slot open the project too */
export const NAME = 'cl-pn flex min-w-0 items-center gap-3 leading-none tracking-d48 whitespace-nowrap text-ink outline-none';
export function NameLink({ o, cls }: { o: Row; cls?: string }) {
  const { W, L } = useCity(), open = useOpenRow();
  return (
    <a className={clsx(NAME, 'stretched', o === W.lead && 'font-medium', cls)} href={projectHref(W, o.p, L)} data-pid={o.p.id} data-row onClick={(e) => open(e, o.p.id)}>
      <span className={rankCls(W, o)}>{W.votesOn ? o.rank : ''}</span><span className="pn min-w-0 overflow-hidden text-ellipsis">{o.p.name}</span>
      {W.c.you === o.k ? <b className={clsx(YOURS, 'flex-none self-center')} data-g="1">Yours</b> : null}
    </a>
  );
}
/* where the button sits: in a row of the sheet (the default), in the table, in the project sheet, or on its own */
const VB_AT = {
  row: 'h-8 min-w-(--vbw) px-3 phone:col-start-3 phone:row-[1/3] phone:min-w-11 phone:px-2',
  table: 'h-7 min-w-(--vbw) px-3 phone:h-11',
  sheet: 'h-11 min-w-24 px-3',
  free: 'h-8 min-w-(--vbw) px-3',
};
export function VoteBtn({ o, at = 'row' }: { o: Row; at?: keyof typeof VB_AT }) {
  const { W, votes, vote } = useCity(), on = W.voting, v = !!votes[o.p.id];
  return (
    <button type="button" data-vote={o.p.id} aria-pressed={v} disabled={!on} hidden={!on}
      className={clsx('vb relative z-3 cursor-pointer justify-self-end font-sans text-sm/none font-medium before:absolute before:-inset-x-1 before:-inset-y-1.5 before:content-[""] pointer-coarse:h-11',
        '[transition:background-color_var(--dur-hover)_ease-out,scale_var(--dur-press)_var(--ease-out)] active:scale-[0.97]', VB_AT[at], v ? 'bg-ink text-ground' : 'edge-line text-ink hover:bg-tint-2')}
      aria-label={(v ? 'Take back your vote for ' : 'Vote for ') + o.p.name} onClick={(e) => { e.preventDefault(); vote(o.p.id); }}>{v ? 'Voted' : 'Vote'}</button>
  );
}
/* the slot in a city row: on a phone it opens up into the row (picture left, the figures under the name) */
const ROW_K = 'phone:hidden', ROW_A = 'phone:col-start-2 phone:row-start-2 phone:text-xs', ROW_B = 'phone:col-start-2 phone:row-start-2 phone:max-w-[60%] phone:justify-self-end phone:text-right tablet:hidden';
export function Slot({ o, c }: { o: Row | null; c: CityCfg }) {
  const { W } = useCity(), t = slotText(W, o), g = !!o && o === W.lead;
  return (
    <div className="slot cl-slot min-w-0 content-center items-center gap-x-3">
      <span className="slot-pic"><Picture p={o && o.p} />{c.peek && o ? <Picture p={o.p} cls="peek" /> : null}</span>
      <SlotText k={t.k} a={t.a} b={t.b} g={g} kCls={ROW_K} aCls={ROW_A} bCls={ROW_B} />
    </div>
  );
}
export function SealMark({ o, c }: { o: Row; c: CityCfg }) {
  const { W } = useCity();
  if (!(c.seal && W.state === 'done' && o === W.lead)) return null;
  return (
    <span className={clsx('mark cl-seal pointer-events-none absolute top-1/2 right-[calc(var(--m)/-2-14px)] z-2 size-7 bg-ground [transform:translateY(-50%)] phone:hidden', W.picked && W.isPick ? 'text-accent' : 'text-ink-2')} aria-hidden="true">
      <CitySeal id={W.city.id} size={28} draw />
    </span>
  );
}
export function Tie({ o }: { o: Row }) {
  const { W } = useCity(), g = W.picked && W.isPick;
  return o === W.lead && W.state === 'done'
    ? <i className={clsx('tie cl-tie absolute top-1/2 -right-(--m) w-[calc(var(--m)-var(--s-1))] origin-left phone:hidden', g ? 'h-(--line-thick) bg-accent' : 'h-(--hair) bg-ink-3')} data-g={g ? '1' : undefined} aria-hidden="true" />
    : null;
}
export function Cut({ c, j }: { c: CityCfg; j: number }) {
  const { W } = useCity(), t = cutText(W, c);
  return j === 0 && W.votesOn && t
    ? <span className="cut pointer-events-none absolute right-[calc(-1*var(--m)/2)] bottom-0 left-0 z-2 h-(--hair) bg-ink-2 phone:hidden" aria-hidden="true"><span className="type-label absolute top-0 left-0 bg-ground [transform:translateY(-50%)] pr-2 whitespace-nowrap text-ink-2">{t}</span></span>
    : null;
}
export function Placeholder({ j }: { j: number }) {
  const { W } = useCity(), dash = W.state === 'next' && j < 3;
  return (
    <li className={clsx('cl-row is-empty', ROW)} data-k={'e' + j}>
      <span className={NAME}><span className={rankCls(W, null)} /><span className="pn min-w-0 overflow-hidden text-ellipsis">{dash ? <i className="dash block h-[calc(var(--nsz)*0.8px)] w-[62%] dash-frame" /> : null}</span></span><span className="cl-strip" />
      <div className="slot cl-slot min-w-0 content-center items-center gap-x-3"><span className="slot-pic">{dash ? <i className="pic pic-empty" /> : null}</span><SlotText k="" a="" b="" g={false} kCls={ROW_K} aCls={ROW_A} bCls={ROW_B} /></div>
    </li>
  );
}
/* under the sheet: your project, and the founders' pick. One line each, always present, so nothing moves. */
export function SheetFoot({ c }: { c: CityCfg }) {
  const { W, shownIds } = useCity(), f = footText(W, c, shownIds);
  return (
    <p className="cl-foot grid h-(--foot) grid-cols-[calc(var(--nameW)+var(--g)+var(--stripW))_var(--slotW)] items-center gap-x-(--g) text-sm text-ink-2 phone:h-auto phone:min-h-16 phone:grid-cols-[minmax(0,1fr)] phone:content-center phone:gap-y-1 phone:py-2">
      <span className="ft-you min-w-0 truncate">{f.you ? <><b className={clsx(YOURS, 'mr-1')} data-g="1">Yours</b>{' ' + f.you}</> : null}</span>
      <span className={clsx('ft-pick min-w-0 truncate text-right phone:text-left', f.pickG && 'text-accent')} data-g={f.pickG ? '1' : undefined}>{f.pick}</span>
    </p>
  );
}
