'use client';
import { useEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { MarkFace, type MarkMode } from '@/components/wheel/wheel';
import { Person, type CellState } from '@/components/account/account';
import { flapInto, type FlapOpts } from './flap';

/* The header: the wheel's own top row, stuck to the top of the window. At the top of the page it is today's row (the
   mark and the name left, one link right). Once the page leaves the top it gets the paper and one rule; once the
   wheel's active row reaches it, its right side becomes cells, written left to right a step apart: the parts of the page, and the register cell with a
   small glass globe (the wheel's own globe docks there). The cell of the part on screen is lit. The register cell's
   city turns on flaps when the visitor's city changes.
   The account (door-plan.md, D3): a cell after the register cell, "Sign in" or the person's city code; with a place
   and `merged`, the register cell itself becomes the account ("You're in Berlin"), since there is nothing left to
   register for. With `top`, Sign in (or the account) is also a plain link at the very top, beside the top link. */

export type Acct = { state: CellState; code: string; cityName: string; merged: boolean; top: boolean; open: () => void };
const acctWords = (a: Acct) => (a.state === 'out' ? 'Sign in' : a.state === 'place' ? 'You’re in ' + a.cityName : 'Your account');
/* on a phone the city is its code, so the words never reach the name beside the mark */
const acctShort = (a: Acct) => (a.state === 'place' ? 'You’re in ' + a.code : acctWords(a));

export type Part = { id: string; label: string };
export function FoldHeader({ on, paper, parts, lit, reg, lens, jump, flap, plainTop, topLink = true, globe, dot, mirror, acct, mark = 'name' }: {
  on: boolean; paper?: boolean; parts: Part[]; lit: string | null;
  reg: { href: string; city: string; waiting: boolean; width: number };
  lens: RefObject<HTMLSpanElement | null>; jump: (id: string, e: MouseEvent) => void; flap: FlapOpts;
  /* the top link: "How it works", which now goes to that part */
  plainTop?: boolean; topLink?: boolean;
  /* with the glass not fixed the wheel's canvas cannot reach the header, so the cell has a small globe of its own */
  globe?: { lat: number; lon: number } | null;
  /* with the text globe: the cell's small globe is dots, drawn on its own canvas (dot-globes.ts), facing the city */
  dot?: { lat: number; lon: number } | null;
  /* with the glass fixed: the docked globe, copied here by the wheel so it sits above what scrolls under the header */
  mirror?: RefObject<HTMLCanvasElement | null>;
  /* the person, once /api/me has answered; null on a page without the forms */
  acct?: Acct | null;
  /* the wheel's mark mode: the header draws BUILD and the name, or the pixel globe and the name */
  mark?: MarkMode;
}) {
  const cityEl = useRef<HTMLSpanElement>(null), last = useRef(reg.city), shown = useRef(on);
  useEffect(() => { shown.current = on; }, [on]);
  useEffect(() => {
    const el = cityEl.current; if (!el || last.current === reg.city) return;
    const from = last.current.padEnd(reg.width); last.current = reg.city;
    /* the flaps play only where they can be seen: while the cells are off the city is simply set */
    if (!shown.current) { el.textContent = reg.city.padEnd(reg.width); return; }
    return flapInto(el, reg.city.padEnd(reg.width), flap, from);
  }, [reg.city, reg.width, flap]);
  const mine = !!acct && acct.merged && acct.state === 'place';
  const lensEl = dot
    ? <span ref={lens} className="pf-reg-lens" aria-hidden="true" data-dot="" data-lat={dot.lat} data-lon={dot.lon} />
    : <span ref={lens} className="pf-reg-lens" aria-hidden="true" {...(globe ? { 'data-globe': '', 'data-lat': globe.lat, 'data-lon': globe.lon } : {})}>{globe ? null : <canvas ref={mirror} className="pf-reg-mirror" />}</span>;
  return (
    <header className="pf-hdr" data-on={on ? '' : undefined} data-paper={paper ? '' : undefined} data-acct={acct ? '' : undefined}>
      <h1 className="wh-wordmark pf-mark" data-mark={mark === 'builder' ? 'builder' : 'name'}><a href="#top" onClick={(e) => jump('top', e)}><MarkFace mark={mark === 'builder' ? 'builder' : 'name'} /></a></h1>
      {topLink || acct?.top ? (
        <div className="pf-tops" aria-hidden={on || undefined}>
          {topLink ? <a className="pf-top" href="#how" onClick={(e) => jump('how', e)} tabIndex={on ? -1 : undefined}>How it works</a> : null}
          {acct?.top ? <button type="button" className="pf-top" data-acct={acct.state} aria-haspopup="dialog" tabIndex={on ? -1 : undefined} onClick={acct.open}><span className="pf-top-l">{acctWords(acct)}</span><span className="pf-top-s" aria-hidden="true">{acctShort(acct)}</span></button> : null}
        </div>
      ) : null}
      {plainTop ? null : (
        <nav className="pf-cells" aria-label="On this page">
          {parts.map((p, i) => (
            <a key={p.id} href={'#' + p.id} className="pf-cell" style={{ ['--i' as string]: i }} aria-current={lit === p.id ? 'location' : undefined} onClick={(e) => jump(p.id, e)}>{p.label}</a>
          ))}
          {mine ? (
            <button type="button" className="pf-cell pf-reg" data-mine="" style={{ ['--i' as string]: parts.length }} aria-haspopup="dialog" onClick={acct!.open}>
              {lensEl}
              <span className="sr-only">Your account: on the list for {acct!.cityName}</span>
              <span aria-hidden="true" className="pf-reg-w">You’re in {acct!.cityName}</span>
              <span aria-hidden="true" className="pf-reg-s">You’re in {acct!.code}</span>
            </button>
          ) : (
            <a className="pf-cell pf-reg" href={reg.href} style={{ ['--i' as string]: parts.length }}>
              {lensEl}
              <span className="sr-only">{reg.waiting ? 'Join the waiting list in ' : 'Register for '}{reg.city}</span>
              <span aria-hidden="true" className="pf-reg-w">{reg.waiting ? 'Waiting list ' : 'Register for '}<span ref={cityEl} className="pf-reg-c" style={{ minWidth: reg.width + 'ch' }}>{reg.city}</span></span>
              <span aria-hidden="true" className="pf-reg-s">{reg.waiting ? 'Waitlist' : 'Register'}</span>
            </a>
          )}
          {acct && !mine ? (
            <button type="button" className="pf-cell pf-acct" data-state={acct.state} style={{ ['--i' as string]: parts.length + 1 }} aria-haspopup="dialog" onClick={acct.open}
              aria-label={acct.state === 'out' ? 'Sign in' : acct.state === 'place' ? acct.code + ', your account, on the list for ' + acct.cityName : 'Your account'}>
              <Person on={acct.state !== 'out'} /><span className="pf-acct-w">{acct.state === 'out' ? 'Sign in' : acct.state === 'place' ? acct.code : 'Account'}</span>
            </button>
          ) : null}
        </nav>
      )}
    </header>
  );
}
