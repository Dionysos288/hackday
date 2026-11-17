'use client';
import { useEffect, useLayoutEffect } from 'react';
import clsx from 'clsx';
import { fmtN, local, ord, rowById, slotText, slugOf, tz, view } from '@/lib/city';
import { Picture } from '@/components/pictures/picture';
import { IconX } from '@/components/forms/sheet';
import { useForms } from '@/components/forms/forms-provider';
import { useCity, useOrder } from './city-context';
import { LABEL } from '@/components/shared/page-parts';
import { NowLine, SessionBar, Ticks, Trace, VoteBtn } from './sheet-parts';

/* the name and the vote count: display type at 48 */
const BIG = 'text-d48 leading-none font-regular tracking-d48';
const LINK = 'inline-flex min-h-11 items-center underline-link';
const NAV = 'grid min-h-14 cursor-pointer gap-y-0.5 px-3 py-2 text-md font-medium edge-line disabled:cursor-default disabled:text-tint-3 enabled:hover:bg-tint-1';

/* A project, opened: a real <dialog> over the page. Its picture, pitch, links and votes, its line on the city's
   strip, and Previous and Next in the order the page lists them. V votes, Escape closes. */
export function ProjectSheet() {
  const { W, cfg: c, openId, openProject, closeProject, dlgRef } = useCity(), forms = useForms(), order = useOrder();
  /* open when a project is chosen; the close button takes focus */
  useLayoutEffect(() => {
    const d = dlgRef.current; if (!d || openId == null || d.open) return;
    d.showModal(); d.querySelector<HTMLElement>('[data-close]')?.focus();
  }, [openId, dlgRef]);
  /* development double mount: a dialog left open by the first mount */
  useEffect(() => { const d = dlgRef.current; return () => { if (d && d.open) d.close(); }; }, [dlgRef]);
  const o = openId != null ? rowById(W, openId) : undefined;
  let body = null;
  if (o) {
    const V = view(W), t = slotText(W, o), ix = order.indexOf(o.p.id), p = o.p;
    const prev = ix > 0 ? order[ix - 1] : null, next = ix >= 0 && ix < order.length - 1 ? order[ix + 1] : null;
    const name = (pid: number | null) => (pid == null ? '' : rowById(W, pid)?.p.name || '');
    const share = () => { if (forms) forms.share({ name: p.name, pitch: p.pitch, handle: p.handle, city: W.city.id, cityName: W.city.name, slug: slugOf(p), rank: W.votesOn ? o.rank : null, votes: W.votesOn ? o.v : null }); };
    body = (
      <div className="px-8 pt-6 pb-8 phone-window:px-4 phone-window:pt-4 phone-window:pb-[calc(var(--s-5)+env(safe-area-inset-bottom))]">
        <header className="mb-4 flex items-center justify-between">
          <p className={LABEL}>{W.city.name + (W.votesOn ? ' · ' + ord(o.rank) + ' of ' + W.arrived.length : W.state === 'build' ? ' · Entry ' + String(o.a + 1).padStart(2, '0') : '')}</p>
          <button type="button" className="-my-2.5 -mr-3 grid size-11 cursor-pointer place-items-center hover:bg-tint-1" data-close aria-label="Close" onClick={closeProject}><IconX className="size-4 fill-none stroke-ink stroke-[1.5]" /></button>
        </header>
        <div className="grid grid-cols-[7fr_5fr] items-start gap-x-8 phone-window:grid-cols-[minmax(0,1fr)] phone-window:gap-y-4">
          <span className="block aspect-video"><Picture p={p} /></span>
          <div className="grid min-w-0 gap-y-3">
            <h2 className={clsx(BIG, 'text-balance phone-window:text-h1')} id="pv-h">{p.name}</h2><p className="text-lg leading-[1.4] text-pretty">{p.pitch}</p>
            <p className="text-sm text-ink-2">@{p.handle}</p>
            <p className="flex gap-4 text-sm"><a className={LINK} href={'https://' + p.repo} target="_blank" rel="noopener">Repo</a><a className={LINK} href={'https://' + p.demo} target="_blank" rel="noopener">Demo</a>
              {forms ? <button type="button" className="inline-flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink underline decoration-(length:--hair) underline-offset-3 hover:decoration-(length:--line-thin)" data-share={p.id} onClick={share}>Share this project</button> : null}</p>
            <div className="flex items-center justify-between gap-4 pt-3 rule-t"><p className="grid text-sm text-ink-2"><b className={clsx(BIG, 'text-ink tabular-nums')}>{W.votesOn ? fmtN(o.v) : '–'}</b> {o.v === 1 ? 'vote' : 'votes'}<span className="mt-1">{W.votesOn ? t.b : 'Arrived ' + local(W, o.arrive)}</span></p><VoteBtn o={o} at="sheet" /></div>
          </div>
        </div>
        <div className="pv-strip relative mt-18 grid">
          <span className={clsx(LABEL, 'absolute top-[calc(var(--s-1)-var(--s-7))] left-0')}>{W.city.name + ', ' + local(W, W.x.start) + '–' + local(W, W.x.end) + ' ' + tz(W.off)}</span>
          <span className="cl-axis relative block h-(--headh)"><Ticks W={W} V={V} /><SessionBar W={W} V={V} /></span>
          <span className="cl-strip pv-tr h-24 rule-b"><Trace W={W} V={V} o={o} c={c} big /></span>
          <NowLine W={W} V={V} cls="left-0 h-[calc(var(--headh)+96px)] w-full" />
        </div>
        <nav className="mt-6 grid grid-cols-[1fr_1fr] gap-x-(--g)" aria-label="Other projects">
          <button type="button" className={clsx(NAV, 'justify-items-start text-left')} data-go={prev == null ? '' : prev} disabled={prev == null} onClick={() => { if (prev != null) openProject(prev); }}><span className={LABEL}>Previous</span>{name(prev)}</button>
          <button type="button" className={clsx(NAV, 'justify-items-end text-right')} data-go={next == null ? '' : next} disabled={next == null} onClick={() => { if (next != null) openProject(next); }}><span className={LABEL}>Next</span>{name(next)}</button>
        </nav>
      </div>
    );
  }
  /* a press on the backdrop closes it */
  return <dialog ref={dlgRef} className="pv" id="pv" aria-labelledby="pv-h" data-id={openId ?? undefined} onClick={(e) => { if (e.target === dlgRef.current) closeProject(); }}>{body}</dialog>;
}
