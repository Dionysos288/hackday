'use client';
import type { CSSProperties } from 'react';
import clsx from 'clsx';
import { r2, rowCls, sheetLabel, sheetList, view } from '@/lib/city';
import { useCity } from './city-context';
import { Cut, FlashTick, NameLink, NowLine, Placeholder, ROW, SealMark, SheetFoot, SheetHead, Slot, Tie, Trace, VoteBtn, useRowAttrs } from './sheet-parts';

/* The tower: the top ten on the session strip. Each row is name | strip | slot; while voting, the order follows the
   votes (batched, held under the pointer); while building, the newest entry is on top. */
export function Tower() {
  const { W, cfg: c, shownIds } = useCity(), V = view(W), list = sheetList(W, shownIds, c.top), attrs = useRowAttrs();
  return (
    <section className="cl-sheet cl-tower relative px-(--m)" id="sheet" aria-label={sheetLabel(W, c)}>
      <SheetHead W={W} V={V} />
      <ol className="cl-rows relative">
        {list.map((o, j) => {
          if (!o) return <Placeholder key={'e' + j} j={j} />;
          return (
            <li key={'p' + o.p.id} {...attrs(o, clsx(rowCls(W, o), ROW), j)}>
              <NameLink o={o} />
              <span className="cl-strip"><Trace W={W} V={V} o={o} c={c} /><FlashTick W={W} V={V} o={o} /></span>
              <Slot o={o} c={c} /><VoteBtn o={o} /><Tie o={o} /><SealMark o={o} c={c} /><Cut c={c} j={j} />
            </li>
          );
        })}
      </ol>
      <NowLine W={W} V={V} cls="left-[calc(var(--m)+var(--nameW)+var(--g))] h-[calc(var(--headh)+var(--rowh)*var(--top))] w-(--stripW) phone:hidden" />
      <i className="cl-bound pointer-events-none absolute top-[calc(var(--headh)-24px)] left-[calc(var(--m)+var(--nameW)+var(--g)+var(--stripW)*var(--bx))] h-[calc(24px+var(--rowh)*var(--top))] w-(--hair) bg-ink-3 phone:hidden" style={{ '--bx': r2(V.x(W.x.buildEnd) / 100) } as CSSProperties} aria-hidden="true" />
      <SheetFoot c={c} />
    </section>
  );
}
