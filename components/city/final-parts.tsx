'use client';
import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { EVENT, minOfVote } from '@/lib/day-data';
import { fmtN, gapCut, local, ord, plural, projectHref, slugOf, view, type CityWorld, type Row, type View } from '@/lib/city';
import { cityPrize } from '@/lib/prizes';
import { cardAlt, cardSVG, projectURL, type ShareProject } from '@/lib/forms';
import { forCity, toSvgString } from '@/lib/seal';
import { useSealCfg } from '@/components/seal/seal-config';
import { Picture } from '@/components/pictures/picture';
import { useForms } from '@/components/forms/forms-provider';
import { useCity } from './city-context';
import { Trace, VoteBtn, useOpenRow } from './sheet-parts';

/* The parts of the city page's Tower with the final zone (the tuning page's other directions draw from them too): the
   cut under 3rd with the city prize, the figures a row shows (votes, the judge mark, the gap to the cut), judge presses
   on a trace, the judge's stepper, your project's bar, the share kit, and a project opened. */

/* ---------------- the cut: under 3rd, the city prize beside it ---------------- */
export function cutLine(W: CityWorld): string { return W.state === 'done' ? 'The top ' + EVENT.finalists + ' went to the final.' : 'Top ' + EVENT.finalists + ' go to the final.'; }
export function CutRule({ cls }: { cls?: string }) {
  const { W } = useCity(), done = W.state === 'done';
  if (!W.votesOn) return null;
  return (
    <span className={clsx('cf-cut pointer-events-none absolute right-[calc(-1*var(--m)/2)] bottom-0 left-0 z-3 h-(--line-thin) bg-ink-2 phone:right-0', cls)} aria-hidden="true">
      <span className="absolute top-0 left-0 flex items-baseline gap-2 bg-ground pr-2 whitespace-nowrap [transform:translateY(-50%)]">
        <span className="type-label text-ink">{cutLine(W)}</span>
        <span className="text-xs text-ink-2 phone:hidden">{cityPrize(W.city.name, done)}</span>
        <span className="hidden text-xs text-ink-2 phone:inline">{cityPrize(undefined, done)}</span>
      </span>
    </span>
  );
}

/* ---------------- a row's figures ---------------- */
/* a judge's mark: a small outlined square and how many of the votes are judges' (rule 19) */
export function JMark({ j, long, cls }: { j: number; long?: boolean; cls?: string }) {
  if (!j) return null;
  return (
    <span className={clsx('inline-flex flex-none items-center gap-1 text-ink-2 tabular-nums', cls)} title={j + ' from judges'}>
      <i className="inline-block size-[7px] edge-ink-2" aria-hidden="true" />
      {long ? <span>{j} from judges</span> : <><span aria-hidden="true">{j}</span><span className="sr-only">{j} from judges</span></>}
    </span>
  );
}
/* what a row's label says: the place, and whether it is in the final */
export function placeLabel(W: CityWorld, o: Row): string {
  if (!W.votesOn) return 'Entry ' + String(o.a + 1).padStart(2, '0');
  const fin = o.rank <= EVENT.finalists;
  if (W.state === 'done') return fin ? ord(o.rank) + ' · finalist' : ord(o.rank);
  return o.rank === 1 ? 'Leading' : ord(o.rank);
}
/* the gap that matters: to the cut. Shown on the rows near it. */
export function Figures({ o, long, cls }: { o: Row; long?: boolean; cls?: string }) {
  const { W } = useCity(), v = o.v, j = o.j;
  if (!W.votesOn) return <span className={clsx('text-ink-2', cls)}>Arrived {local(W, o.arrive)}</span>;
  /* opened: the votes large, the judges' share small on its own line */
  if (long) return <span className="grid gap-y-1 tabular-nums"><span className={clsx('text-ink', cls)}>{plural(v, 'vote').replace(/^\d+/, fmtN(v))}</span><JMark j={j} long cls="text-sm" /></span>;
  return <span className={clsx('flex min-w-0 flex-nowrap items-baseline gap-x-2 overflow-hidden tabular-nums', cls)}><span className="whitespace-nowrap text-ink">{plural(v, 'vote').replace(/^\d+/, fmtN(v))}</span><JMark j={j} long={long} /></span>;
}
export function GapLine({ o, cls }: { o: Row; cls?: string }) {
  const { W, who } = useCity(), t = gapCut(W, o);
  /* a judge sees what it takes to reach 3rd in its place */
  if (who === 'judge' && W.voting && needFor3rd(W, o)) return null;
  return t ? <span className={clsx('truncate text-ink-2 tabular-nums', cls)}>{t}</span> : null;
}

