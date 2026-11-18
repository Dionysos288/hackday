'use client';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { animate } from 'motion/react';
import { MONO, SANS, type WheelCfg } from './config';
import { createWheel, type WheelCity, type WheelEngine } from './engine';
import { HackMark } from './mark';
import { BuilderLogo } from './builder-logo';
import { SupabaseMark } from '@/components/shared/supabase-mark';
import type { WheelStatus } from './click';
import './wheel.css';

/* The city wheel as a page: the canvas, the mark, the link with its small globe, and the facts of the active city as
   a row of cells before its name. The screen lines are drawn over all of it, with holes for the two globes.
   A screen reader gets the cities as a table, and hears the city once the wheel stops on it. */

export type WheelFact = WheelCity & { id: string; session: string; count: string; href: string; action: string; soon?: string };
/* hack: the mark alone; both: the Supabase mark beside it; name: the mark with the event's name written beside it;
   builder: the Builder Day pixel globe and the name, in the brand green */
export type MarkMode = 'hack' | 'both' | 'name' | 'builder';
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

/* The Luma link as a pill. When its words change they fade in, and the pill eases to their width: the real width, so
   nothing is stretched. With reduced motion, both just change. */
const PILL_SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 } as const;
function Pill({ ref, href, text }: { ref: RefObject<HTMLAnchorElement | null>; href: string; text: string }) {
  const words = useRef<HTMLSpanElement>(null), sized = useRef(false);
  const [seen, setSeen] = useState({ text, n: 0 });
  if (seen.text !== text) setSeen({ text, n: seen.n + 1 });
  useLayoutEffect(() => {
    const a = ref.current, w = words.current; if (!a || !w) return;
    const pad = getComputedStyle(a), to = w.offsetWidth + parseFloat(pad.paddingLeft) + parseFloat(pad.paddingRight), still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!sized.current || still) { a.style.width = to + 'px'; sized.current = true; return; }
    const run = animate(a, { width: to }, PILL_SPRING);
    return () => run.stop();
  }, [ref, text]);
  return (
    <a ref={ref} className="wh-pill" href={href}>
      <span ref={words} key={seen.n} className={'wh-pill-text' + (seen.n ? ' is-fresh' : '')}>{text}</span>
    </a>
  );
}

/* A cell as a solid block that spins on its long axis when `k` changes, like a drum of cards: the face that was there
   rolls away and the next one comes round from the bottom when the wheel turns forward, from the top when it turns
   back. Each face is a whole cell, border and fill, with its own status colour. Off, the face just changes. */
type Face = { k: string; node: ReactNode; status?: WheelStatus };
/* A turn is never cut short: if the city changes again while the drum turns, it finishes, then makes one quicker turn
   straight to the latest city. A fast scroll rolls the cells steadily and they land on the right city. */
function Prism({ k, dir, on, status, width, children }: { k: string; dir: number; on: boolean; status?: WheelStatus; width?: string; children: ReactNode }) {
  const [shown, setShown] = useState<Face>({ k, node: children, status });
  const [turn, setTurn] = useState<{ old: Face; dir: number; quick: boolean } | null>(null);
  const [quick, setQuick] = useState(false);
  if (shown.k !== k && !turn) { if (on) setTurn({ old: shown, dir, quick }); setShown({ k, node: children, status }); if (quick) setQuick(false); }
  else if (shown.k === k && (shown.node !== children || shown.status !== status)) setShown({ k, node: children, status });
  const face = (f: Face, cls: string) => <span className={'wh-face ' + cls} data-status={f.status} style={width ? { width } : undefined}>{f.node}</span>;
  const end = (e: React.AnimationEvent) => { if (e.target !== e.currentTarget) return; setTurn(null); setQuick(shown.k !== k); };
  return (
    <span className="wh-prism" data-dir={(turn?.dir ?? dir) > 0 ? 'up' : 'down'}>
      <span key={shown.k} className={'wh-drum' + (turn ? ' is-turning' : '') + (turn?.quick ? ' is-quick' : '')} onAnimationEnd={end}>
        {turn ? face(turn.old, 'is-old') : null}
        {face(shown, 'is-new')}
      </span>
    </span>
  );
}

export function wheelVars(c: WheelCfg): CSSProperties {
  return {
    '--wh-paper': `rgb(${c.paper} ${c.paper + 1} ${c.paper + 1})`, '--wh-line-a': c.lineAlpha, '--wh-line-p': c.linePeriod + 'px',
    '--wh-sans': SANS[c.font], '--wh-mono': MONO[c.font],
  } as CSSProperties;
}

