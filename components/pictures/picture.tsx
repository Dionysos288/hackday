'use client';
import { useSyncExternalStore } from 'react';
import type { Project } from '@/lib/data';
import { PICTURE_H, PICTURE_W, drawPicture } from '@/lib/pictures';

/* Every picture is a project picture. The sample ones are drawn in the browser (lib/pictures.ts), one blob URL per
   project, once the page's fonts are in so their lettering is set in Geist. The server and the first client render
   have no URL yet, so hydration matches; the image fills in right after. */
const urls = new Map<number, string>();
let fontsReady = false;
const subs = new Set<() => void>();
function subscribe(fn: () => void) {
  subs.add(fn);
  if (!fontsReady && typeof document !== 'undefined') {
    document.fonts.ready.then(() => { if (fontsReady) return; fontsReady = true; subs.forEach((f) => f()); });
  }
  return () => { subs.delete(fn); };
}
function fontFamilies() {
  const cs = getComputedStyle(document.documentElement);
  return { sans: cs.getPropertyValue('--font-geist').trim() || '"Geist"', mono: cs.getPropertyValue('--font-geist-mono').trim() || '"Geist Mono"' };
}
function urlFor(p: Project): string {
  if (p.image) return p.image;
  if (!fontsReady) return '';
  let u = urls.get(p.id);
  if (u == null) {
    u = '';
    try {
      const cv = document.createElement('canvas'); cv.width = PICTURE_W; cv.height = PICTURE_H;
      const c = cv.getContext('2d');
      if (c) {
        drawPicture(c, p, fontFamilies());
        const b = atob(cv.toDataURL('image/jpeg', 0.86).split(',')[1]), a = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
        u = URL.createObjectURL(new Blob([a], { type: 'image/jpeg' }));
      }
    } catch { /* no canvas: no picture */ }
    urls.set(p.id, u);
  }
  return u;
}
export function usePicture(p: Project | null | undefined): string {
  return useSyncExternalStore(subscribe, () => (p ? urlFor(p) : ''), () => (p && p.image) || '');
}

/* a project's picture, or a dashed empty frame when there is no project */
export function Picture({ p, cls = 'pic' }: { p: Project | null | undefined; cls?: string }) {
  const src = usePicture(p);
  if (!p) return <i className={cls + ' pic-empty'} />;
  // eslint-disable-next-line @next/next/no-img-element -- a drawn blob URL, not a static asset
  return <img className={cls} src={src || undefined} alt="" decoding="async" />;
}
