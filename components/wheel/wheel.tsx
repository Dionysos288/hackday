'use client';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { MONO, SANS, type WheelCfg, type WheelMark } from './config';
import { createWheel, type WheelCity, type WheelEngine, type WheelFlow } from './engine';
import { mountDotGlobes } from './dot-globes';
import { HackMark } from './mark';
import { BuilderLogo } from './builder-logo';
import { EVENT } from '@/lib/day-data';
import { SupabaseMark } from '@/components/shared/supabase-mark';
import type { WheelStatus } from './click';
import './wheel.css';

/* The city wheel as a page: the canvas, the mark, the link with its small globe, and the facts of the active city as
   a row of cells before its name. The screen lines are drawn over all of it, with holes for the two globes.
   A screen reader gets the cities as a table, and hears the city once the wheel stops on it. */

export type WheelFact = WheelCity & { id: string; session: string; count: string; href: string; action: string; soon?: string;
  /* a page's own press in place of the link (the preview: the person's own city opens their account) */
  press?: () => void };
/* hack: the mark alone; both: the Supabase mark beside it; name: the mark with the event's name written beside it;
   builder: the pixel globe from the Builder Day logo, with the name in the page's own face */
export type MarkMode = WheelMark;

/* the mark and the name, as the mode says: the wheel's own top line and the preview's header both draw it */
export function MarkFace({ mark, id }: { mark: MarkMode; id?: string }) {
  if (mark === 'builder') return <><BuilderLogo className="wh-builder" /><span className="wh-name">{EVENT.name}</span></>;
  return <>{mark === 'both' ? <SupabaseMark /> : null}<HackMark id={id} label={mark === 'both' ? EVENT.name : mark === 'name' ? '' : EVENT.short} />{mark === 'name' ? <span className="wh-name">{EVENT.name}</span> : null}</>;
}
export const STATUS_LABEL: Record<WheelStatus, string> = { open: 'Open', nearing: 'Nearing capacity', full: 'Waiting list' };

/* each state has its words and its own shape, a ring that fills up, so it does not read by colour alone */
export function StatusIcon({ status }: { status: WheelStatus }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      {status === 'full' ? <circle cx="6" cy="6" r="5" fill="currentColor" /> : <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {status === 'nearing' ? <path d="M6 1.75a4.25 4.25 0 0 1 0 8.5z" fill="currentColor" /> : null}
    </svg>
  );
}

export function wheelVars(c: WheelCfg): CSSProperties {
  return {
    '--wh-paper': `rgb(${c.paper} ${c.paper + 1} ${c.paper + 1})`, '--wh-line-a': c.lineAlpha, '--wh-line-p': c.linePeriod + 'px',
    '--wh-sans': SANS[c.font], '--wh-mono': MONO[c.font],
  } as CSSProperties;
}

/* flow: the wheel as the first part of a page that scrolls (off unless given; see WheelFlow in engine.ts). The page
   draws the mark (its header) and the table of cities (its board), so the wheel leaves both out; the globe is a
   slider a keyboard can turn. The options are read every frame, so a page may change them in place. Changing
   `fixed` needs a new wheel (give it a new key). */
