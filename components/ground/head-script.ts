/* The script in <head> that runs before first paint (no flash of the wrong ground, no frame before the arrival):
   - sets the ground's five base colours on <html> (?ground=, else the page's saved ground), and blocks transitions
     for the first two frames (html.preload);
   - on the home and a city page, decides the arrival: once per session, not under reduced motion, not with ?still=1,
     and not when the page arrives through a view transition;
   - names the city row and the bar for the cross-document view transition between the home and a city page.
   It is written as a function so it is type-checked, and inlined as text by app/layout.tsx. */
import { GROUND_HEX, GROUNDS, groundVars } from '@/lib/palette';

type Boot = {
  pal: Record<string, { paper: string; vars: Record<string, string> }>;
  hex: Record<string, string>;
  /* the saved ground, arrival speed and reduced-motion knob of the home ('day') and the city page ('city') */
  look: Record<'day' | 'city', { ground: string; speed: number; reduced: number }>;
  /* the seal tuning page keeps its own two grounds */
  seal: Record<string, Record<string, string>>;
};

function boot(B: Boot) {
  const d = document.documentElement, q = new URLSearchParams(location.search), path = location.pathname;
  const kind: 'day' | 'city' | null = /^\/city\/[a-z-]+\/?$|^\/lab\/city\/?$/.test(path) ? 'city' : /^\/(lab\/day\/?)?$/.test(path) ? 'day' : null;
  if (/^\/lab\/seal\/?$/.test(path)) {
    let saved: string | null = null; try { saved = localStorage.getItem('seal-paper'); } catch { /* storage blocked */ }
    const qp = q.get('paper'), n = qp && B.seal[qp] ? qp : saved && B.seal[saved] ? saved : 'night', p = B.seal[n];
    for (const k in p) d.style.setProperty('--' + k, p[k]);
    d.dataset.paper = n;
  } else {
    const g = q.get('ground'), name = g && B.pal[g] ? g : kind ? B.look[kind].ground : 'night', key = B.pal[name] ? name : 'night', p = B.pal[key];
    for (const k in p.vars) d.style.setProperty('--' + k, p.vars[k]);
    d.dataset.paper = p.paper; d.dataset.ground = key;
    const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', B.hex[key]);
  }
  d.classList.add('preload'); requestAnimationFrame(() => { requestAnimationFrame(() => { d.classList.remove('preload'); }); });
  if (!kind) return;

  /* the arrival, once per session: the pen draws the strip, then the bars or rows land */
  const look = B.look[kind], skey = kind === 'day' ? 'day-intro' : 'city-intro';
  let seen = false; try { seen = !!sessionStorage.getItem(skey); } catch { /* storage blocked */ }
  let timer = 0;
  if (!seen && !matchMedia('(prefers-reduced-motion: reduce)').matches && !look.reduced && q.get('still') !== '1') {
    d.classList.add('arrive');
    try { sessionStorage.setItem(skey, '1'); } catch { /* storage blocked */ }
    timer = window.setTimeout(() => { d.classList.remove('arrive'); }, 1400 / look.speed);
  }

  /* home to city and back: the clicked city's name and bar are the shared elements (an enhancement; plain navigation
     works without it). The city page names its title and session bar the same in its CSS. */
  type VT = { viewTransition: { ready: Promise<unknown>; finished: Promise<unknown>; types?: Set<string>; skipTransition(): void } | null };
  const CITY_URL = /\/city\/([a-z-]+)/;
  const nameRow = (id: string) => {
    const r = document.querySelector<HTMLElement>('.tt-row [data-city="' + id + '"]'); if (!r) return null;
    const li = r.closest('li'), b = li && li.querySelector<HTMLElement>('.bar');
    r.style.viewTransitionName = 'city-name'; if (b) b.style.viewTransitionName = 'city-bar';
    return () => { r.style.viewTransitionName = ''; if (b) b.style.viewTransitionName = ''; };
  };
  window.addEventListener('pagereveal', (ev) => {
    const e = ev as unknown as VT; if (!e.viewTransition) return;
    e.viewTransition.ready.catch(() => { /* skipped or aborted: plain navigation */ });
    d.classList.remove('arrive'); clearTimeout(timer);
    if (kind === 'city') { d.classList.add('vt-in'); return; }
    const nav = (window as unknown as { navigation?: { activation?: { from?: { url?: string } } } }).navigation;
    const from = (nav && nav.activation && nav.activation.from && nav.activation.from.url) || '', m = CITY_URL.exec(from);
    const id = (m && m[1]) || q.get('from'); if (!id) return;
    try { if (e.viewTransition.types) e.viewTransition.types.add('back'); } catch { /* types not supported */ }
    const undo = nameRow(id); if (undo) e.viewTransition.finished.then(undo, undo); else e.viewTransition.skipTransition();
  });
  if (kind === 'day') window.addEventListener('pageswap', (ev) => {
    const e = ev as unknown as VT & { activation?: { entry?: { url?: string } } }; if (!e.viewTransition) return;
    e.viewTransition.ready.catch(() => { /* skipped or aborted */ });
    const to = e.activation && e.activation.entry && e.activation.entry.url, m = to && CITY_URL.exec(to); if (!m) return;
    const undo = nameRow(m[1]); if (undo) e.viewTransition.finished.then(undo, undo);
  });
}

/* the seal tuning page's own grounds: night and graphite, written as in that page */
const SEAL_PAL: Record<string, Record<string, [number, number, number]>> = {
  night: { ground: [0.19, 0.0025, 157.5], ink: [0.95, 0.003, 157.5], ink2: [0.74, 0.003, 157.5], green: [0.762, 0.154, 159.4], tagink: [0.12, 0.025, 160] },
  graphite: { ground: [0.93, 0.003, 250], ink: [0.2, 0.003, 250], ink2: [0.37, 0.003, 250], green: [0.762, 0.154, 159.4], tagink: [0.12, 0.025, 160] },
};
export function sealPaperVars(name: string): Record<string, string> {
  const p = SEAL_PAL[name] || SEAL_PAL.night, o: Record<string, string> = {};
  for (const k in p) o[k] = 'oklch(' + p[k].join(' ') + ')';
  return o;
}

export function headScript(look: Boot['look']): string {
  const pal: Boot['pal'] = {};
  GROUNDS.forEach((g) => { const v = groundVars(g); pal[g] = { paper: v.paper, vars: v.vars }; });
  const B: Boot = { pal, hex: GROUND_HEX, look, seal: { night: sealPaperVars('night'), graphite: sealPaperVars('graphite') } };
  return '(' + boot.toString() + ')(' + JSON.stringify(B) + ');';
}
