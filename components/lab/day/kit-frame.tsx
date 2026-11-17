'use client';
import { useEffect, useRef } from 'react';
import screenCfg from '@/saved/screen.config.json';
import { clampScreen } from '@/components/screen/config';
import { applyScreen } from '@/components/screen/apply';
import { measure, type Contrast } from '../screen/contrast';

/* The baseline of a day lab: the page as it stands (its own lab at the same minute, panel closed), framed, with the
   screen kit as saved in /lab/screen put on it from here, as /lab/screen does. The framed page is not changed. */
export function KitFrame({ src, title, onMeasure }: { src: string; title: string; onMeasure?: (c: Contrast) => void }) {
  const frame = useRef<HTMLIFrameElement>(null), report = useRef(onMeasure);
  useEffect(() => { report.current = onMeasure; }, [onMeasure]);
  const onLoad = () => {
    let tries = 0;
    /* wait until the framed page has hydrated: React marks a node it has hydrated with a __reactFiber key */
    const wait = () => {
      const d = frame.current?.contentDocument;
      const fibre = (e: Element) => Object.keys(e).some((k) => k.startsWith('__reactFiber'));
      const parts = d ? Array.from(d.querySelectorAll('main, h1')) : [];
      if (!(parts.length > 0 && parts.every(fibre)) && tries++ < 100) { window.setTimeout(wait, 100); return; }
      if (!d?.body) return;
      const c = clampScreen(screenCfg);
      applyScreen(d, c);
      window.setTimeout(() => { const dd = frame.current?.contentDocument; if (dd?.body && report.current) report.current(measure(dd, c)); }, 400);
    };
    wait();
  };
  return <iframe ref={frame} key={src} className="dl-kitframe" src={src} title={title} onLoad={onLoad} />;
}
