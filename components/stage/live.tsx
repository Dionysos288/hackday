'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CITIES, EVENT, SCHED, EPOCH, sched } from '@/lib/day-data';
import { CODE, localTime } from '@/lib/places';
import { TO_VOTE } from '@/lib/stage/deck';
import { PRIZES } from '@/lib/prizes';
import type { Project } from '@/lib/data';
import { drawOf, type Ranked, type World } from '@/lib/stage/world';
import { click, unlock } from '@/components/wheel/click';
import { Door, In, Num, Others, Pic, Countdown, Words, mmss, bare } from './parts';
import type { SceneProps } from './intro';
import { useWall } from './use';

/* The live scenes, 14 to 18, drawn from the city's world at the wall's second (counts, the countdown) or at its board
   tick (the ranking, which re-sorts on a tick and glides). Each survives the worst cases: no entries, 182 entries, the
   longest name, and a tie at third. */

export type LiveProps = SceneProps & { ranked: World; chart: boolean; talkEnds: number | null; spin: { at: number; seed: number } | null };

/* 14. Building: the countdown as the largest thing on the wall, the door, entries arriving with their pictures, the
   count, the other nine; on the switch, the chart in place of the arrivals */
export function Building({ city, world, ranked, url, chart }: LiveProps) {
  const before = world.phase === 'before', label = before ? 'Building' : world.phase === 'build' ? 'Building closes in' : 'Building is closed';
  return (
    <div className="st-sc st-building">
      <div className="st-build-l">
        <p className="st-b st-2">{label}{before ? ': ' + city.build_min + ' minutes, from the host’s word.' : ''}</p>
        <Countdown secs={world.phase === 'build' || before ? world.left : 0} lit={before ? 'OPENS' : world.phase === 'build' ? 'BUILD' : world.phase === 'done' ? 'CLOSED' : 'VOTE'} also={world.phase === 'build' ? 'VOTE' : null} label={label + ' ' + mmss(world.left)} />
        <p className="st-h">{before ? 'Entries open with the clock.' : <><Num v={String(world.inNow)} width={String(Math.max(world.total, 10)).length} /> {world.inNow === 1 ? 'entry' : 'entries'} in</>}</p>
      </div>
      {/* the plan's Building has the QR and the code; the address is on Doors, Submit, Questions and the QR key */}
      <div className="st-build-door">
        <Door url={url} code={city.room_code} addr={false} />
        <p className="st-l st-key">To submit: the email you gave Luma and the room code.</p>
      </div>
      <div className="st-build-b">
        {chart ? <Chart w={ranked} /> : <Arrivals world={world} />}
      </div>
      <Others others={world.others} />
    </div>
  );
}

/* the latest entries, newest first; a new one pushes the row along and is lit for a moment */
function Arrivals({ world }: { world: World }) {
  const box = useRef<HTMLOListElement>(null);
  useFlip(box, world.arrivals.map((x) => x.p.id).join(','), 'x', 'var(--dur-slide)', 'var(--ease-move)');
  if (world.phase === 'before') return <p className="st-b st-2 st-empty">Entries show here as they arrive.</p>;
  if (!world.arrivals.length) return <p className="st-b st-2 st-empty">No entries yet.</p>;
  return (
    <ol ref={box} className="st-arr" aria-label="Latest entries">
      {world.arrivals.map((a, i) => (
        <li key={a.p.id} data-id={a.p.id} className={'st-arr-i' + (i === 0 ? ' st-arr-new' : '')}>
          <Pic p={a.p} />
          <span className="st-arr-n">{a.p.name}</span>
        </li>
      ))}
    </ol>
  );
}

/* 15. Voting: building is closed, voting closes in; the ranking, ten rows read from the back, the cut under third in
   green; on the switch, the chart of the top ten over time in its place */
export function Voting({ world, ranked, chart, url }: LiveProps) {
  const done = world.phase === 'done', before = world.phase === 'before';
  return (
    <div className="st-sc st-voting">
      <p className="st-vote-h st-h">
        {before ? 'Voting opens with building.' : done ? 'Voting is closed.' : world.phase === 'build' ? <>Voting is open. Building closes in <span className="st-num st-vote-n">{mmss(world.left)}</span></> : <>Building is closed. Voting closes in <span className="st-num st-vote-n">{mmss(world.left)}</span></>}
      </p>
      {/* voting is open to anyone (said apart from submitting, which needs the list and the code) */}
      <p className={'st-l st-key' + (before || done ? ' st-hide' : '')}>{TO_VOTE.replace('Anyone can vote', 'Anyone can vote at ' + bare(url))}</p>
      {chart ? <Chart w={ranked} /> : <Ranking w={ranked} />}
    </div>
  );
}

