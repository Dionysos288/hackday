'use client';
import { useEffect, useLayoutEffect } from 'react';
import { fmtN, local, ord, rowById, slotText, slugOf, tz, view } from '@/lib/city';
import { Picture } from '@/components/pictures/picture';
import { IconX } from '@/components/forms/sheet';
import { useForms } from '@/components/forms/forms-provider';
import { useCity, useOrder } from './city-context';
import { NowLine, SessionBar, Ticks, Trace, VoteBtn } from './sheet-parts';

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
      <div className="pv-in">
        <header className="pv-top">
          <p className="pv-k">{W.city.name + (W.votesOn ? ' · ' + ord(o.rank) + ' of ' + W.arrived.length : W.state === 'build' ? ' · Entry ' + String(o.a + 1).padStart(2, '0') : '')}</p>
          <button type="button" className="pv-x" data-close aria-label="Close" onClick={closeProject}><IconX /></button>
        </header>
        <div className="pv-body">
          <span className="pv-pic"><Picture p={p} /></span>
          <div className="pv-tx">
            <h2 className="pv-n" id="pv-h">{p.name}</h2><p className="pv-p">{p.pitch}</p>
            <p className="pv-by">@{p.handle}</p>
            <p className="pv-l"><a href={'https://' + p.repo} target="_blank" rel="noopener">Repo</a><a href={'https://' + p.demo} target="_blank" rel="noopener">Demo</a>
              {forms ? <button type="button" className="pv-share" data-share={p.id} onClick={share}>Share this project</button> : null}</p>
            <div className="pv-v"><p><b>{W.votesOn ? fmtN(o.v) : '–'}</b> {o.v === 1 ? 'vote' : 'votes'}<span>{W.votesOn ? t.b : 'Arrived ' + local(W, o.arrive)}</span></p><VoteBtn o={o} cls="vb-l" /></div>
          </div>
        </div>
        <div className="pv-strip">
          <span className="pv-sk">{W.city.name + ', ' + local(W, W.x.start) + '–' + local(W, W.x.end) + ' ' + tz(W.off)}</span>
          <span className="cl-axis"><Ticks W={W} V={V} /><SessionBar W={W} V={V} /></span>
          <span className="cl-strip pv-tr"><Trace W={W} V={V} o={o} c={c} big /></span>
          <NowLine W={W} V={V} />
        </div>
        <nav className="pv-nav" aria-label="Other projects">
          <button type="button" data-go={prev == null ? '' : prev} disabled={prev == null} onClick={() => { if (prev != null) openProject(prev); }}><span>Previous</span>{name(prev)}</button>
          <button type="button" data-go={next == null ? '' : next} disabled={next == null} onClick={() => { if (next != null) openProject(next); }}><span>Next</span>{name(next)}</button>
        </nav>
      </div>
    );
  }
  /* a press on the backdrop closes it */
  return <dialog ref={dlgRef} className="pv" id="pv" aria-labelledby="pv-h" data-id={openId ?? undefined} onClick={(e) => { if (e.target === dlgRef.current) closeProject(); }}>{body}</dialog>;
}
