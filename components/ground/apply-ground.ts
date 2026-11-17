/* sets a ground on <html> after the page has loaded (a tuning page's ground knob, or a page whose config names
   another ground than the head script chose). The same values the head script writes before first paint. */
import { GROUND_HEX, groundVars } from '@/lib/palette';

let current = '';
export function applyGround(name: string): void {
  if (name === current || typeof document === 'undefined') return;
  current = name;
  const g = groundVars(name), d = document.documentElement;
  if (d.dataset.ground === g.key && d.style.getPropertyValue('--ground') === g.vars.ground) return;
  for (const k in g.vars) d.style.setProperty('--' + k, g.vars[k]);
  d.dataset.paper = g.paper; d.dataset.ground = g.key;
  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', GROUND_HEX[g.key]);
}
