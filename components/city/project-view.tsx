'use client';
import { useEffect, useLayoutEffect, useState } from 'react';
import { rowById } from '@/lib/city';
import { useCity, type PView } from './city-context';
import { ProjectBody } from './final-parts';

/* The three project views, on one <dialog> (the page's own open and close logic listens to it):
   side: a sheet from the right edge, five columns wide; the rows stay in sight on the left.
   centred: today's sheet, in the middle, over the page.
   row: the row opens in place (the direction draws it); the dialog opens without a backdrop and stays hidden, so
   closing still goes through it. A layout with its own pane passes mode 'hidden' too. */
export function ProjectView({ mode: force }: { mode?: PView | 'hidden' }) {
  const { W, openId, closeProject, dlgRef, pview } = useCity();
  const mode: PView | 'hidden' = force || (pview === 'row' ? 'hidden' : pview);
  useLayoutEffect(() => {
    const d = dlgRef.current; if (!d || openId == null || d.open) return;
    if (mode === 'hidden') d.show(); else { d.showModal(); d.querySelector<HTMLElement>('[data-close]')?.focus(); }
  }, [openId, mode, dlgRef]);
  /* a change of view closes what is open */
  useEffect(() => { const d = dlgRef.current; return () => { if (d && d.open) d.close(); }; }, [mode, dlgRef]);
  /* a dialog without a backdrop does not close on Escape by itself */
  useEffect(() => {
    if (mode !== 'hidden' || openId == null) return;
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') closeProject(); };
    document.addEventListener('keydown', on); return () => document.removeEventListener('keydown', on);
  }, [mode, openId, closeProject]);
  /* the last project stays in the sheet while it closes, so the exit shows what was open, not an empty sheet */
  const [last, setLast] = useState<number | null>(null);
  if (openId != null && openId !== last) setLast(openId);
  const shown = openId ?? last, o = shown != null ? rowById(W, shown) : undefined;
  return (
    <dialog ref={dlgRef} className="cf-pv" id="pv" data-view={mode} aria-labelledby="cf-pv-h" onClick={(e) => { if (e.target === dlgRef.current) closeProject(); }}>
      {o && mode !== 'hidden' ? <div className="px-8 pt-6 pb-8 phone-window:px-4 phone-window:pt-4"><ProjectBody o={o} layout={mode === 'centred' ? 'wide' : 'narrow'} onClose={closeProject} /></div> : null}
    </dialog>
  );
}
/* row: the open project, drawn in place under its row */
export function RowOpen({ id }: { id: number }) {
  const { W, closeProject } = useCity(), o = rowById(W, id);
  if (!o) return null;
  return <li className="cf-open relative z-5 bg-ground px-0 pt-6 pb-8 rule-t" aria-label={o.p.name}><ProjectBody o={o} layout="wide" onClose={closeProject} /></li>;
}
