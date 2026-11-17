'use client';
import type { CSSProperties } from 'react';
import clsx from 'clsx';
import { NB, cityHref, fmtN, homeHref, lastTen, latest, local, ord, plural, projectHref, restOfDay, tableView } from '@/lib/city';
import { BELOW, LABEL } from '@/components/shared/page-parts';
import { SLOT_A } from '@/components/home/timetable';
import { useCity } from './city-context';
import { YOURS, rankCls, useOpenRow, useRowAttrs } from './sheet-parts';
import { RowAct } from './final-parts';

/* Below the sheet: the latest votes, every other entry, and the rest of the day */
/* the sheet's three columns, under it */
const ON_ROW = 'grid grid-cols-[var(--nameW)_var(--stripW)_var(--slotW)] gap-x-(--g)';

export function Ledger() {
  const { W, cfg: c } = useCity();
  if (c.ledger === 'off') return null;
  const ev = latest(W, 5), note = 'col-span-full block text-md text-ink-2';
  let body;
  if (W.state === 'next') body = <li className={note}>Votes show here once voting opens at {local(W, W.x.start)}.</li>;
  else if (W.voting && !ev.length) body = <li className={note}>Voting is open. No votes yet.</li>;
  else if (W.state === 'done') body = <li className={note}>Voting closed at {local(W, W.x.end)}. {plural(W.total, 'vote')} in all.</li>;
  else body = ev.map((e, j) => {
    const sAgo = Math.round((W.now - e.m) * 60);
    return (
      <li key={j} className="grid min-w-0 gap-y-0.5 phone:grid-cols-[64px_minmax(0,1fr)_auto] phone:items-baseline phone:gap-x-2">
        <span className="font-mono text-label/[1.2] font-medium tracking-label whitespace-nowrap text-ink-2 tabular-nums">{sAgo < 3 ? 'Just now' : sAgo < 60 ? sAgo + NB + 's ago' : local(W, e.m)}</span>
        <span className="truncate text-md font-medium" title={e.o.p.name}>{e.o.p.name}</span><span className="text-xs text-ink-2">{ord(e.o.rank)}</span>
      </li>
    );
  });
  return (
    <section className={clsx(BELOW, ON_ROW, 'min-h-[120px] items-start py-6 phone:grid-cols-[minmax(0,1fr)] phone:gap-y-3')} aria-labelledby="lg-h">
      <h2 className={LABEL} id="lg-h">Latest votes</h2>
      <ol className="grid grid-cols-5 gap-x-(--g) phone:min-h-[176px] phone:grid-cols-[minmax(0,1fr)] phone:content-start phone:gap-y-2">{body}</ol>
      <p className="text-sm text-ink-2 phone:min-h-14">{W.voting ? <><b className="block text-h1 leading-[1.1] font-medium text-ink tabular-nums">{fmtN(lastTen(W))}</b> in the last 10{NB}minutes</> : null}</p>
    </section>
  );
}

