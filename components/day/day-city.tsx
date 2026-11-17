'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CITIES, EPOCH, sched, tOf } from '@/lib/day-data';
import { projectPath, slugOf, type CityWorld, type Row, type Votes } from '@/lib/city';
import { realMinute } from '@/lib/clock';
import { hhmm } from '@/lib/format';
import { clampParts, partsVars, type PartsCfg } from '@/components/board/config';
import { HeaderRow } from '@/components/board/header-row';
import { Announce } from '@/components/board/announce';
import { SoundKey, step } from '@/components/board/prefs';
import { useTick } from '@/components/board/clock';
import { cityAt, cityWord, homeAt, wireItems, CODE } from '@/components/board/day-model';
import { useForms } from '@/components/forms/forms-provider';
import { store, useVotes } from '@/components/forms/store';
import { LabPanel, LayoutPicker, togglePanel, useLabSave, type Group } from '@/components/admin/kit';
import { measure, type Contrast } from '@/components/admin/contrast';
import screenCfg from '@/saved/screen.config.json';
import { clampScreen } from '@/components/screen/config';
import { DayScreen, dayOf, useLabClock } from './shared';
import { HowItWorks, PrizeBlock } from './explain';
import { DayFooter, dayFinalOf } from './home-parts';
import { CityHero, ProjectSheet, Pylon, Ranking, TopWall, Two, type CLook, type RankView } from './city-parts';
import { PIC_BOUNDS, PIC_DEF, PIC_MODES, clampPics, type PicCfg, type PicMode } from './rank-pictures';
import { pageQuery, useRealClock } from './page-clock';
import '@/components/board/board.css';
import './day-home.css';
import './day-city.css';
import './rank-pictures.css';
import './rank-view.css';
import './explain.css';
import '@/components/forms/forms.css';

/* A city's page on the day: the header row, the wire, the opening, the ranking beside the pylon, how it works and the
   prizes, and a project as a sheet over the page. One component for the real page (/city/<id>, and
   /city/<id>/p/<slug> with that project open) and its tuning page (/lab/day-city):
   - the real page follows the real clock; ?moment=, ?m= or ?t= move it, ?still=1 stops it, ?admin shows the panel.
     Votes go through the forms (an email confirmed once) and are kept per city and seed, Remind me and Submit open
     their sheets, and an open project has its own address: opening pushes it, Back closes it;
   - the lab starts at a moment with the worst content on, votes locally, and always has the panel and the baseline.
   Every number is the city's world at the board's minute, from the same day the home draws. Your votes count at once;
   the order waits for the board's tick. The look comes from saved/day-city.config.json and saved/parts.config.json. */

export type CityDir = 'base' | 'board' | 'scope' | 'wall';
export type DayCityCfg = { dir: CityDir; pylon: number; spark: number; rows: number; how: number } & PicCfg;
type State = DayCityCfg & { city: string; t: number; live: number; speed: number; worst: number };
const DIRS_ALL: [string, string][] = [['base', 'Baseline'], ['board', 'Board and pylon'], ['scope', 'Scope'], ['wall', 'Wall']];
const MOMENTS: [string, string][] = [['before', 'Before'], ['build', 'Building'], ['vote', 'Last votes'], ['last', 'Last minutes'], ['closed', 'Closed'], ['picked', 'Picked']];
const momentsOf = (city: string, worst: number): [string, string, number][] => {
  const d = dayOf(worst), S = sched(d), x = S.cs[CITIES.findIndex((c) => c.id === city)];
  const at: Record<string, number> = { before: x.start - 30, build: x.start + d.buildMin * 0.45, vote: x.buildEnd + d.voteAfter * 0.4, last: x.end - 2, closed: x.end + Math.max(10, (S.pickAt - x.end) / 3), picked: S.pickAt + 10 };
  return MOMENTS.map(([id, label]) => [id, label, at[id]]);
};
const rowBySlug = (W: CityWorld, slug: string | null | undefined): Row | null => (slug ? W.rows.find((r) => slugOf(r.p) === slug) ?? null : null);
const at = (min: number) => new Date(EPOCH + min * 60000);