/* ---------------- judge presses on a trace (a small square where a judge put votes) ---------------- */
export function JudgePresses({ o, V }: { o: Row; V: View }) {
  const { W } = useCity(), base = 92, top = 14;
  if (!W.votesOn) return null;
  const v0 = o.v - o.mine;
  return (
    <>
      {o.r.jv.filter((p) => p.n <= v0).map((p) => {
        const m = minOfVote(o.r, W.x, p.n), y = base - p.n / W.scaleV * (base - top);
        return <i key={p.n} className="cf-jp absolute z-2 size-[7px] -translate-x-1/2 -translate-y-1/2 bg-ground edge-ink-2 phone:hidden" style={{ left: V.x(m) + '%', top: y + '%' }} title={p.c + ' from a judge'} aria-hidden="true" />;
      })}
    </>
  );
}

/* ---------------- the action on a row: Vote, or a judge's stepper ---------------- */
export function needFor3rd(W: CityWorld, o: Row): number {
  const n = EVENT.finalists, third = W.ranked[n - 1];
  if (!third || o.rank <= n) return 0;
  return Math.max(0, third.v - o.v + (o.k < third.k ? 0 : 1));
}
export function Stepper({ o, cls }: { o: Row; cls?: string }) {
  const { W, judge: J } = useCity(), mine = J.put[o.p.id] || 0, on = W.voting;
  const B = 'grid size-8 cursor-pointer place-items-center text-md/none edge-line hover:bg-tint-2 aria-disabled:cursor-default aria-disabled:text-tint-3 aria-disabled:hover:bg-transparent pointer-coarse:size-11';
  const less = on && mine > 0, more = on && J.left > 0;
  return (
    <span className={clsx('relative z-3 inline-flex items-center justify-self-end phone:col-start-3 phone:row-[1/3] phone:self-center', cls)} role="group" aria-label={'Your judge votes for ' + o.p.name}>
      <button type="button" className={B} aria-disabled={!less} aria-label={'One fewer for ' + o.p.name} onClick={(e) => { e.preventDefault(); if (less) J.add(o.p.id, -1); }}>−</button>
      <span className="w-8 text-center text-sm font-medium tabular-nums">{mine}<span className="sr-only"> from you</span></span>
      <button type="button" className={B} aria-disabled={!more} aria-label={'One more for ' + o.p.name} onClick={(e) => { e.preventDefault(); if (more) J.add(o.p.id, 1); }}>+</button>
    </span>
  );
}
export function RowAct({ o, at }: { o: Row; at?: 'row' | 'table' | 'sheet' | 'free' }) {
  const { who } = useCity();
  return who === 'judge' ? <Stepper o={o} /> : <VoteBtn o={o} at={at} />;
}
/* the hint a judge reads on a row below the cut */
export function JudgeHint({ o, cls }: { o: Row; cls?: string }) {
  const { W, who, judge } = useCity();
  if (who !== 'judge' || !W.voting) return null;
  const need = needFor3rd(W, o);
  if (!need) return null;
  return <span className={clsx('truncate text-ink-2', cls)}>{need <= judge.left ? need + ' more puts it ' + ord(EVENT.finalists) : need + ' to reach ' + ord(EVENT.finalists)}</span>;
}