/* the ranking: rows glide to their new places on the board tick (FLIP on transform, --ease-move, the stage's glide) */
/* FLIP: after a reorder each item starts where it was seen (its old place plus whatever glide it was still in) and
   glides to its new place on transform. A reorder in the middle of a glide carries on from where the item is. */
function useFlip(box: React.RefObject<HTMLElement | null>, order: string, axis: 'x' | 'y', dur: string, ease: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const ol = box.current; if (!ol) return;
    const now = new Map<string, number>(), reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ol.querySelectorAll<HTMLElement>('[data-id]').forEach((el) => {
      const id = el.dataset.id!, at = axis === 'y' ? el.offsetTop : el.offsetLeft, was = last.current.get(id);
      now.set(id, at);
      if (was === undefined || reduce) { el.style.transition = ''; el.style.transform = ''; return; }
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform), cur = axis === 'y' ? m.m42 : m.m41, from = was + cur - at;
      if (Math.abs(from) < 0.5) return;
      el.style.transition = 'none'; el.style.transform = axis === 'y' ? `translateY(${from}px)` : `translateX(${from}px)`;
      void el.offsetWidth;
      el.style.transition = `transform ${dur} ${ease}`; el.style.transform = '';
    });
    last.current = now;
  }, [order, box, axis, dur, ease]);
}

/* the ranking: rows glide to their new places on the board tick (--ease-move, the stage's glide) */
function Ranking({ w }: { w: World }) {
  const box = useRef<HTMLOListElement>(null);
  useFlip(box, w.ranking.map((r) => r.p.id).join(','), 'y', 'var(--st-glide)', 'var(--ease-move)');
  if (w.phase === 'before') return <p className="st-b st-2 st-empty">The ranking starts with the first entry.</p>;
  if (!w.ranking.length) return <p className="st-b st-2 st-empty">No entries yet.</p>;
  return (
    <>
      <ol ref={box} className="st-rank" aria-label="Ranking">
        {w.ranking.map((r) => <Row key={r.p.id} r={r} />)}
        {/* the cut stays where it is while rows glide across it */}
        {w.ranking.length >= EVENT.finalists ? <li className="st-cut" data-g="" aria-hidden="true"><span>Top {EVENT.finalists} go to the final</span></li> : null}
      </ol>
      {w.tieNote ? <p className="st-l st-2 st-tie">{w.tieNote}</p> : null}
    </>
  );
}
function Row({ r }: { r: Ranked }) {
  const first = r.place === 1;
  return (
    <li className="st-row" data-id={r.p.id} data-cut={r.place === EVENT.finalists ? '' : undefined} data-first={first ? '' : undefined}>
      <span className="st-row-p">{r.place}</span>
      <Pic p={r.p} className="st-row-pic" />
      <span className="st-row-n" title={r.p.name}>{r.p.name}</span>
      <span className="st-row-j">{r.tie ? 'Level' : r.j ? r.j + ' from judges' : ''}</span>
      <span className="st-row-v"><Num v={String(r.v)} width={4} /></span>
    </li>
  );
}

