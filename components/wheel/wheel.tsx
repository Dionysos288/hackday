'use client';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { MONO, SANS, type WheelCfg } from './config';
import { createWheel, type WheelCity, type WheelEngine } from './engine';
import { HackMark } from './mark';
import { SupabaseMark } from '@/components/shared/supabase-mark';
import type { WheelStatus } from './click';
import './wheel.css';

/* The city wheel as a page: the canvas, the mark, the link with its small globe, and the facts of the active city as
   a row of cells before its name. The screen lines are drawn over all of it, with holes for the two globes.
   A screen reader gets the cities as a table, and hears the city once the wheel stops on it. */

export type WheelFact = WheelCity & { id: string; session: string; count: string; href: string; action: string; soon?: string };
/* hack: the mark alone; both: the Supabase mark beside it; name: the mark with the event's name written beside it */
export type MarkMode = 'hack' | 'both' | 'name';
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

export function Wheel({ cities, cfg, start = 0, noGl = false, cells = true, mark = 'hack', date, caption, engineRef, onCity, foot, children, className }: {
  cities: WheelFact[]; cfg: WheelCfg; start?: number; noGl?: boolean; cells?: boolean; mark?: MarkMode; date: string; caption: string; foot?: ReactNode;
  engineRef?: RefObject<WheelEngine | null>; onCity?: (i: number) => void; children?: ReactNode; className?: string;
}) {
  const pin = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), cellsEl = useRef<HTMLDListElement>(null);
  const lens = useRef<HTMLSpanElement>(null), cta = useRef<HTMLAnchorElement>(null), eng = useRef<WheelEngine | null>(null);
  const [cur, setCur] = useState(start), [said, setSaid] = useState('');
  const onCityRef = useRef(onCity);
  useEffect(() => { onCityRef.current = onCity; }, [onCity]);
  const first = useRef({ cfg, cities, start });

  useEffect(() => {
    if (!pin.current || !canvas.current) return;
    const e = createWheel({ pin: pin.current, canvas: canvas.current, cells: cellsEl.current, lens: lens.current, cta: cta.current },
      { ...first.current, noGl, onCity: (i) => { setCur(i); onCityRef.current?.(i); } });
    eng.current = e; if (engineRef) engineRef.current = e;
    return () => { e.destroy(); eng.current = null; if (engineRef) engineRef.current = null; };
  }, [noGl, engineRef]);
  useEffect(() => { eng.current?.setCfg(cfg); }, [cfg]);
  useEffect(() => { eng.current?.setCities(cities); }, [cities]);
  useEffect(() => { eng.current?.jump(start); }, [start]);

  const city = cities[cur] ?? cities[0];
  /* the cells' and the link's words changed: measure them again before the next frame */
  useLayoutEffect(() => { eng.current?.measure(); }, [cur, cities, cells, cfg.font, mark, foot]);
  /* a screen reader hears the city after the wheel comes to rest, not each city on the way */
  useEffect(() => {
    const t = window.setTimeout(() => setSaid(`${city.name}, ${city.session}, ${city.count}, ${STATUS_LABEL[city.status]}`), cfg.statusDelay);
    return () => window.clearTimeout(t);
  }, [city, cfg.statusDelay]);

  return (
    <div ref={pin} className={'wh-pin' + (className ? ' ' + className : '')} style={wheelVars(cfg)}>
      <canvas key={noGl ? '2d' : 'gl'} ref={canvas} className="wh-canvas" aria-hidden="true" />
      <h1 className="wh-wordmark" data-mark={mark}>{mark === 'both' ? <SupabaseMark /> : null}<HackMark label={mark === 'both' ? 'Supabase HackDay' : mark === 'name' ? '' : 'HackDay'} />{mark === 'name' ? <span className="wh-name">Supabase Hackday</span> : null}</h1>
      <div className="wh-foot">
        <a ref={cta} className="wh-cta" href={city.href}>
          <span ref={lens} className="wh-lens" aria-hidden="true" />
          <span className="wh-cta-text"><span className="wh-cta-action">{city.action}</span> <span>{date}</span></span>
        </a>
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
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead><tr><th scope="col">City</th><th scope="col">Session, local time</th><th scope="col">People</th><th scope="col">Status</th></tr></thead>
        <tbody>{cities.map((c) => <tr key={c.id}><th scope="row">{c.name}</th><td>{c.session}</td><td>{c.count}</td><td>{STATUS_LABEL[c.status]}</td></tr>)}</tbody>
      </table>
      {children}
    </div>
  );
}
