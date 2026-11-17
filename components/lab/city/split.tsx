'use client';
import clsx from 'clsx';
import { EVENT } from '@/lib/day-data';
import { rowById, sheetLabel, sheetList, view } from '@/lib/city';
import { useCity } from '@/components/city/city-context';
import { useRowAttrs } from '@/components/city/sheet-parts';
import { CutRule, Figures, GapLine, JudgeHint, LabTrace, PName, ProjectBody, Rank, RowAct, useLabCity, usePlaceholders } from './parts';
import { FinalFoot } from '@/components/city/tower-final';

/* Split: the ranking on the left, one project open on the right, always. The open one is the leader until you pick
   another; on a phone the pane opens over the list. The strip shrinks to a small trace per row. */
export function Split() {
  const { W, cfg: c, shownIds, openId, closeProject } = useCity(), L = useLabCity(), V = view(W), list = sheetList(W, shownIds, c.top), attrs = useRowAttrs(), ph = usePlaceholders();
  const sel = (openId != null ? rowById(W, openId) : null) || W.lead || W.arrived[0] || null;
  return (
    <section className="cl-sheet cf-split relative grid grid-cols-[var(--c7)_var(--c5)] items-start gap-x-(--g) px-(--m)" id="sheet" aria-label={sheetLabel(W, c)}>
      <div className="min-w-0">
        <p className="cf-shead grid h-10 items-end gap-x-(--g) pb-2 type-label text-ink-2"><span>{W.votesOn ? (W.state === 'done' ? 'Final order' : 'By votes') : 'Newest first'}</span><span className="phone:hidden">Votes since {W.state === 'next' ? 'the start' : 'it arrived'}</span><span /><span /></p>
        <ol className="relative">
          {list.map((o, j) => o ? (
            <li key={o.p.id} {...attrs(o, clsx('cf-srow relative grid items-center gap-x-(--g) rule-t hover:bg-tint-1', sel && sel.p.id === o.p.id && 'is-sel', W.c.you === o.k && 'is-you'), j)}>
              <span className="flex min-w-0 items-center gap-3 text-xl"><Rank o={o} cls="w-[1.6em] flex-none" /><PName o={o} cls={o === W.lead ? 'font-medium' : ''} /></span>
              <span className="relative block h-10 phone:hidden"><LabTrace o={o} V={V} /></span>
              <span className="grid min-w-0 text-sm leading-[1.35]"><Figures o={o} /><span className="text-xs"><JudgeHint o={o} />{L.who === 'judge' ? null : <GapLine o={o} />}</span></span>
              <RowAct o={o} at="table" />
              {j === EVENT.finalists - 1 ? <CutRule cls="right-0" /> : null}
            </li>
          ) : <li key={'e' + j} className="cf-srow rule-t">{j === 0 ? <span className="text-sm text-ink-2">{ph}</span> : null}</li>)}
        </ol>
        <FinalFoot />
      </div>
      <aside className={clsx('cf-pane sticky top-4 min-w-0 pt-10', openId != null && 'is-open')} aria-label="The open project">
        {sel ? <ProjectBody o={sel} layout="narrow" onClose={openId != null ? closeProject : undefined} /> : <span className="block aspect-video dash-frame" />}
      </aside>
    </section>
  );
}