/* the top ten over time, as steps, with the names at the line ends (pushed apart so none overlap) */
function Chart({ w }: { w: World }) {
  const W = 1300, H = 560, L = 70, R = 980, T = 16, B = 500;
  const { series, span, max } = w.chart;
  const top = Math.max(5, Math.ceil(max / 5) * 5);
  const X = (m: number) => L + ((R - L) * m) / Math.max(1, span), Y = (v: number) => B - ((B - T) * v) / top;
  const labels = useMemo(() => {
    const ls = series.map((s) => ({ s, y: Y(s.pts[s.pts.length - 1][1]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ls.length; i++) if (ls[i].y - ls[i - 1].y < 44) ls[i].y = ls[i - 1].y + 44;
    const over = ls.length ? ls[ls.length - 1].y - B : 0; if (over > 0) ls.forEach((l) => { l.y -= over; });
    return ls;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Y is a pure function of span and top
  }, [series, span, top]);
  if (w.phase === 'before' || !series.length) return <p className="st-b st-2 st-empty">{w.phase === 'before' ? 'The chart starts with the first entry.' : 'No entries yet.'}</p>;
  const step = (pts: [number, number][]) => pts.map(([m, v], i) => (i ? `H${X(m).toFixed(1)}V${Y(v).toFixed(1)}` : `M${X(m).toFixed(1)} ${Y(v).toFixed(1)}`)).join('');
  const ticks = [0, Math.round(top / 2), top];
  return (
    <figure className="st-chart">
      <figcaption className="st-l st-2">Top 10 over time</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="st-chart-svg" role="img" aria-label={'Votes over time for the top ' + series.length}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={R} y1={Y(t)} y2={Y(t)} className="st-chart-grid" /><text x={L - 14} y={Y(t) + 14} className="st-chart-t" textAnchor="end">{t}</text></g>)}
        {series.slice().reverse().map((s) => <path key={s.p.id} d={step(s.pts)} className="st-chart-l" data-place={s.place} />)}
        {labels.map(({ s, y }) => (
          <g key={s.p.id}>
            <line x1={R + 6} x2={R + 28} y1={Y(s.pts[s.pts.length - 1][1])} y2={y} className="st-chart-lead" />
            <text x={R + 36} y={y + 14} className="st-chart-n" data-place={s.place}>{s.place + ' ' + clip(s.p.name, 14)}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/* 16. The top 3: three closed places, then third, second, first, one press each; a talk timer the host can start */
export function Top3({ step, world, now, talkEnds }: LiveProps) {
  const top = world.ranking.slice(0, EVENT.finalists), shown = Math.min(step, 3);
  const open = (place: number) => shown >= 4 - place; /* third opens first */
  const talk = talkEnds && talkEnds > now ? (talkEnds - now) / 1000 : null;
  return (
    <div className="st-sc st-top3">
      <div className="st-top3-h">
        <h1 className="st-d3"><Words v={world.phase === 'done' ? 'The top 3' : 'The top 3 so far'} /></h1>
        {talk !== null ? <p className="st-talk"><span className="st-k">Talk</span><Num v={mmss(talk)} width={5} /></p> : null}
      </div>
      {!top.length ? <p className="st-b st-2 st-empty">No entries in {world.phase === 'before' ? 'yet' : 'this city'}.</p> : (
        <ol className="st-podium">
          {[1, 2, 3].map((place) => {
            const r = top[place - 1];
            return (
              <li key={place} className="st-place" data-open={open(place) && r ? '' : undefined} data-first={place === 1 ? '' : undefined}>
                <span className="st-place-k">{['1st', '2nd', '3rd'][place - 1]}</span>
                {open(place) && r ? (
                  <In i={4 - place} className="st-place-b">
                    <Pic p={r.p} className="st-place-pic" />
                    <span className="st-place-n">{place === 1 ? <Words v={r.p.name} /> : r.p.name}</span>
                    <span className="st-l st-2">{r.p.handle} · {r.v} {r.v === 1 ? 'vote' : 'votes'}</span>
                    {place === 1 && PRIZES.city.what ? <span className="st-l st-g" data-g="">Wins {PRIZES.city.what}.</span> : null}
                  </In>
                ) : <span className="st-place-closed" aria-label="Not revealed yet" />}
              </li>
            );
          })}
        </ol>
      )}
      {/* a tie at third is said when third opens: who reached the count first keeps the place */}
      {shown >= 1 && world.tieNote ? <p className="st-l st-2">{world.tieNote}</p> : null}
    </div>
  );
}

/* 17. Tombola: a draw among everyone outside the top 3. The names pass a fixed window, fast at first and slower,
   one name per step, and land on the drawn entry at the spin's length; every screen draws the same one (the seed is on
   the stage row). Under reduced motion it lands at once. */
export function Tombola({ step, world, spin }: LiveProps) {
  const { cfg, reduced, now: clock } = useWall(), pool = world.pool;
  const target = spin ? drawOf(pool, spin.seed) : -1;
  const [idx, setIdx] = useState(-1);
  /* the run: N names in all, the last being the drawn one */
  const N = useMemo(() => (pool.length ? Math.max(1, Math.ceil(110 / pool.length)) * pool.length + target : 0), [pool.length, target]);
  useEffect(() => {
    if (!spin || !pool.length) return;
    const t0 = performance.now() - Math.max(0, clock() - spin.at);
    let raf = 0, was = -1;
    const frame = () => {
      const u = reduced ? 1 : Math.min(1, (performance.now() - t0) / cfg.spinMs);
      /* quartic ease-out on the count of names: one name per step, slower and slower */
      const k = Math.min(N, Math.floor(N * (1 - Math.pow(1 - u, 4))));
      if (k !== was) { was = k; setIdx(k); if (cfg.sound && !reduced) click(); }
      if (u < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spin, pool.length, N, cfg.spinMs, cfg.sound, reduced, clock]);
  if (!spin || step === 0) return (
    <div className="st-sc st-mid">
      <h1 className="st-d2"><Words v="Tombola" /></h1>
      <p className="st-h">{pool.length ? 'Everyone outside the top 3: ' + pool.length + (pool.length === 1 ? ' entry.' : ' entries.') : 'Nobody to draw from yet.'}</p>
      {pool.length ? <p className="st-b st-2">Drum roll, please.</p> : null}
    </div>
  );
  if (!pool.length) return <div className="st-sc st-mid"><h1 className="st-d2">Tombola</h1><p className="st-h">Nobody to draw from yet.</p></div>;
  const at = (k: number) => pool[(((k - N + target) % pool.length) + pool.length) % pool.length];
  const k = Math.max(0, idx), landed = k >= N, cur: Project = at(k);
  return (
    <div className="st-sc st-tombola" data-landed={landed ? '' : undefined}>
      <p className="st-b st-2">{landed ? 'Drawn from ' + pool.length + ' entries' : 'Drawing from ' + pool.length + ' entries'}</p>
      <div className="st-reel" aria-live="off">
        <span className="st-reel-o" aria-hidden="true">{at(k - 1).name}</span>
        <span className="st-reel-w" key={landed ? 'land' : 'run'}><span className="st-reel-n">{cur.name}</span></span>
        <span className="st-reel-o" aria-hidden="true">{at(k + 1).name}</span>
      </div>
      {/* laid out from the start and shown on landing, so nothing above it moves when it appears */}
      <div className={'st-reel-who' + (landed ? ' st-in' : ' st-hide')} aria-hidden={!landed}><Pic p={cur} className="st-reel-pic" /><span className="st-h">{cur.handle}</span></div>
      <p className="sr-only" aria-live="polite">{landed ? 'Drawn: ' + cur.name + ' by ' + cur.handle : ''}</p>
    </div>
  );
}
/* the click needs a press first (browsers start audio only after one); the remote's or the wall's key gives it */
export const wakeSound = () => unlock();

/* 18. The final: thirty finalists, one pick; when and where to watch; the ten cities' top threes as they finish */
export function Final({ city, world, url }: LiveProps) {
  const S = sched(SCHED), pickMs = EPOCH + S.pickAt * 60000, n = CITIES.length * EVENT.finalists;
  const mine = world.phase === 'done' ? world.ranking.slice(0, 3).map((r) => r.p) : null;
  const blocks = CITIES.map((c) => {
    if (c.id === city.id) return { id: c.id, code: CODE[c.id], names: mine?.map((p) => p.name) ?? null, word: world.phase === 'before' ? 'Not started' : world.phase === 'build' ? 'Building' : 'Voting' };
    const o = world.others.find((x) => x.id === c.id)!;
    return { id: c.id, code: CODE[c.id], names: o.state === 'done' ? o.top.map((t) => t.p.name) : null, word: o.state === 'next' ? 'Not started' : o.state === 'build' ? 'Building' : 'Voting' };
  });
  return (
    <div className="st-sc st-final">
      <h1 className="st-d3"><Words v={n + ' finalists. One pick.'} /></h1>
      <p className="st-b st-2">{EVENT.pickers} pick one at {localTime(city.id, pickMs)}. Watch at {bare(url).split('/')[0]}.</p>
      <ul className="st-ten">
        {blocks.map((b) => (
          <li key={b.id} className="st-ten-c" data-here={b.id === city.id ? '' : undefined} data-done={b.names ? '' : undefined}>
            <span className="st-ten-code">{b.code}</span>
            {b.names && b.names.length ? b.names.map((x, i) => <span key={i} className="st-ten-n">{x}</span>) : <span className="st-ten-w">{b.names ? 'No entries' : b.word}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
