'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GetReady } from '@/components/day/get-ready';
import { EDITOR_ROOM } from '@/lib/event/rule';
import { RULES, SERVER, sayIt } from '@/lib/hackday-server';
import { once } from './motion';
import { reducedMotion } from './flap';

/* Get ready: the steps, and beside them the dry run, a framed tube that shows what submitting looks like on the day:
   the sentence to say, the editor asking for the room's code, one line per rule with its tick, then the project's
   link. Every line is there without JavaScript. Played, the lines stamp in whole, one a step apart; a press plays it
   again. Low on the page it plays only on a press. */

export function FoldReady({ city, cityId, mode, auto, step, hold, level = 2, onSignIn }: {
  city: string; cityId: string; mode: 'dry' | 'steps'; auto: boolean; step: number; hold: number; level?: 2 | 3; onSignIn?: () => void;
}) {
  return (
    <div className="pf-ready" data-mode={mode}>
      <GetReady city={city} cityId={cityId} id="ready" level={level} onSignIn={onSignIn} />
      {mode === 'dry' ? <DryRun city={city} cityId={cityId} auto={auto} step={step} hold={hold} /> : null}
    </div>
  );
}

function DryRun({ city, cityId, auto, step, hold }: { city: string; cityId: string; auto: boolean; step: number; hold: number }) {
  const box = useRef<HTMLElement>(null), [run, setRun] = useState(0), [shown, setShown] = useState<number | null>(null);
  const lines: [string, string][] = [
    ['say', sayIt(city)],
    ['ask', EDITOR_ROOM],
    ...RULES.map((r) => ['rule', r] as [string, string]),
    ['link', `Your project’s link: /city/${cityId}/p/your-project`],
  ];
  const n = lines.length, timers = useRef<number[]>([]);
  /* one line a step; the link waits a little longer, as the server's answer would */
  const play = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [];
    setRun((r) => r + 1);
    if (reducedMotion() || step <= 0) { setShown(null); return; }
    setShown(0);
    for (let i = 1; i <= n; i++) timers.current.push(window.setTimeout(() => setShown(i === n ? null : i), i * step + (i === n ? hold : 0)));
  }, [n, step, hold]);
  useEffect(() => (auto ? once(box.current, 0.5, play) : undefined), [auto, play]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return (
    <figure ref={box} className="pf-dry" aria-labelledby="pf-dry-cap">
      <ol className="pf-dry-lines">
        {lines.map(([k, t], i) => (
          <li key={i} data-k={k} data-off={shown !== null && i >= shown ? '' : undefined}>
            {k === 'rule' ? <span className="pf-tickmark" aria-hidden="true" /> : k === 'say' ? <span className="pf-caret" aria-hidden="true">&gt;</span> : null}
            <span>{t}</span>
          </li>
        ))}
      </ol>
      <figcaption id="pf-dry-cap" className="pf-dry-cap">
        <span>{SERVER.live ? 'What submitting looks like on the day.' : 'A rehearsal of submitting on the day. The server is not open yet.'}</span>
        <button type="button" className="pf-key" onClick={play}>{run ? 'Play it again' : 'Play it'}</button>
      </figcaption>
    </figure>
  );
}