/* ---------------- a project's name, as the row's link ---------------- */
export function PName({ o, cls }: { o: Row; cls?: string }) {
  const { W, L } = useCity(), open = useOpenRow();
  return (
    <a className={clsx('stretched min-w-0 truncate outline-none', cls)} href={projectHref(W, o.p, L)} data-pid={o.p.id} data-row onClick={(e) => open(e, o.p.id)} title={o.p.name}>
      {o.p.name}{W.c.you === o.k ? <b className="ml-2 type-label text-accent" data-g="1">Yours</b> : null}
    </a>
  );
}
export function Rank({ o, cls }: { o: Row; cls?: string }) {
  const { W } = useCity(), g = o === W.lead && W.voting;
  return <span className={clsx('text-right tabular-nums', g ? 'text-accent' : 'text-ink-2', cls)}>{W.votesOn ? o.rank : ''}</span>;
}
export function usePlaceholders(): string {
  const { W } = useCity();
  return W.state === 'next' ? 'Entries open at ' + local(W, W.x.start) + '.' : W.state === 'build' ? 'No entries yet.' : 'No entries came in.';
}
export { view };

/* ---------------- your project: always in view (rule 24); sharing is its main action while building ---------------- */
export function youRow(W: CityWorld): Row | null {
  const y = W.you; if (!y) return null;
  return W.state === 'next' || (W.state === 'build' && y.a >= W.st.n!) ? null : y;
}
export function shareOf(W: CityWorld, o: Row): ShareProject {
  return { name: o.p.name, pitch: o.p.pitch, handle: o.p.handle, city: W.city.id, cityName: W.city.name, slug: slugOf(o.p), rank: W.votesOn ? o.rank : null, votes: W.votesOn ? o.v : null };
}
/* what a builder shares: their row in the city, or the entry they sent from this page (no rank until it is listed) */
export function useYours(): { row: Row | null; sp: ShareProject } | null {
  const { W, who, entry } = useCity(), y = youRow(W);
  if (who !== 'builder') return null;
  if (y) return { row: y, sp: shareOf(W, y) };
  if (entry) return { row: null, sp: { name: entry.name, pitch: entry.pitch, handle: entry.handle, city: entry.city, cityName: entry.cityName, slug: entry.slug, rank: null, votes: null } };
  return null;
}
export function YouBar() {
  const { W, who, share, setShare } = useCity(), yours = useYours(), y = yours?.row || null;
  if (who !== 'builder') return null;
  let line: ReactNode;
  if (W.state === 'next') line = <>Entries open at {local(W, W.x.start)}. Submit as soon as you have something to show.</>;
  else if (yours && !y) line = <><b className="font-medium">{yours.sp.name}</b> is in. Share it: anyone with the link can vote for it.</>;
  else if (!y) line = <>Your project is not in yet. Entries close at {local(W, W.x.buildEnd)}.</>;
  else line = <><b className="font-medium">{y.p.name}</b> is {W.votesOn ? ord(y.rank) + (y.rank <= EVENT.finalists ? (W.state === 'done' ? ', a finalist' : ', in the final for now') : '') : 'in'}{W.votesOn ? <span className="text-ink-2"> · {plural(y.v, 'vote')} · {gapCut(W, y)}</span> : null}</>;
  return (
    <div className="cf-dock mx-(--m) flex min-h-14 items-center gap-x-4 bg-ground px-4 py-2 edge-ink phone:mx-0 phone:flex-wrap phone:gap-y-2 phone:px-(--m)">
      <b className="type-label flex-none text-accent" data-g="1">Yours</b>
      <span className="min-w-0 flex-1 truncate text-sm phone:basis-[calc(100%-64px)] phone:whitespace-normal">{line}</span>
      {yours ? <button type="button" className={clsx('inline-flex h-9 flex-none cursor-pointer items-center px-4 text-sm font-medium pointer-coarse:h-11', W.state === 'build' ? 'bg-ink text-ground' : 'edge-line hover:bg-tint-1')} onClick={() => setShare(!share)} aria-expanded={share}>{share ? 'Close the share kit' : 'Share your project'}</button> : null}
    </div>
  );
}
/* the judge's bar: how many votes are left, and what a judge's vote is */
export function JudgeBar() {
  const { W, who, judge } = useCity();
  if (who !== 'judge') return null;
  return (
    <div className="cf-dock sticky bottom-0 z-20 mx-(--m) flex min-h-14 items-center gap-x-4 bg-ground px-4 py-2 edge-ink phone:mx-0 phone:flex-wrap phone:gap-y-1 phone:px-(--m)">
      <b className="type-label flex-none text-ink">Judge</b>
      <span className="text-sm font-medium tabular-nums" aria-live="polite">{judge.left} of {EVENT.judgeVotes} votes left</span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink-2 phone:basis-full phone:whitespace-normal">{W.voting ? 'Put several on one project if you like. They count with everyone’s and show on the row as a judge’s.' : W.state === 'next' ? 'Judging opens with building, at ' + local(W, W.x.start) + '.' : 'Voting has closed. Your votes are in the count.'}</span>
    </div>
  );
}