const SORTS: [string, string][] = [['ranked', 'Ranked'], ['shuffled', 'Shuffled'], ['newest', 'Newest']];
/* the table's faded columns: handle, pitch, arrival */
const TB_FADED = 'min-w-0 truncate text-ink-2 phone:hidden';
/* every entry not in the sheet: search, sort, and the first thirty until asked for all */
export function EntriesTable() {
  const { W, cfg: c, L, shownIds, setUi } = useCity(), t = tableView(W, c, shownIds), attrs = useRowAttrs(), open = useOpenRow();
  return (
    <section className={clsx(BELOW, 'pt-6 pb-8')} id="entries" aria-labelledby="tb-h">
      <div className={clsx(ON_ROW, 'mb-3 items-center phone:grid-cols-[minmax(0,1fr)] phone:gap-y-3')}>
        <h2 className={LABEL} id="tb-h">All projects <span className="text-ink">{fmtN(W.arrived.length)}</span></h2>
        <label><span className="sr-only">Search projects</span>
          <input type="search" data-k="q" placeholder="Search by name or @handle" value={c.q} autoComplete="off" spellCheck={false} onChange={(e) => setUi({ q: e.target.value, more: 0 })}
            className="h-10 w-full px-3 font-sans text-md/none font-regular text-ink edge-line placeholder:text-ink-2 focus-visible:-outline-offset-1 phone:h-11" /></label>
        <div className="grid grid-cols-[repeat(3,1fr)]" role="group" aria-label="Sort">
          {SORTS.map((s, j) => {
            const dis = s[0] === 'ranked' && !W.votesOn, on = t.sort === s[0];
            return (
              <button key={s[0]} type="button" data-sort={s[0]} aria-pressed={on} disabled={dis} title={dis ? 'No ranking while building' : undefined} onClick={() => setUi({ sort: s[0] })}
                className={clsx('h-10 text-sm phone:h-11', j > 0 && '-ml-px', on ? 'bg-ink text-ground' : 'edge-line', dis ? 'cursor-not-allowed text-tint-3' : 'cursor-pointer', !on && !dis && 'text-ink-2 hover:bg-tint-1')}>{s[1]}</button>
            );
          })}
        </div>
      </div>
      {t.note ? <p className="mb-3 text-sm text-ink-2">{t.note}</p> : null}
      {t.empty ? <p className="mb-3 text-sm text-ink-2">{t.empty}</p> : null}
      <ol>
        {t.rows.map((o) => (
          <li key={'t' + o.p.id} {...attrs(o, clsx('tb-r relative grid h-[calc(var(--tbh)*1px)] grid-cols-[var(--nameW)_var(--c2)_var(--c3)_minmax(0,1fr)_minmax(0,1fr)_var(--vbw)] items-center gap-x-(--g) text-sm rule-b wash hover:bg-tint-1 phone:h-[max(56px,calc(var(--tbh)*1px))] phone:grid-cols-[minmax(0,1fr)_auto_auto]', c.you === o.k && 'is-you'), undefined, 't')}>
            <a className="tb-n stretched flex h-full min-w-0 items-center gap-3 text-md font-medium whitespace-nowrap outline-none" href={projectHref(W, o.p, L)} data-pid={o.p.id} data-row onClick={(e) => open(e, o.p.id)}>
              <span className={clsx(rankCls(W, o), 'font-regular')}>{W.votesOn ? o.rank : ''}</span><span className="overflow-hidden text-ellipsis">{o.p.name}</span>{c.you === o.k ? <b className={clsx(YOURS, 'flex-none self-center')} data-g="1">Yours</b> : null}
            </a>
            <span className={TB_FADED}>@{o.p.handle}</span><span className={TB_FADED}>{o.p.pitch}</span><span className={clsx(TB_FADED, 'text-right tabular-nums')}>{local(W, o.arrive)}</span>
            <span className="text-right text-md font-medium tabular-nums">{W.votesOn ? fmtN(o.v) : ''}</span><RowAct o={o} at="table" />
          </li>
        ))}
      </ol>
      {t.more ? <button type="button" className="mt-4 block h-11 cursor-pointer px-4 text-sm edge-ink-2 hover:bg-tint-1" data-more="1" onClick={() => setUi({ more: 1 })}>Show all {fmtN(t.total)}</button> : null}
    </section>
  );
}

/* the other nine cities, on the day's axis; each a link to its page */
export function RestOfDay() {
  const { W, L } = useCity(), d = restOfDay(W);
  return (
    <section className={clsx(BELOW, 'py-8')} aria-labelledby="rd-h">
      <h2 className={clsx(LABEL, 'flex items-baseline justify-between')} id="rd-h">The rest of the day <a className="relative font-sans text-sm/none font-medium tracking-[0] normal-case text-ink underline-link after:absolute after:-inset-x-2 after:-inset-y-[15px]" href={homeHref(W, '', L)}>See the whole day</a></h2>
      <div className="relative">
        <ol>
          {d.rows.map((r) => {
            const live = r.y.state === 'build' || r.y.state === 'vote';
            return (
              <li key={r.y.i} className={clsx('rd-r relative grid h-12 items-center rule-b wash hover:bg-tint-1 phone:h-16 phone:grid-cols-[minmax(0,1fr)_auto] phone:grid-rows-[28px_20px] phone:content-center', ON_ROW, 'is-' + r.y.state)} data-k={'d' + r.y.i}>
                <a className={clsx('rd-n stretched flex items-baseline justify-between gap-3 text-xl tracking-snug whitespace-nowrap outline-none phone:row-start-1 phone:text-lg', live && 'font-semibold')} href={cityHref(W, r.y.id, L)}>{r.y.name}<span className="text-xs font-regular tracking-[0] text-ink-2 tabular-nums phone:hidden">{r.loc}</span></a>
                <span className="strip rd-s" aria-hidden="true"><i className="bar" style={{ left: r.l + '%', width: r.w + '%', '--bf': r.bf + '%', '--fill': r.fill + '%' } as CSSProperties}><i className="bar-b" /><i className="bar-v" /><i className="bar-run" /></i></span>
                <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 phone:col-start-2 phone:row-start-1 phone:grid-cols-[auto] phone:justify-items-end"><span className="type-label flex items-center gap-1.5 truncate text-ink-2 phone:hidden">{r.t[0]}</span><span className={SLOT_A}>{r.t[1]}</span></span>
              </li>
            );
          })}
        </ol>
        {d.nx != null ? <i className="pointer-events-none absolute top-0 bottom-0 left-[calc(var(--nameW)+var(--g)+var(--stripW)*var(--nx))] -ml-px w-0.5 bg-accent phone:hidden" style={{ '--nx': d.nx } as CSSProperties} aria-hidden="true" data-g="1" /> : null}
      </div>
    </section>
  );
}
