import { screenVars, type ScreenCfg } from './config';
import { SCREEN_CSS, grainTile } from './screen-css';

/* Turns the kit on in a document: the styles, the fixed layers on the ground, the values on <html>, and the lines on
   big type (any text at bigFrom pixels or more), kept up to date as the page changes. Returns the way to turn it off.
   The Screen component calls it on its own page; the lab calls it on a framed page. */

export type ScreenHandle = { update: (c: ScreenCfg) => void; off: () => void };

/* the path to an element as a selector, so big type can be styled from a stylesheet without touching the element */
function pathOf(e: Element): string {
  const parts: string[] = [];
  for (let x: Element | null = e; x && x.tagName !== 'BODY'; x = x.parentElement) {
    const p: Element | null = x.parentElement; if (!p) break;
    parts.unshift(`${x.tagName.toLowerCase()}:nth-child(${Array.prototype.indexOf.call(p.children, x) + 1})`);
  }
  return 'body > ' + parts.join(' > ');
}
/* big type: any element with its own words at bigFrom pixels or more. Written as a stylesheet of paths, not as marks
   on the elements, so a page that is still hydrating never sees an attribute it did not render. */
function markBig(doc: Document, from: number) {
  const win = doc.defaultView; if (!win) return;
  const paths: string[] = [];
  doc.body.querySelectorAll<HTMLElement>('h1, h2, h3, p, a, span, div, li, dd, dt, strong, b').forEach((e) => {
    if (e.closest('.lab, .sk-layers, [data-sk-skip]')) return;
    let own = false; e.childNodes.forEach((n) => { if (n.nodeType === 3 && n.textContent && n.textContent.trim()) own = true; });
    if (own && parseFloat(win.getComputedStyle(e).fontSize) >= from) paths.push(pathOf(e));
  });
  let s = doc.getElementById('sk-big');
  if (!s) { s = doc.createElement('style'); s.id = 'sk-big'; doc.head.appendChild(s); }
  s.textContent = paths.length ? `html[data-sk-depth="big"] :is(${paths.join(', ')}) { -webkit-mask-image: var(--sk-mask); mask-image: var(--sk-mask); text-shadow: var(--sk-fringe); }` : '';
}

export function applyScreen(doc: Document, first: ScreenCfg): ScreenHandle {
  const html = doc.documentElement;
  let style = doc.getElementById('sk-style') as HTMLStyleElement | null;
  if (!style) { style = doc.createElement('style'); style.id = 'sk-style'; style.textContent = SCREEN_CSS; doc.head.appendChild(style); }
  let layers = doc.querySelector<HTMLElement>('.sk-layers');
  if (!layers) {
    layers = doc.createElement('div'); layers.className = 'sk-layers'; layers.setAttribute('aria-hidden', 'true');
    layers.innerHTML = '<div class="sk-lines"></div><div class="sk-grain"></div><div class="sk-corners"></div>';
    doc.body.appendChild(layers);
  }
  let cfg = first, grainFor = -1, timer = 0;
  const set = (c: ScreenCfg) => {
    cfg = c;
    html.setAttribute('data-sk', ''); html.setAttribute('data-sk-depth', c.depth); html.setAttribute('data-sk-ground', c.ground);
    if (c.lift) html.setAttribute('data-sk-lift', ''); else html.removeAttribute('data-sk-lift');
    const v = screenVars(c); Object.keys(v).forEach((k) => html.style.setProperty(k, v[k]));
    if (grainFor !== c.grain) { grainFor = c.grain; html.style.setProperty('--sk-grain-img', grainTile(doc, c.grain)); }
    markBig(doc, c.bigFrom);
  };
  set(first);
  /* new text (a sheet that opens, a row that arrives) is marked a moment later */
  const mo = new MutationObserver(() => { const w = doc.defaultView; if (!w) return; w.clearTimeout(timer); timer = w.setTimeout(() => markBig(doc, cfg.bigFrom), 120); });
  mo.observe(doc.body, { childList: true, subtree: true });
  return {
    update: set,
    off() {
      mo.disconnect(); layers?.remove(); style?.remove();
      ['data-sk', 'data-sk-depth', 'data-sk-ground', 'data-sk-lift'].forEach((a) => html.removeAttribute(a));
      doc.getElementById('sk-big')?.remove();
    },
  };
}