/* page: the real page, with the server's time and the city; slug: the project open in the address; base: the lab's
   baseline at a t on its own scale */
export function DayCity({ saved, parts, q, page, base }: {
  saved: Partial<DayCityCfg>; parts: Partial<PartsCfg>; q: Record<string, string | undefined>;
  page?: { nowMs: number; city: string; slug?: string }; base?: (city: string, t: number, worst: number) => ReactNode;
}) {
  const P = clampParts(parts), real = !!page, admin = !real || q.admin !== undefined;
  const DIRS = real ? DIRS_ALL.slice(1) : DIRS_ALL;
  const CHOICES: Record<string, string[]> = { dir: DIRS.map(([d]) => d), city: CITIES.map((c) => c.id), pics: PIC_MODES.map(([m]) => m) };
  const LABELS: Record<string, string> = { ...Object.fromEntries(DIRS_ALL), ...Object.fromEntries(CITIES.map((c) => [c.id, c.name])), ...Object.fromEntries(PIC_MODES) };
  const GROUPS: Group[] = [
    { name: real ? 'Time' : 'Time and place', knobs: [...(real ? [] : [{ k: 'city', kind: 'select' as const, label: 'City' }]), { k: 't', kind: 'range', label: 'Time' }, { k: 'live', kind: 'toggle', label: 'Clock runs' }, { k: 'speed', kind: 'range', label: 'Seconds a second' }, { k: 'worst', kind: 'toggle', label: 'Worst content' }] },
    { name: 'Direction', knobs: [{ k: 'dir', kind: 'select', label: 'Direction' }, { k: 'pylon', kind: 'toggle', label: 'Pylon' }, { k: 'spark', kind: 'toggle', label: 'A spark per board row' }, { k: 'rows', kind: 'range', label: 'Rows before “Show all”' }, { k: 'how', kind: 'toggle', label: 'How it works and the prize block' }] },
    { name: 'Pictures', knobs: [{ k: 'pics', kind: 'select', label: 'Pictures' }, { k: 'thumbW', kind: 'range', label: 'Picture width (rows, strip)' }, { k: 'picRows', kind: 'range', label: 'Rows with a picture' }, { k: 'cols', kind: 'range', label: 'Monitors across (multiviewer)' }, { k: 'tally', kind: 'toggle', label: 'Tally lamps' }, { k: 'dim', kind: 'range', label: 'Picture brightness at rest' }] },
  ];
  const [cfg, setCfg] = useState<State>(() => {
    const c: State = { dir: 'board', pylon: 1, spark: 0, rows: 30, how: 1, ...PIC_DEF, ...saved, ...clampPics(saved), city: page?.city ?? 'berlin', t: 0, live: 1, speed: 1, worst: real ? 0 : 1 };
    if (!CHOICES.dir.includes(c.dir)) c.dir = 'board';
    if (q.pics && CHOICES.pics.includes(q.pics)) c.pics = q.pics as PicMode;
    if (q.dir && CHOICES.dir.includes(q.dir)) c.dir = q.dir as CityDir;
    if (!real && q.city && CHOICES.city.includes(q.city)) c.city = q.city;
    if (q.worst === '0') c.worst = 0; else if (q.worst === '1') c.worst = 1;
    const ms = momentsOf(c.city, c.worst);
    c.t = page ? realMinute(page.nowMs) : ms[2][2];
    if (q.m && isFinite(+q.m)) c.t = +q.m;
    if (q.moment) { const m = ms.find((x) => x[0] === q.moment); if (m) c.t = m[2]; }
    if (q.still === '1') c.live = 0;
    if (q.speed && +q.speed >= 1 && +q.speed <= 120) c.speed = Math.round(+q.speed);
    return c;
  });
  const bare = real ? !admin : q.bare !== undefined || q.panel === '0';
  const set = (k: string, v: unknown) => setCfg((c) => ({ ...c, [k]: k === 'rows' || k === 'thumbW' || k === 'picRows' || k === 'cols' ? Math.round(Number(v)) : v }));
  const day = dayOf(cfg.worst), S = sched(day), i = CITIES.findIndex((c) => c.id === cfg.city);
  const ms = momentsOf(cfg.city, cfg.worst);
  const clock = useLabClock(cfg.t, !!cfg.live, cfg.speed), bm = useTick(clock, cfg.t, P.tick), moved = useRealClock(clock, real, q);
  const [view, setView] = useState<RankView>(q.view === 'time' ? 'time' : 'list'), [hot, setHot] = useState<number | null>(null);

  /* votes: the real page keeps them in the forms' store per city and seed (the same key the old page used); the lab
     keeps them for the visit */
  const forms = useForms(), voteKey = cfg.city + ':' + day.seed, stored = useVotes(voteKey), [local, setLocal] = useState<Votes>({});
  const voted = real ? stored : local;
  const [more, setMore] = useState(false), [reminded, setReminded] = useState(false);
  const W = cityAt(day, cfg.city, bm, voted), W10 = cityAt(day, cfg.city, bm - 10, voted), H = homeAt(day, bm), hx = H.cs[i], word = cityWord(hx, H, day);
  const vote = (id: number) => {
    if (!W.voting) return;
    if (!real) { setLocal((v) => { const n = { ...v } as Record<string, 1>; if (n[id]) delete n[id]; else n[id] = 1; return n; }); step(P.sound === 'steps'); return; }
    const mine = store.votes(voteKey);
    if (mine[id]) { const n = { ...mine }; delete n[id]; store.setVotes(voteKey, n); step(P.sound === 'steps'); return; }
    (forms ? forms.ensureVoter() : Promise.resolve(true)).then((ok) => { if (ok) { store.setVotes(voteKey, { ...store.votes(voteKey), [id]: 1 }); step(P.sound === 'steps'); } });
  };
  const remind = () => {
    if (!real || !forms) { setReminded((r) => !r); return; }
    forms.remind({ city: W.city.id, cityName: W.city.name, when: at(W.x.start), off: W.off }).then((ok) => { if (ok) setReminded(true); });
  };
  const submit = real && forms ? () => { forms.submit({ city: W.city.id, cityName: W.city.name, deadline: at(W.x.buildEnd), off: W.off }); } : undefined;

  /* the open project: on the real page its address is /city/<id>/p/<slug>; opening pushes it, Back and Close close it */
  const [open, setOpen] = useState<Row | null>(() => (page?.slug ? rowBySlug(cityAt(dayOf(cfg.worst), cfg.city, cfg.t, {}), page.slug) : null));
  const openRef = useRef(open), pushed = useRef(false), Wref = useRef(W);
  useEffect(() => { openRef.current = open; Wref.current = W; });
  const show = useCallback((r: Row) => {
    setOpen(r);
    if (real) { window.history.pushState({ hackdayP: 1 }, '', projectPath(Wref.current.city.id, slugOf(r.p)) + window.location.search); pushed.current = true; }
  }, [real]);
  const close = useCallback(() => {
    if (!openRef.current) return;
    setOpen(null);
    if (!real) return;
    if (pushed.current) { pushed.current = false; window.history.back(); }
    else window.history.replaceState(null, '', '/city/' + Wref.current.city.id + window.location.search);
  }, [real]);
  useEffect(() => {
    if (!real) return;
    const on = () => { const m = window.location.pathname.match(/^\/city\/[^/]+\/p\/([^/]+)/); pushed.current = false; setOpen(m ? rowBySlug(Wref.current, decodeURIComponent(m[1])) : null); };
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, [real]);

  /* the one Ant and Copple picked, when it is from this city */
  const pk = H.picked && H.final.city.i === i ? { id: H.final.p.id, name: H.final.p.name, place: H.final.place } : null;
  const { save, msg, rail } = useLabSave('day-city', 'lab-day-city-saved');
  const doSave = useCallback(() => save({ dir: cfg.dir, pylon: cfg.pylon, spark: cfg.spark, rows: cfg.rows, how: cfg.how ? 1 : 0, ...clampPics(cfg) }), [cfg, save]);
  const [res, setRes] = useState<Contrast | null>(null);

  useEffect(() => { if (bare && !real) document.documentElement.classList.add('lab-closed', 'no-lab'); }, [bare, real]);
  useEffect(() => {
    if (bare) return;
    const on = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; if (e.metaKey || e.ctrlKey || e.altKey || (t && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName))) return; if (e.key === '\\') togglePanel(); else if (e.key === 's' || e.key === 'S') doSave(); };
    document.addEventListener('keydown', on); return () => document.removeEventListener('keydown', on);
  }, [doSave, bare]);
  useEffect(() => {
    if (cfg.dir === 'base' || bare) return;
    const id = window.setTimeout(() => setRes(measure(document, clampScreen(screenCfg))), 700);
    return () => window.clearTimeout(id);
  }, [cfg.dir, cfg.city, cfg.worst, bare]);

  const carry = (m: number) => real ? pageQuery({ m: moved || admin || !cfg.live ? m.toFixed(2) : null, still: cfg.live ? null : '1', worst: cfg.worst ? '1' : null, admin: admin ? '' : null })
    : '&m=' + m.toFixed(2) + '&dir=' + cfg.dir + (cfg.worst ? '' : '&worst=0') + (cfg.live ? '' : '&still=1');
  const href = (id: string) => real ? '/city/' + id + carry(bm) : '/lab/day-city?city=' + id + carry(bm);
  const flap = { flipMs: P.flipMs, flaps: P.flaps, stagger: P.stagger, mode: P.flap, onStep: () => step(P.sound === 'steps') };
  const look: CLook = { mark: P.mark, cardBars: P.cardBars, cardPalette: P.cardPalette, cards: P.cards, segSecs: P.segSecs, bugCorner: P.bugCorner, flap };
  let cur = -1; ms.forEach((m, k) => { if (Math.abs(cfg.t - m[2]) < 0.6) cur = k; });
  const out = (k: string) => k === 't' ? hhmm(cfg.t) + ' UTC · ' + hhmm(cfg.t + W.off) + ' local' : k === 'speed' ? cfg.speed + '×' : k === 'thumbW' ? cfg.thumbW + ' px' : k === 'picRows' ? (cfg.picRows >= 60 ? 'all' : String(cfg.picRows)) : k === 'dim' ? Math.round(cfg.dim * 100) + '%' : String((cfg as Record<string, unknown>)[k]);
  const bounds = { t: [Math.min(S.cs[i].start - 90, Math.floor(cfg.t)), Math.max(S.pickAt + 60, Math.ceil(cfg.t)), 1] as [number, number, number], speed: [1, 120, 1] as [number, number, number], rows: [10, 60, 5] as [number, number, number], ...PIC_BOUNDS };
  const meter = cfg.dir === 'base' ? { text: 'Baseline: today’s Tower on the kit, framed.', bad: false }
    : res ? { text: `Small text: ${res.n} pieces, lowest ${res.min.toFixed(1)}:1, ${res.under} under 7:1 with the lines on${res.under ? ': ' + res.worst.filter((w) => w.ratio < 7).slice(0, 4).map((w) => '“' + w.text.slice(0, 24) + '” ' + w.ratio.toFixed(1)).join(', ') : ''}.`, bad: res.under > 0 } : { text: 'Measuring…', bad: false };
  const pylon = cfg.pylon && cfg.dir !== 'wall' ? <Pylon W={W} W10={W10} hot={hot} setHot={setHot} swatch={view === 'time'} /> : null;
  const rankProps = { W, look, vote, open: show, spark: !!cfg.spark, rows: cfg.rows, more, setMore, pick: pk?.id, pics: clampPics(cfg), view, setView, hot, setHot };
  const labButtons: [string, () => void, boolean?][] = [['Tokyo: long name', () => setCfg((c) => ({ ...c, city: 'tokyo', worst: 1 }))], ['Lagos: 182', () => setCfg((c) => ({ ...c, city: 'lagos', worst: 1 }))], ['Singapore: none', () => setCfg((c) => ({ ...c, city: 'singapore', worst: 1 }))], ['Save', doSave, true]];

  return (
    <>
      {cfg.dir === 'base' && base ? base(cfg.city, tOf(cfg.t, S), cfg.worst) : (
        <>
          <DayScreen />
          <main className="bd dl dc" style={partsVars(P) as CSSProperties} data-face={P.face} data-dir={cfg.dir} data-view={view}>
            <HeaderRow title={W.city.name} state={word} clock={clock} first={cfg.t} offset={W.off} zone={'Local · ' + CODE[cfg.city]} homeHref={real ? '/' + carry(bm) : '/lab/day-home?m=' + bm.toFixed(2)} right={P.sound === 'steps' ? <SoundKey /> : undefined} />
            <Announce items={wireItems(H, 12, i, W.off)} mode={P.announce} dwell={P.dwell} crawl={P.crawl} flap={flap} startPaused={!cfg.live} label={'Announcements in ' + W.city.name} empty={'Nothing yet. ' + W.city.name + ' opens at ' + hhmm(W.x.start + W.off) + ' local.'} />
            <CityHero W={W} hx={hx} mon={cfg.dir !== 'wall'} clock={clock} first={cfg.t} look={look} onRemind={remind} reminded={reminded} onSubmit={submit} pick={pk} elsewhere={H.picked && !pk ? { name: H.final.p.name, city: H.final.city.name } : null} />
            {cfg.dir === 'wall' ? (
              <>
                <TopWall W={W} look={look} vote={vote} open={show} pick={pk?.id} />
                <Ranking {...rankProps} mode="rest" from={3} title={W.ranked.length > 3 ? 'The rest' : 'The ranking'} />
              </>
            ) : <Two main={<Ranking {...rankProps} mode={cfg.dir === 'scope' ? 'scope' : 'board'} title="The ranking" />} side={pylon} />}
            {cfg.how ? <div className="dl-ex"><HowItWorks f={day} id="dc-how" day={dayFinalOf(H)} /><PrizeBlock id="dc-prize" day={dayFinalOf(H)} winner={H.picked ? H.final.p.name + ', ' + H.final.city.name : null} /></div> : null}
            <DayFooter href={href} sound={P.sound === 'steps'} />
            <ProjectSheet o={open} W={W} look={look} vote={vote} close={close} />
          </main>
        </>
      )}
      {bare ? null : (
        <>
          <LabPanel tab={real ? 'Admin' : 'Lab'} title={real ? W.city.name + ': admin' : 'Day city lab'} cfg={{ ...cfg, seed: day.seed }} bounds={bounds} choices={CHOICES} groups={GROUPS} set={set} moments={ms} momentIdx={cur} out={out}
            optionLabel={(_k, v) => LABELS[v] || v} meter={meter} msg={msg} rail={rail} railLabel={(s) => LABELS[String(s.dir)] + (s.pylon ? ', pylon' : '') + ', ' + String(s.pics ?? 'none')}
            apply={(s) => setCfg((c) => ({ ...c, ...(s as Partial<DayCityCfg>) }))} buttons={real ? [['Now', () => set('t', realMinute(Date.now()))], ['Save', doSave, true]] : labButtons} />
          <LayoutPicker modes={DIRS} mode={cfg.dir} setMode={(m) => set('dir', m)} replay={() => clock.set(cfg.t)} />
        </>
      )}
    </>
  );
}