/* ---------------- the share kit: the link, a QR code, the card ---------------- */
function hexOf(css: string): string {
  const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); if (!x) return css;
  x.fillStyle = css; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data, h = (n: number) => n.toString(16).padStart(2, '0');
  return '#' + h(d[0]) + h(d[1]) + h(d[2]);
}
export function ShareKit() {
  const { W, share } = useCity(), forms = useForms(), seal = useSealCfg(), yours = useYours();
  const [card, setCard] = useState(''), [copied, setCopied] = useState<'' | 'ok' | 'no'>('');
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(''), 2000); return () => clearTimeout(t); }, [copied]);
  const sp = yours ? yours.sp : null, key = sp ? sp.slug + ':' + sp.rank + ':' + sp.votes : '';
  useEffect(() => {
    if (!sp) return;
    const cs = getComputedStyle(document.documentElement), g = (n: string) => hexOf(cs.getPropertyValue(n).trim() || '#000');
    /* the city's seal is first place's mark once voting has closed (rule 14), so only then is it on the card */
    let inner = ''; if (W.state === 'done' && sp.rank === 1) try { inner = toSvgString(forCity(seal, W.city.id, { size: 200 })).replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, ''); } catch { /* no seal */ }
    const u = URL.createObjectURL(new Blob([cardSVG(sp, { ground: g('--fm-card-ground'), ink: g('--fm-card-ink'), ink2: g('--fm-card-ink-2'), line: g('--fm-card-line'), green: g('--fm-card-green') }, inner)], { type: 'image/svg+xml' }));
    // the card's colours are CSS variables, which only the browser has, so the card is drawn after mount
    setCard(u); // eslint-disable-line react-hooks/set-state-in-effect
    return () => URL.revokeObjectURL(u);
  }, [key, W.state]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!share || !sp) return null;
  const url = projectURL(sp);
  return (
    <section className="cf-kit mx-(--m) grid grid-cols-[var(--c4)_minmax(0,1fr)] items-start gap-x-(--g) bg-ground p-4 edge-line phone:mx-0 phone:grid-cols-[minmax(0,1fr)] phone:gap-y-4 phone:px-(--m)" aria-label="Share your project">
      <div className="grid min-w-0 gap-y-3">
        <p className="type-label text-ink-2">The link</p>
        <p className="font-mono text-xs/[1.4] font-medium wrap-anywhere">{url.replace(/^https?:\/\//, '')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="inline-flex h-9 cursor-pointer items-center bg-ink px-4 text-sm font-medium text-ground pointer-coarse:h-11" onClick={() => { try { navigator.clipboard.writeText(url).then(() => setCopied('ok'), () => setCopied('no')); } catch { setCopied('no'); } }}>Copy link</button>
          {forms ? <button type="button" className="inline-flex h-9 cursor-pointer items-center px-4 text-sm font-medium edge-line hover:bg-tint-1 pointer-coarse:h-11" onClick={() => forms.share(sp)}>Open the share sheet</button> : null}
        </div>
        <p className="min-h-[1.4em] text-xs text-ink" aria-live="polite">{copied === 'ok' ? 'Copied.' : copied === 'no' ? 'Copy failed. Select the link above.' : ''}</p>
        <p className="text-xs text-ink-2">Votes from anyone with the link count once they confirm an email.</p>
      </div>
      <div className="grid min-w-0 gap-y-3">
        <p className="type-label text-ink-2">The card</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- a card drawn in the browser, as a blob URL */}
        {card ? <img className="block aspect-[1200/630] w-full edge-line" src={card} alt={cardAlt(sp)} /> : <span className="block aspect-[1200/630] w-full dash-frame" />}
      </div>
    </section>
  );
}