export function Wheel({ cities, cfg, start = 0, noGl = false, cells = true, mark = 'hack', date, caption, engineRef, onCity, foot, lead, children, className }: {
  cities: WheelFact[]; cfg: WheelCfg; start?: number; noGl?: boolean; cells?: boolean; mark?: MarkMode; date: string; caption: string; foot?: ReactNode;
  /* the words over the cells in the column layout */
  lead?: ReactNode;
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
  /* which way the wheel last turned, for the cards, the short way round: scrolling up (back a city) rolls the old words
     up and away with the new ones coming from below, scrolling down the other way */
  const [last, setLast] = useState(cur), [dir, setDir] = useState(1);
  if (last !== cur) {
    const k = cities.length; let d = cur - last; if (d > k / 2) d -= k; if (d < -k / 2) d += k;
    setDir(d > 0 ? -1 : 1); setLast(cur);
  }
  const flip = cfg.cells === 'flip';
  /* the session cell is as wide as the longest session, so the row keeps one width */
  const sessionCh = cities.reduce((a, c) => Math.max(a, c.session.length), 0), countCh = cities.reduce((a, c) => Math.max(a, c.count.length), 0);
  const column = cfg.layout === 'column';
  /* the cells' and the link's words changed: measure them again before the next frame */
  useLayoutEffect(() => { eng.current?.measure(); }, [cur, cities, cells, cfg.font, cfg.layout, mark, foot]);
  /* a screen reader hears the city after the wheel comes to rest, not each city on the way */
  useEffect(() => {
    const t = window.setTimeout(() => setSaid(`${city.name}, ${city.session}, ${city.count}, ${STATUS_LABEL[city.status]}`), cfg.statusDelay);
    return () => window.clearTimeout(t);
  }, [city, cfg.statusDelay]);

  const cellsRow = () => cells ? (
    <dl ref={cellsEl} className="wh-cells">
      <div className="sr-only"><dt>City</dt><dd>{city.name}</dd></div>
      <div><dt className="sr-only">Session, local time</dt><dd><Prism k={city.id} dir={dir} on={flip} width={`calc(${sessionCh}ch + 26px)`}>{city.session}</Prism></dd></div>
      {column ? <div><dt className="sr-only">People</dt><dd><Prism k={city.id} dir={dir} on={flip} width={`calc(${countCh}ch + 26px)`}>{city.count}</Prism></dd></div> : null}
      <div className="wh-status"><dt className="sr-only">Status</dt><dd><Prism k={city.id} dir={dir} on={flip} status={city.status}><StatusIcon status={city.status} /><span>{STATUS_LABEL[city.status]}</span></Prism></dd></div>
    </dl>
  ) : null;

  return (
    <div ref={pin} className={'wh-pin' + (className ? ' ' + className : '')} data-layout={cfg.layout} style={wheelVars(cfg)}>
      <canvas key={noGl ? '2d' : 'gl'} ref={canvas} className="wh-canvas" aria-hidden="true" />
      <h1 className="wh-wordmark" data-mark={mark}>
        {mark === 'builder' ? <><BuilderLogo className="wh-builder-globe" /><span className="wh-name">Builder Day</span></> : (
          <>{mark === 'both' ? <SupabaseMark /> : null}<HackMark label={mark === 'both' ? 'Supabase HackDay' : mark === 'name' ? '' : 'HackDay'} />{mark === 'name' ? <span className="wh-name">Supabase Hackday</span> : null}</>
        )}
      </h1>
      {column ? (
        /* the column: the page's words, then the cells on the active name's line, then the link */
        <div className="wh-col">
          {lead ? <div className="wh-lead">{lead}</div> : null}
          {cellsRow()}
          <div className="wh-col-foot">
            <Pill ref={cta} href={city.href} text={city.status === 'full' ? 'Join the waiting list on Luma' : 'Register on Luma'} />
            {foot}
          </div>
        </div>
      ) : (
        <>
          <div className="wh-foot">
            <a ref={cta} className="wh-cta" href={city.href}>
              <span ref={lens} className="wh-lens" aria-hidden="true" />
              <span className="wh-cta-text"><span className="wh-cta-action">{city.action}</span> <span>{date}</span></span>
            </a>
            {foot}
          </div>
          {cellsRow()}
        </>
      )}
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
