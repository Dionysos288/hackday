'use client';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { EPOCH } from '@/lib/day-data';
import { clampCfg, pageOrder, rowById, slugOf, trueTop, world, type CityCfg, type CityWorld, type Extra, type Links } from '@/lib/city';
import type { ClockInit } from '@/lib/clock';
import { store, useVotes } from '@/components/forms/store';
import { useForms } from '@/components/forms/forms-provider';
import { applyGround } from '@/components/ground/apply-ground';

/* A city page's live state. The server draws the first frame at clock.at; the browser starts from the same minute
   (so hydration matches), then ticks once a second: votes arrive as the day's data says. What changes between ticks
   (the order the sheet shows, which rows just got a vote) is worked out in the tick, not in render, because it
   depends on the pointer and focus; everything else is derived from the minute during render. */
type Ui = { sort?: string; q?: string; more?: number };
export type CityValue = {
  cfg: CityCfg; W: CityWorld; L: Links; votes: Readonly<Record<string, 1>>;
  shownIds: number[]; flash: Readonly<Record<number, number>>;
  openId: number | null; openProject: (id: number, from?: HTMLElement | null) => void; closeProject: () => void;
  vote: (id: number) => void; setUi: (u: Ui) => void; cur: RefObject<number>;
  mainRef: RefObject<HTMLElement | null>; dlgRef: RefObject<HTMLDialogElement | null>;
};
const CityContext = createContext<CityValue | null>(null);
export function useCity(): CityValue { const v = useContext(CityContext); if (!v) throw new Error('useCity outside CityProvider'); return v; }

type Shown = { ids: number[]; state: boolean; key: string; at: number };
type Tick = { now: number; shown: Shown | null; flash: Record<number, number>; n: number };
const REDUCED = '(prefers-reduced-motion: reduce)';

/* live: the page follows the clock. The tuning page sets it false and passes the minute in cfg itself; frame says
   whether that change is time running forward (votes flash, rows batch) or a knob (everything resets).
   onKey: the tuning page's extra keys. openSlug: the project in the URL (?p=). */
