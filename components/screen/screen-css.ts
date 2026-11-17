/* The screen kit's styles, as text, so a page can put them in a <style> and the lab can put them into a framed page.
   Everything here is under html[data-sk], so it does nothing until a page turns the kit on.

   The lines, the grain and the dark corners are fixed layers on the ground, under the page (z-index -1), so they
   never take a press and never sit on small text. Big type gets the lines on itself through a mask, and its red and
   blue edges through two text shadows, as the wheel's link does. At depth "all" the mask is on the whole page. */
export const SCREEN_CSS = `
html[data-sk] { background: var(--sk-ground, var(--c-ground)); }
html[data-sk][data-sk-ground="wheel"] { --c-ground: #0c0d0d; --sk-ground: #0c0d0d; }
html[data-sk] body { background: transparent; }
html[data-sk][data-sk-lift] { --c-ink-3: oklch(0.71 0.0029 157.5); }
.sk-layers { position: fixed; inset: 0; z-index: -1; pointer-events: none; }
.sk-layers > div { position: absolute; inset: 0; }
.sk-lines { background: repeating-linear-gradient(to bottom, transparent 0 calc(var(--sk-pitch) - 1px), rgb(0 0 0 / var(--sk-line)) calc(var(--sk-pitch) - 1px) var(--sk-pitch)); }
.sk-grain { background-image: var(--sk-grain-img, none); background-size: var(--sk-grain-size) var(--sk-grain-size); image-rendering: pixelated; }
/* the corners darken on a cubic curve, as the wheel's screen pass does */
.sk-corners { background: radial-gradient(farthest-corner at 50% 50%, transparent 0, rgb(0 0 0 / calc(var(--sk-corners) * 0.086)) 50%,
  rgb(0 0 0 / calc(var(--sk-corners) * 0.237)) 70%, rgb(0 0 0 / calc(var(--sk-corners) * 0.424)) 85%, rgb(0 0 0 / calc(var(--sk-corners) * 0.691)) 100%); }
html[data-sk-depth="none"] .sk-layers { display: none; }

/* the lines on a piece of text: dark rows where the screen's lines are */
html[data-sk] { --sk-mask: repeating-linear-gradient(to bottom, #000 0 calc(var(--sk-pitch) - 1px), rgb(0 0 0 / calc(1 - var(--sk-line))) calc(var(--sk-pitch) - 1px) var(--sk-pitch)); }
html[data-sk-depth="big"] [data-sk-big], html[data-sk] .fringe-lines { -webkit-mask-image: var(--sk-mask); mask-image: var(--sk-mask); text-shadow: var(--sk-fringe); }
html[data-sk-depth="all"] body { -webkit-mask-image: var(--sk-mask); mask-image: var(--sk-mask); }
html[data-sk-depth="all"] body * { text-shadow: var(--sk-fringe); }
html[data-sk] .fringe { text-shadow: var(--sk-fringe); }

/* facts as table cells: mono, bordered, square, borders shared; a state is a filled cell with dark text and a shape */
html[data-sk] .cell { display: inline-flex; align-items: center; gap: 7px; margin: 0 -1px -1px 0; padding: 9px 12px; border: 1px solid #6b6c6b;
  background: var(--c-ground); color: var(--c-ink); font: 500 13px/1 var(--font-mono); white-space: nowrap; }
html[data-sk] .cell-open { border-color: #dcfce7; background: #dcfce7; color: #14532d; }
html[data-sk] .cell-closing { border-color: #f8d3a0; background: #f8d3a0; color: #6b2a00; }

/* glass: the kit's globes are drawn by one canvas over the page, at the places of [data-globe] */
.sk-globes { position: fixed; inset: 0; z-index: 60; width: 100vw; height: 100vh; pointer-events: none; }
`;

/* the grain: a 64 by 64 tile of light cells that never moves; the page shows each cell grainCell CSS pixels wide */
export function grainTile(doc: Document, amount: number): string {
  const c = doc.createElement('canvas'); c.width = c.height = 64;
  const p = c.getContext('2d'); if (!p) return 'none';
  const img = p.createImageData(64, 64);
  let a = 0x9e3779b9;
  for (let i = 0; i < 64 * 64; i++) {
    a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = Math.round(r * amount * 255);
  }
  p.putImageData(img, 0, 0);
  return `url(${c.toDataURL()})`;
}
