'use client';
import type { CSSProperties, MouseEvent } from 'react';
import { EPOCH, EVENT } from '@/lib/day-data';
import { action, cityHref, facts, homeHref, miniDay, r2, status } from '@/lib/city';
import { SupabaseMark } from '@/components/shared/supabase-mark';
import { useForms } from '@/components/forms/forms-provider';
import { useCity } from './city-context';

/* The masthead: the mark (home), the whole day in miniature (every bar a link to its city), the status line and the
   one main action. Remind me and Submit open forms; the rest are links. */
export function CityMasthead() {
  const { W, cfg: c, L, mainRef, cur: curRef } = useCity(), forms = useForms(), a = action(W, L), m = miniDay(W);
  const at = (min: number) => new Date(EPOCH + min * 60000);
  const formAct = () => {
    if (!forms) return;
    if (a.act === 'submit') forms.submit({ city: W.city.id, cityName: W.city.name, deadline: at(W.x.buildEnd) });
    if (a.act === 'remind') forms.remind({ city: W.city.id, cityName: W.city.name, when: at(W.x.start) });
  };
  /* Vote takes you to the first row of the sheet */
  const onVote = (e: MouseEvent) => { e.preventDefault(); const f = mainRef.current?.querySelector<HTMLElement>('.cl-sheet a[data-row]'); if (f) { f.focus(); curRef.current = 0; } };
  return (
    <header className="mh mh-band cl-mh">
      <a className="mh-mark" href={homeHref(W, '', L)} aria-label="Supabase Hackathon, the whole day"><SupabaseMark /><span>supabase <b>hackathon</b></span></a>
      <nav className="mini" data-style={c.mini || undefined} aria-label="The whole day">
        <a className="mini-home" href={homeHref(W, '', L)}><span className="mini-k">The day</span><span className="mini-v">{EVENT.date}</span></a>
        <span className="mini-plot">
          {m.bars.map((b) => (
            <a key={b.y.id} className={'mini-b is-' + b.y.state + (b.me ? ' is-me' : '')} href={cityHref(W, b.y.id, L)}
              style={{ '--l': b.l + '%', '--w': b.w + '%', '--j': b.j, '--fill': b.fill + '%' } as CSSProperties} aria-current={b.me ? 'page' : undefined} aria-label={b.y.name}><i /></a>
          ))}
          {m.now != null ? <i className="mini-now" style={{ left: m.now + '%' }} data-g="1" /> : null}
        </span>
      </nav>
      <p className="mh-status">{status(W)}</p>
      {a.act
        ? <button type="button" className="mh-act g" data-g="1" data-act={a.act} onClick={formAct}>{a.t}</button>
        : <a className="mh-act g" data-g="1" href={a.href} data-act={W.state} onClick={W.state === 'vote' ? onVote : undefined}>{a.t}</a>}
    </header>
  );
}

/* The title: the city's name, the largest thing on its page, and four facts */
export function CityTitle() {
  const { W, cfg: c } = useCity(), nm = W.city.name, tem = r2(nm.length * 0.5 + 0.3);
  return (
    <section className="cl-title" data-title={c.title || undefined} aria-label={nm}>
      <h1 className="cl-city" style={{ '--tem': tem } as CSSProperties}>{nm}</h1>
      <dl className="cl-facts">
        {facts(W).map((f, j) => <div key={j} className={'fact' + (j === 0 ? ' fact-clock' : '')}><dt>{f[0]}</dt><dd>{f[1]}</dd></div>)}
      </dl>
    </section>
  );
}
