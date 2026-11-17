'use client';
import { EVENT } from '@/lib/day-data';
import { NB } from '@/lib/format';
import { Picture } from '@/components/pictures/picture';
import { useDay } from './day-context';

/* the day after: this hackathon joins the past ones, at the top of the list */
export function ArchivedRow() {
  const { W } = useDay();
  if (!W.archived) return null;
  const pc = W.pick, p = pc.win.p;
  return (
    <li className="ps-fold">
      <span className="ps-d">{EVENT.date}</span><span className="ps-n">{EVENT.name}</span><span className="ps-f">Ten cities, one day</span>
      <span className="ps-e">{W.total.toLocaleString('en-US') + NB + 'entries'}</span><span className="ps-w">{p.name + ', ' + pc.name}</span>
      <span className="ps-pic"><Picture p={p} /></span>
    </li>
  );
}