export function CityProvider({ cfg: cfgIn, clock, links, live = true, frame = 'set', extra, openSlug, onKey, children }: {
  cfg: CityCfg; clock: ClockInit; links: Links; live?: boolean; frame?: 'live' | 'set'; extra?: Extra; openSlug?: string | null; onKey?: (e: KeyboardEvent) => void; children: ReactNode;
}) {
  const [ui, setUiState] = useState<Ui>({});
  const cfg = useMemo(() => clampCfg({ ...cfgIn, ...ui }, extra), [cfgIn, ui, extra]);
  const voteKey = cfg.city + ':' + cfg.seed, votes = useVotes(voteKey), forms = useForms();
  const [tick, setTick] = useState<Tick>(() => ({ now: clock.at, shown: null, flash: {}, n: 0 }));
  const now = live ? tick.now : (cfgIn.now as number | undefined);
  const W = useMemo(() => world({ ...cfg, now }, votes), [cfg, now, votes]);
  /* the sheet's order: the tick's, while it still belongs to this city, seed, layout and phase; else the true order */
  const sKey = cfg.city + cfg.seed + cfg.mode + cfg.top;
  const shownRef = useRef<Shown | null>(null), ts = tick.shown;
  const shownIds = useMemo(() => (ts && ts.key === sKey && ts.state === W.votesOn ? ts.ids : trueTop(W, cfg.top)), [ts, sKey, W, cfg.top]);

  const mainRef = useRef<HTMLElement | null>(null), dlgRef = useRef<HTMLDialogElement | null>(null), cur = useRef(-1);
  const [openId, setOpenId] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  /* the latest of everything, for the clock and the listeners (refs, so they are set up once) */
  const latest = useRef({ cfg, W, live, links, shownIds, openId, votes, forms, onKey });
  useLayoutEffect(() => { latest.current = { cfg, W, live, links, shownIds, openId, votes, forms, onKey }; });

  const run = useRef({ prevW: null as CityWorld | null, prevV: {} as Record<number, number>, flash: {} as Record<number, number>, tops: null as Record<string, number> | null, closeTm: 0 });
  /* one frame of the clock. live: time ran forward (a vote since the last frame lands as a tick and a flash; the
     order batches); otherwise the order and the flashes start again. */
  const step = useCallback((mode: boolean | 'scrub', minute?: number) => {
    const L = latest.current, c = L.cfg, R = run.current;
    const n = minute != null ? minute : (L.live ? clockNow(clock) : (c.now as number));
    const W = world({ ...c, now: n }, store.votes(c.city + ':' + c.seed)), tnow = performance.now(), prevW = R.prevW;
    if (mode && prevW && W.voting && W.now > prevW.now && prevW.c.city === c.city && prevW.c.seed === c.seed) {
      W.rows.forEach((o) => { const pv = R.prevV[o.p.id]; if (pv != null && o.v - o.mine > pv) R.flash[o.p.id] = tnow; });
    } else if (!mode) R.flash = {};
    R.prevV = {}; W.rows.forEach((o) => { R.prevV[o.p.id] = o.v - o.mine; });
    /* the moment voting closes: the bar's last stretch draws and the winner's seal inks (not when scrubbing) */
    const closing = prevW && mode !== 'scrub' && prevW.state === 'vote' && W.state === 'done' && prevW.c.city === c.city && W.now > prevW.now;
    R.prevW = W;
    const page = mainRef.current;
    if (closing && page && !c.reduced) { page.classList.remove('closing'); void page.offsetWidth; page.classList.add('closing'); clearTimeout(R.closeTm); R.closeTm = window.setTimeout(() => page.classList.remove('closing'), 2600 / c.speed); }
    /* the top of the sheet: held while a row is hovered or focused, batched otherwise */
    const top = trueTop(W, c.top), key = c.city + c.seed + c.mode + c.top; let S = shownRef.current;
    if (!mode || !S || S.state !== W.votesOn || S.key !== key) { S = { ids: top, state: W.votesOn, key, at: tnow }; }
    else {
      const held = holdNow(dlgRef.current), due = tnow - S.at >= c.reorder * 1000, same = top.join() === S.ids.join();
      /* a hover holds the order for at most three batches, so the sheet never shows a stale ten for long; a change of
         leader never waits for the batch: first place is the one position that must not be stale */
      const lead = top[0] != null && S.ids[0] !== top[0];
      if (!same && (((due || lead) && !held) || tnow - S.at >= c.reorder * 3000)) S = { ...S, ids: top, at: tnow };
    }
    shownRef.current = S;
    const ages: Record<number, number> = {};
    Object.keys(R.flash).forEach((k) => { const id = +k, age = tnow - R.flash[id]; if (age > 1600 / c.speed) delete R.flash[id]; else ages[id] = Math.round(age); });   /* --dur-flash */
    R.tops = mode ? measure(page) : null;
    const shown = S; setTick((t) => ({ now: n, shown, flash: ages, n: t.n + 1 }));
  }, [clock]);

  /* rows glide when the order changes (FLIP: transform only, --dur-panel, --ease-move). Never under reduced motion. */
  useLayoutEffect(() => {
    const R = run.current, tops = R.tops; R.tops = null;
    if (!tops || latest.current.cfg.reduced || window.matchMedia(REDUCED).matches) return;
    glide(mainRef.current, tops, latest.current.cfg.speed);
  }, [tick.n]);

  /* the page's clock: once a second, unless stopped or hidden */
  useEffect(() => {
    if (!live) return;
    run.current.prevW = world({ ...latest.current.cfg, now: clock.at }, store.votes(latest.current.cfg.city + ':' + latest.current.cfg.seed));
    document.documentElement.dataset.ready = '1';
    if (clock.still) return;
    const id = window.setInterval(() => { if (!document.hidden) step(true); }, 1000);
    return () => window.clearInterval(id);
  }, [live, clock, step]);
  /* the tuning page moves the minute itself */
  useEffect(() => { if (!live) step(frame === 'live' ? true : false, cfgIn.now as number); }, [live, frame, cfgIn, step]);

  useEffect(() => { applyGround(cfg.ground); }, [cfg.ground]);

  /* ---------------- the project sheet ---------------- */
  /* the open project is in the URL (?p=<slug>), so it can be linked; replaceState, so Back still leaves the page */
  const urlProject = useCallback((slug: string | null) => {
    if (latest.current.links.kind !== 'page') return;
    const u = new URL(location.href); if (slug) u.searchParams.set('p', slug); else u.searchParams.delete('p');
    history.replaceState(history.state, '', u);
  }, []);
  const openProject = useCallback((id: number, from?: HTMLElement | null) => {
    if (from) opener.current = from;
    const o = rowById(latest.current.W, id); urlProject(o ? slugOf(o.p) : null);
    setOpenId(id);
  }, [urlProject]);
  const closeProject = useCallback(() => { const d = dlgRef.current; if (d && d.open) d.close(); }, []);
  /* the dialog's close event: the URL forgets the project and focus goes back to its row */
  const onDialogClose = useCallback(() => {
    const id = latest.current.openId; setOpenId(null); urlProject(null);
    const page = mainRef.current;
    const row = page && (page.querySelector<HTMLElement>('.cl-sheet [data-pid="' + id + '"]') || page.querySelector<HTMLElement>('[data-pid="' + id + '"]'));
    (row || opener.current || document.body).focus({ preventScroll: false });
    opener.current = null;
  }, [urlProject]);
  useEffect(() => {
    const d = dlgRef.current; if (!d) return;
    d.addEventListener('close', onDialogClose); return () => d.removeEventListener('close', onDialogClose);
  }, [onDialogClose]);
  /* ?p=<slug> opens that project, once */
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !openSlug) return; opened.current = true;
    const o = latest.current.W.arrived.find((r) => slugOf(r.p) === openSlug);
    if (o) openProject(o.p.id);
  }, [openSlug, openProject]);

  /* the tab's title follows the city and the open project */
  const openName = openId != null ? rowById(W, openId)?.p.name : undefined;
  useEffect(() => { const t = (openName ? openName + ' · ' : '') + W.city.name + ' · Supabase Hackathon'; if (document.title !== t) document.title = t; }, [openName, W.city.name]);

  /* ---------------- voting ---------------- */
  /* a vote counts once the person has confirmed an email (the forms). Without forms on the page, it counts locally. */
  const vote = useCallback((id: number) => {
    const L = latest.current; if (!L.W.voting) return;
    const key = L.cfg.city + ':' + L.cfg.seed, mine = store.votes(key);
    if (mine[id]) { const next = { ...mine }; delete next[id]; store.setVotes(key, next); step(true); return; }
    const ok = L.forms ? L.forms.ensureVoter() : Promise.resolve(true);
    ok.then((yes) => {
      if (!yes || !latest.current.W.voting) return;
      store.setVotes(key, { ...store.votes(key), [id]: 1 }); step(true);
    }, () => { /* the email step failed: the vote is not counted */ });
  }, [step]);

  /* the table's own controls (sort, search, show all): the sheet's order and the flashes start again */
  const setUi = useCallback((u: Ui) => { setUiState((x) => ({ ...x, ...u })); shownRef.current = null; run.current.flash = {}; setTick((t) => ({ ...t, shown: null, flash: {}, n: t.n + 1 })); }, []);

  /* ---------------- keys: J and K move between rows, V votes for the current row, Enter opens it ---------------- */
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tg = e.target as HTMLElement | null; if (tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) return;
      if (document.querySelector('dialog[open]:not(#pv)')) return;   /* a form sheet is open */
      const L = latest.current, d = dlgRef.current, page = mainRef.current;
      if (d && d.open) { if ((e.key === 'v' || e.key === 'V') && L.openId != null) vote(L.openId); return; }
      const k = e.key, links = page ? Array.from(page.querySelectorAll<HTMLElement>('a[data-row]')) : [];
      if (k === 'j' || k === 'J' || k === 'k' || k === 'K') {
        e.preventDefault(); let at = links.indexOf(document.activeElement as HTMLElement); if (at < 0) at = cur.current;
        at = Math.min(links.length - 1, Math.max(0, at + (k.toLowerCase() === 'j' ? 1 : -1))); if (at < 0 && links.length) at = 0;
        cur.current = at; if (links[at]) links[at].focus();
      } else if (k === 'v' || k === 'V') {
        const a = document.activeElement && (document.activeElement as HTMLElement).closest ? (document.activeElement as HTMLElement).closest('li, .ld-poster') : null;
        let b = a && a.querySelector<HTMLButtonElement>('[data-vote]');
        if (!b && links[cur.current]) { const li = links[cur.current].closest('li, .ld-poster'); b = li && li.querySelector<HTMLButtonElement>('[data-vote]'); }
        if (b && !b.disabled) vote(+b.getAttribute('data-vote')!);
      } else if (L.onKey) L.onKey(e);
    };
    document.addEventListener('keydown', keys);
    return () => document.removeEventListener('keydown', keys);
  }, [vote]);

  const value = useMemo<CityValue>(() => ({ cfg, W, L: links, votes, shownIds, flash: tick.flash, openId, openProject, closeProject, vote, setUi, cur, mainRef, dlgRef }),
    [cfg, W, links, votes, shownIds, tick.flash, openId, openProject, closeProject, vote, setUi]);
  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