/* ---------------- a project, opened: the body every project view shares ---------------- */
export function ProjectBody({ o, layout, onClose }: { o: Row; layout: 'wide' | 'narrow'; onClose?: () => void }) {
  const { W } = useCity(), forms = useForms(), V = view(W), wide = layout === 'wide';
  return (
    <div className={clsx('grid min-w-0 gap-x-8', wide ? 'grid-cols-[7fr_5fr] items-start phone-window:grid-cols-[minmax(0,1fr)] phone-window:gap-y-4' : 'grid-cols-[minmax(0,1fr)] gap-y-4')}>
      <span className="block aspect-video"><Picture p={o.p} /></span>
      <div className="grid min-w-0 content-start gap-y-3">
        <p className="flex items-center justify-between gap-3">
          <span className={clsx('type-label', o === W.lead && W.voting ? 'text-accent' : 'text-ink-2')}>{W.city.name} · {placeLabel(W, o)}</span>
          {onClose ? <button type="button" className="-my-2.5 -mr-3 grid size-11 cursor-pointer place-items-center text-lg hover:bg-tint-1" data-close aria-label="Close" onClick={onClose}>×</button> : null}
        </p>
        <h2 className={clsx('leading-[1.05] font-regular tracking-d48 text-balance wrap-anywhere', wide ? 'text-d48 phone-window:text-h1' : 'text-h1')} id="cf-pv-h">{o.p.name}</h2>
        <p className="text-md leading-[1.45] text-pretty">{o.p.pitch}</p>
        <p className="text-sm text-ink-2">@{o.p.handle} · <a className="underline-link" href={'https://' + o.p.repo} target="_blank" rel="noopener">Repo</a> · <a className="underline-link" href={'https://' + o.p.demo} target="_blank" rel="noopener">Demo</a>{forms ? <> · <button type="button" className="cursor-pointer underline-link" onClick={() => forms.share(shareOf(W, o))}>Share</button></> : null}</p>
        <div className="flex items-center justify-between gap-4 pt-3 rule-t">
          <p className="grid min-w-0 gap-y-1 text-sm"><Figures o={o} long cls="text-h2 leading-none tracking-tight" /><GapLine o={o} /><JudgeHint o={o} /></p>
          <RowAct o={o} at="sheet" />
        </div>
      </div>
      <ProjectStrip o={o} V={V} cls={wide ? 'col-span-2 phone-window:col-span-1' : ''} />
    </div>
  );
}
/* the project's own line on the city's session, with the judge presses on it */
function ProjectStrip({ o, V, cls }: { o: Row; V: View; cls?: string }) {
  const { W } = useCity();
  return (
    <div className={clsx('relative mt-4 h-20 rule-b', cls)}>
      <span className="type-label absolute -top-1 left-0 text-ink-2">{W.city.name + ', ' + local(W, W.x.start) + '–' + local(W, W.x.end)}</span>
      <ProjectTrace o={o} V={V} big />
    </div>
  );
}
/* a trace, plus the judge presses */
export function ProjectTrace({ o, V, big }: { o: Row; V: View; big?: boolean }) {
  const { W, cfg: c } = useCity();
  return <span className="absolute inset-0 block"><Trace W={W} V={V} o={o} c={c} big={big} /><JudgePresses o={o} V={V} /></span>;
}
