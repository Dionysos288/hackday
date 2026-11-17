'use client';
import { Fragment } from 'react';
import clsx from 'clsx';
import { EVENT } from '@/lib/day-data';
import { sheetLabel, sheetList, view, type Row } from '@/lib/city';
import { Picture } from '@/components/pictures/picture';
import { useCity } from '@/components/city/city-context';
import { NowLine, SheetHead, useRowAttrs } from '@/components/city/sheet-parts';
import { CutRule, Figures, GapLine, JudgeHint, LabTrace, PName, Rank, RowAct, placeLabel, useLabCity, usePlaceholders } from './parts';
import { FinalFoot } from '@/components/city/tower-final';
import { RowOpen } from '@/components/city/project-view';

/* Stage: the top 3 are the page. Three wide cells, each with its picture, place, name, votes (judges marked), its
   gap to the cut, its own line on the session and its action. Under the cut, the rest as compact rows on the strip. */
function Cell({ o, j }: { o: Row | null; j: number }) {
  const { W } = useCity(), ph = usePlaceholders();
  if (!o) return <li className="cf-cell cf-ecell grid content-start gap-y-3 pt-3 rule-t"><span className="cf-k type-label text-ink-3">{j + 1}</span><span className="cf-pic block aspect-video dash-frame" /><span className="cf-nm text-sm text-ink-2">{j === 0 ? ph : ''}</span></li>;
  const g = o === W.lead && W.voting;
  return (
    <li className={clsx('cf-cell relative grid min-w-0 content-start gap-y-2 pt-3 hover:bg-tint-1', j === 0 ? 'rule-t-thick' : 'rule-t', W.c.you === o.k && 'is-you')} data-pid-cell={o.p.id}>
      <span className={clsx('cf-k type-label flex items-center gap-1.5', g ? 'text-accent' : 'text-ink-2')}>{g ? <i className="size-1.5 bg-accent" data-g="1" /> : null}{placeLabel(W, o)}</span>
      <span className="cf-pic block aspect-video"><Picture p={o.p} /></span>
      <PName o={o} cls={clsx('cf-cname cf-nm mt-1 block tracking-d48', j === 0 ? 'font-medium' : 'font-regular')} />
      <span className="cf-fg grid min-h-10 content-start text-sm"><Figures o={o} long /><span className="grid text-xs leading-[1.4]"><JudgeHint o={o} /><GapLine o={o} /></span></span>
      <span className="cf-tr relative block h-12 rule-b"><LabTrace o={o} V={view(W)} /></span>
      <span className="cf-act flex justify-end pt-1"><RowAct o={o} at="free" /></span>
    </li>
  );
}
export function Stage() {
  const { W, cfg: c, shownIds, openId } = useCity(), L = useLabCity(), V = view(W), list = sheetList(W, shownIds, c.top), attrs = useRowAttrs();
  const top = [0, 1, 2].map((j) => list[j] || null), rest = list.slice(EVENT.finalists);
  return (
    <section className="cl-sheet cf-stage relative px-(--m)" id="sheet" aria-label={sheetLabel(W, c)}>
      <ol className="cf-podium relative grid grid-cols-3 gap-x-(--g) pb-6 phone:grid-cols-1 phone:gap-y-6">
        {top.map((o, j) => <Cell key={o ? o.p.id : 'e' + j} o={o} j={j} />)}
        {W.votesOn && W.arrived.length ? <CutRule cls="right-0" /> : null}
      </ol>
      {L.view === 'row' && openId != null && top.some((o) => o && o.p.id === openId) ? <ol><RowOpen id={openId} /></ol> : null}
      <div className="relative mt-8">
        <SheetHead W={W} V={V} />
        <ol className="cl-rows relative">
          {rest.map((o, j) => o ? (
            <Fragment key={o.p.id}>
              <li {...attrs(o, clsx('cf-crow relative grid items-center gap-x-(--g) hover:bg-tint-1', W.c.you === o.k && 'is-you'), j)}>
                <span className="flex min-w-0 items-center gap-3 text-xl"><Rank o={o} cls="w-[1.6em] flex-none" /><PName o={o} /></span>
                <span className="cl-strip relative block h-full"><LabTrace o={o} V={V} /></span>
                <span className="grid min-w-0 text-sm leading-[1.35]"><Figures o={o} /><span className="text-xs"><JudgeHint o={o} />{L.who === 'judge' ? null : <GapLine o={o} />}</span></span>
                <RowAct o={o} at="table" />
              </li>
              {L.view === 'row' && openId === o.p.id ? <RowOpen id={o.p.id} /> : null}
            </Fragment>
          ) : <li key={'e' + j} className="cf-crow h-(--rowh) rule-t" />)}
        </ol>
        <NowLine W={W} V={V} cls="left-[var(--nameW)] ml-(--g) h-[calc(var(--headh)+var(--rowh)*var(--n))] w-(--stripW) phone:hidden" />
      </div>
      <FinalFoot />
    </section>
  );
}
