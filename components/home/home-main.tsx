'use client';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useDay } from './day-context';

/* <main>, with the look's custom properties. The pick reveal is a class set here while it runs (its age goes in as a
   negative delay, so a later frame never restarts it); React never writes the class list after the first render. */
export function HomeMain({ style, children }: { style: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null), { ages } = useDay(), age = ages.pick;
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.classList.toggle('reveal', age != null);
    if (age != null) el.style.setProperty('--rage', '-' + age + 'ms');
  }, [age]);
  return <main ref={ref} className="dl-page relative min-h-screen overflow-x-clip" id="top" style={style}>{children}</main>;
}
