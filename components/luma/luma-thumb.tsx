'use client';
import { useLayoutEffect, useRef } from 'react';
import { BuilderLogo } from '@/components/wheel/builder-logo';
import { StatusIcon } from '@/components/wheel/wheel';
import { SupabaseMark } from '@/components/shared/supabase-mark';
import type { WheelStatus } from '@/components/wheel/click';
import './luma-thumb.css';

/* A city's Luma event cover, from the "City headline" frame in the LW17 x Hackathon 26 file: the Builder Day mark, the
   city, its registration state, its session and the date, and who hosts it. It is laid out on the frame's own
   1024 px square and scaled to `size`, so a still of it at size 1024 is the image Luma takes. */

export const THUMB = 1024;
const STATE: Record<WheelStatus, string> = { open: 'Registration Open', nearing: 'Nearing capacity', full: 'Waiting list' };

/* "10th Dec 2026" as the frame writes it: "10th DEC 2026" */
export function thumbDate(date: string) {
  return date.replace(/ ([A-Za-z]+) /, (m) => m.toUpperCase());
}

/* "09:00–11:00 UTC+9" as the frame writes it: "09–11 UTC+9", whole hours without their minutes */
export function shortSession(session: string) {
  return session.replace(/(\d\d):00(?=\D)/g, '$1');
}

export function LumaThumb({ name, status, session, date, size = THUMB }: { name: string; status: WheelStatus; session: string; date: string; size?: number }) {
  const city = useRef<HTMLParagraphElement>(null);
  /* a long name steps down from the frame's size until it fits the square */
  useLayoutEffect(() => {
    const el = city.current; if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      const room = el.clientWidth, wide = el.scrollWidth;
      /* clientWidth is the box between the frame's margins; the name does not wrap, so scrollWidth is its width */
      if (wide > room) el.style.fontSize = `${(parseFloat(getComputedStyle(el).fontSize) * room) / wide}px`;
    };
    fit(); document.fonts?.ready.then(fit);
  }, [name]);
  return (
    <div className="lt-box" style={{ width: size, height: size }}>
      <div className="lt" style={{ transform: `scale(${size / THUMB})` }} role="img" aria-label={`Builder Day ${name}: ${STATE[status]}, ${session}, ${date}. Hosted by Supabase.`}>
        <div className="lt-mark"><BuilderLogo className="lt-logo" /><span>Builder Day</span></div>
        <p ref={city} className="lt-city">{name}</p>
        <div className="lt-state" data-status={status}><StatusIcon status={status} /><span>{STATE[status]}</span></div>
        <div className="lt-cells"><span>{shortSession(session)}</span><span>{thumbDate(date)}</span></div>
        <div className="lt-rule" />
        <div className="lt-host"><span>Hosted by</span><span className="lt-supabase"><SupabaseMark /><span>supabase</span></span></div>
      </div>
    </div>
  );
}
