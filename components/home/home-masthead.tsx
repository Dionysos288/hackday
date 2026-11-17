'use client';
import { EVENT } from '@/lib/day-data';
import { action, cityHref, status } from '@/lib/home';
import { SupabaseMark } from '@/components/shared/supabase-mark';
import { useDay } from './day-context';

/* cls: the layout's masthead (the home's is the band; the tuning page's other layouts use their own) */
export function HomeMasthead({ cls = 'mh-band' }: { cls?: string }) {
  const { cfg, W, carry } = useDay(), act = action(W, cfg, (x) => cityHref(x, cfg, W, carry)), g = cfg.green >= 2;
  return (
    <header className={'mh ' + cls}>
      <a className="mh-mark" href="#top" aria-label="Supabase Hackathon, top of the page"><SupabaseMark /><span>supabase <b>hackathon</b></span></a>
      <p className="mh-date"><span>{EVENT.date}</span><span className="mh-sub">Ten cities, one day</span></p>
      <p className="mh-status">{status(W)}</p>
      <a className={'mh-act' + (g ? ' g' : '')} href={act.href} data-g={g ? '1' : undefined}>{act.t}</a>
    </header>
  );
}