/* the order a person steps through projects: the sheet, then the table */
export function useOrder(): number[] { const { W, cfg, shownIds } = useCity(); return useMemo(() => pageOrder(W, cfg, shownIds), [W, cfg, shownIds]); }

function clockNow(clock: ClockInit): number {
  const real = (Date.now() - EPOCH) / 60000;
  return clock.still ? clock.at : real + (clock.preview ? clock.at - clockStart(clock) : 0);
}
/* the real minute the page was drawn at, for a preview clock that keeps running from the URL's moment */
const starts = new WeakMap<ClockInit, number>();
function clockStart(clock: ClockInit): number { let s = starts.get(clock); if (s == null) { s = (Date.now() - EPOCH) / 60000; starts.set(clock, s); } return s; }

function holdNow(dlg: HTMLDialogElement | null): boolean { const s = document.querySelector('.cl-sheet'); return !!(s && (s.matches(':hover') || s.contains(document.activeElement))) || !!(dlg && dlg.open); }
function measure(page: HTMLElement | null): Record<string, number> | null {
  if (!page) return null; const m: Record<string, number> = {};
  page.querySelectorAll('.cl-sheet [data-k^="p"]').forEach((e) => { m[e.getAttribute('data-k')!] = e.getBoundingClientRect().top; });
  return m;
}
/* the moved rows start where they were and slide home. The transition and its stacking are set inline (what
   .gliding does), where React never writes, so a re-render mid-glide does not cut it short. */
function glide(page: HTMLElement | null, tops: Record<string, number>, speed: number) {
  if (!page) return;
  const moved: HTMLElement[] = [];
  page.querySelectorAll<HTMLElement>('.cl-sheet [data-k^="p"]').forEach((e) => {
    const k = e.getAttribute('data-k')!; if (tops[k] == null) return;
    const dy = tops[k] - e.getBoundingClientRect().top; if (Math.abs(dy) < 1) return;
    e.style.transition = 'none'; e.style.transform = 'translateY(' + Math.round(dy) + 'px)'; moved.push(e);
  });
  if (!moved.length) return;
  void page.offsetWidth;
  moved.forEach((e) => {
    e.style.transition = 'transform calc(var(--dur-panel) / var(--speed)) var(--ease-move)'; e.style.zIndex = '1'; e.style.transform = '';
    window.setTimeout(() => { e.style.transition = ''; e.style.zIndex = ''; }, 400 / speed);
  });
}
