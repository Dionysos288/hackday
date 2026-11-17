'use client';
import { useEffect, useId, useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { FlapText, type FlapOpts } from './flap';
import type { AnnounceMode } from './config';

/* The announcement line, under the header row: the day's wire, one real event per item, with its time and city code
   ("09:42 BER Bucket List takes the lead"). Three modes, judged in the lab:
   - flipper: one item at a time; every `dwell` seconds the line turns to the next: the time and code as flaps, the
     sentence as one flap, so it never shows as noise. The default.
   - crawl: the items run right to left in one line, at `crawl` px a second.
   - rail: still. The newest three side by side; the arrows step back through the rest.
   The flipper has pause, previous and next, the crawl pause, the rail previous and next (on a phone the line keeps
   pause and Log, for room); every mode has Log, which opens every item as a list. Nothing moves while the pointer is on
   the line or focus is inside it (WCAG 2.2.2: anything that moves by itself for over 5 seconds can be paused). A new
   item turns the line to it. Screen readers are not interrupted: the line is not live; the log is a plain list. */

export type Item = { id: string; time: string; code: string; text: string };

export function Announce({ items, mode, dwell, crawl, flap, label = 'Announcements', startPaused = false, empty = 'Nothing yet. The first city opens the wire.' }: { items: Item[]; mode: AnnounceMode; dwell: number; crawl: number; flap: FlapOpts; label?: string; startPaused?: boolean; empty?: string }) {
  const [i, setI] = useState(0), [paused, setPaused] = useState(startPaused), [over, setOver] = useState(false), [inside, setInside] = useState(false), [log, setLog] = useState(false), held = over || inside;
  const newest = items[0]?.id ?? '', [seen, setSeen] = useState(newest), listId = useId();
  /* a new item turns the line to it */
  if (newest !== seen) { setSeen(newest); setI(0); }
  const n = items.length, at = n ? ((i % n) + n) % n : 0, still = paused || held;
  useEffect(() => {
    if (mode !== 'flipper' || still || n < 2) return;
    const id = window.setTimeout(() => setI((x) => x + 1), dwell * 1000);
    return () => window.clearTimeout(id);
  }, [mode, still, n, dwell, i]);
  const step = (d: number) => setI((x) => x + d);
  /* the pointer and focus hold the line apart: a mouse that leaves never frees a line that keyboard focus is still on.
     The hold is on the line and the log, never the keys, so pressing Play plays at once (and turns the line once). */
  const hold = { onPointerEnter: (e: PointerEvent) => { if (e.pointerType !== 'touch') setOver(true); }, onPointerLeave: () => setOver(false), onFocus: () => setInside(true), onBlur: (e: FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setInside(false); } };
  const it = items[at];
  return (
    <section className="an" data-mode={mode} aria-label={label}>
      <div className="an-line" {...hold}>
        {!n ? <p className="an-empty">{empty}</p>
          : mode === 'flipper' ? (
            <p className="an-item">
              <span className="an-t"><FlapText text={it.time} opts={flap} /></span>
              <span className="an-c"><FlapText text={it.code} opts={flap} /></span>
              <span className="an-x"><FlapText text={it.text} opts={{ ...flap, mode: 'word', onStep: undefined }} /></span>
            </p>
          ) : mode === 'crawl' ? <Crawl items={items} speed={crawl} still={still} />
          : (
            <ol className="an-rail">
              {items.slice(at, at + 3).map((x) => <li key={x.id}><span className="an-t">{x.time}</span><span className="an-c">{x.code}</span><span className="an-x">{x.text}</span></li>)}
            </ol>
          )}
      </div>
      <div className="an-keys">
        {mode !== 'rail' ? <button type="button" className="an-k" data-paused={paused ? '' : undefined} disabled={n < 2} onClick={() => { if (paused && mode === 'flipper') step(1); setPaused((p) => !p); }} aria-label={paused ? 'Play the announcements' : 'Pause the announcements'}>{paused ? <PlayIcon /> : <PauseIcon />}</button> : null}
        {mode === 'crawl' ? null : <>
        <button type="button" className="an-k an-step" onClick={() => step(-1)} disabled={n < 2 || (mode === 'rail' && at === 0)} aria-label={mode === 'rail' ? 'Newer' : 'Previous'}><Arrow d="l" /></button>
        <button type="button" className="an-k an-step" onClick={() => step(1)} disabled={n < 2 || (mode === 'rail' && at + 3 >= n)} aria-label={mode === 'rail' ? 'Older' : 'Next'}><Arrow d="r" /></button>
        </>}
        <button type="button" className="an-k an-log" aria-expanded={log} aria-controls={listId} disabled={!n} onClick={() => setLog((l) => !l)}>Log</button>
      </div>
      {log && n ? (
        <ol className="an-list" id={listId} tabIndex={0} aria-label="Announcement log" {...hold}>
          {items.map((x) => <li key={x.id}><span className="an-t">{x.time}</span><span className="an-c">{x.code}</span><span className="an-x">{x.text}</span></li>)}
        </ol>
      ) : null}
    </section>
  );
}

/* the crawl: the items twice over in one track, moved by a CSS animation whose length follows the track's width, so the
   speed is px a second whatever the text; paused by the button, the pointer or focus */
function Crawl({ items, speed, still }: { items: Item[]; speed: number; still: boolean }) {
  const track = useRef<HTMLDivElement>(null), [secs, setSecs] = useState(30);
  /* measured when the speed changes, not on each new item: a running animation that changes length jumps */
  useEffect(() => { const w = track.current ? track.current.scrollWidth / 2 : 0; if (w) setSecs(w / speed); }, [speed]);
  const run = (k: string) => items.map((x) => <span key={k + x.id} className="an-ci"><span className="an-t">{x.time}</span><span className="an-c">{x.code}</span><span className="an-x">{x.text}</span></span>);
  return (
    <div className="an-crawl">
      <div ref={track} className="an-track" style={{ animationDuration: secs + 's', animationPlayState: still ? 'paused' : 'running' }} aria-hidden="true">{run('a')}{run('b')}</div>
      <span className="sr-only">{items[0] ? items[0].time + ' ' + items[0].text : ''}</span>
    </div>
  );
}

const ic = { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true as const };
function PauseIcon() { return <svg {...ic}><path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" /></svg>; }
function PlayIcon() { return <svg {...ic}><path d="M2 1l9 5-9 5z" fill="currentColor" /></svg>; }
function Arrow({ d }: { d: 'l' | 'r' }) { return <svg {...ic}><path d={d === 'l' ? 'M8 1 3 6l5 5' : 'M4 1l5 5-5 5'} fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>; }