export function Wheel({ cities, cfg, start = 0, noGl = false, cells = true, mark = 'hack', date, caption, engineRef, onCity, foot, children, className, flow }: {
  cities: WheelFact[]; cfg: WheelCfg; start?: number; noGl?: boolean; cells?: boolean; mark?: MarkMode; date: string; caption: string; foot?: ReactNode;
  engineRef?: RefObject<WheelEngine | null>; onCity?: (i: number) => void; children?: ReactNode; className?: string; flow?: WheelFlow;
}) {
  const pin = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), cellsEl = useRef<HTMLDListElement>(null);
  const footEl = useRef<HTMLDivElement>(null), grip = useRef<HTMLSpanElement>(null), flowRef = useRef(flow);
  useEffect(() => { if (flowRef.current && flow) Object.assign(flowRef.current, flow); }, [flow]);
  const lens = useRef<HTMLSpanElement>(null), cta = useRef<HTMLAnchorElement & HTMLButtonElement>(null), eng = useRef<WheelEngine | null>(null);
  const [cur, setCur] = useState(start), [said, setSaid] = useState('');
  const onCityRef = useRef(onCity);
  useEffect(() => { onCityRef.current = onCity; }, [onCity]);
  const first = useRef({ cfg, cities, start });

  useEffect(() => {
    if (!pin.current || !canvas.current) return;
    const e = createWheel({ pin: pin.current, canvas: canvas.current, cells: cellsEl.current, foot: footEl.current, grip: grip.current,
      /* read when used: the link and its lens are new elements when the city's press changes (a link or a button) */
      get lens() { return lens.current; }, get cta() { return cta.current; } },
      { ...first.current, noGl, onCity: (i) => { setCur(i); onCityRef.current?.(i); }, flow: flowRef.current });
    eng.current = e; if (engineRef) engineRef.current = e;
    return () => { e.destroy(); eng.current = null; if (engineRef) engineRef.current = null; };
  }, [noGl, engineRef]);
  useEffect(() => { eng.current?.setCfg(cfg); }, [cfg]);
  /* the text globe's small globe by the link; in a page's flow the page draws every small globe itself */
  const text = cfg.globe === 'ascii', hasFlow = !!flow;
  useEffect(() => (text && !hasFlow && pin.current ? mountDotGlobes(pin.current, cfg) : undefined), [text, hasFlow, cfg]);
  useEffect(() => { eng.current?.setCities(cities); }, [cities]);
  useEffect(() => { eng.current?.jump(start); }, [start]);

  const city = cities[cur] ?? cities[0];
  const dot = text ? { 'data-dot': '', 'data-lat': city.lat, 'data-lon': city.lon } : {};
  /* the cells' and the link's words changed: measure them again before the next frame */
  useLayoutEffect(() => { eng.current?.measure(); }, [cur, cities, cells, cfg.font, mark, foot]);
  /* a screen reader hears the city after the wheel comes to rest, not each city on the way */
  useEffect(() => {
    const t = window.setTimeout(() => setSaid(`${city.name}, ${city.session}, ${city.count}, ${STATUS_LABEL[city.status]}`), cfg.statusDelay);
    return () => window.clearTimeout(t);
  }, [city, cfg.statusDelay]);

  return (
    <div ref={pin} className={'wh-pin' + (flow ? ' wh-flow' + (flow.fixed ? ' wh-fixed' : '') : '') + (className ? ' ' + className : '')} style={flow ? { ...wheelVars(cfg), '--wh-peek': flow.peek + 'px' } as CSSProperties : wheelVars(cfg)}>
      {/* the text globe is a picture of its own: one image, named by the city it is turned to */}
      <canvas key={noGl ? '2d' : 'gl'} ref={canvas} className="wh-canvas" {...(text ? { role: 'img', 'aria-label': `The world drawn in characters, turned to ${city.name}` } : { 'aria-hidden': true })} />
      {flow ? null : <h1 className="wh-wordmark" data-mark={mark}><MarkFace mark={mark} /></h1>}
      {flow ? <span ref={grip} className="wh-grip" role="slider" tabIndex={0} aria-label="City wheel: the left and right arrows turn it" aria-valuemin={1} aria-valuemax={cities.length} aria-valuenow={cur + 1} aria-valuetext={city.name} /> : null}
      <div ref={footEl} className="wh-foot">
        {city.press ? (
          /* a press of the page's own (the person's account) is a button; the lens stays one element, so the engine's measure holds */
          <button ref={cta} type="button" className="wh-cta" aria-haspopup="dialog" onClick={city.press}>
            <span ref={lens} className="wh-lens" aria-hidden="true" {...dot} />
            <span className="wh-cta-text"><span className="wh-cta-action">{city.action}</span> <span>{date}</span></span>
          </button>
        ) : (
          <a ref={cta} className="wh-cta" href={city.href}>
            <span ref={lens} className="wh-lens" aria-hidden="true" {...dot} />
            <span className="wh-cta-text"><span className="wh-cta-action">{city.action}</span> <span>{date}</span></span>
          </a>
        )}
        {foot}
      </div>
      {cells ? (
        <dl ref={cellsEl} className="wh-cells" data-status={city.status}>
          <div className="sr-only"><dt>City</dt><dd>{city.name}</dd></div>
          <div><dt className="sr-only">Session, local time</dt><dd>{city.session}</dd></div>
          <div><dt className="sr-only">People</dt><dd>{city.count}</dd></div>
          {city.soon ? <div className="wh-soon"><dt className="sr-only">Opens</dt><dd>{city.soon}</dd></div> : null}
          <div className="wh-status"><dt className="sr-only">Status</dt><StatusIcon status={city.status} /><dd>{STATUS_LABEL[city.status]}</dd></div>
        </dl>
      ) : null}
      <p className="sr-only" role="status">{said}</p>
      {flow ? null : (
        <table className="sr-only">
          <caption>{caption}</caption>
          <thead><tr><th scope="col">City</th><th scope="col">Session, local time</th><th scope="col">People</th><th scope="col">Status</th></tr></thead>
          <tbody>{cities.map((c) => <tr key={c.id}><th scope="row">{c.name}</th><td>{c.session}</td><td>{c.count}</td><td>{STATUS_LABEL[c.status]}</td></tr>)}</tbody>
        </table>
      )}
      {children}
    </div>
  );
}
