'use client';
import type { CSSProperties } from 'react';
import { NB, cityHref, fmtN, homeHref, lastTen, latest, local, ord, plural, projectHref, restOfDay, tableView } from '@/lib/city';
import { useCity } from './city-context';
import { VoteBtn, useOpenRow, useRowAttrs } from './sheet-parts';

/* Below the sheet: the latest votes, every other entry, and the rest of the day */

export function Ledger() {
  const { W, cfg: c } = useCity();
  if (c.ledger === 'off') return null;
  const ev = latest(W, 5);
  let body;
  if (W.state === 'next') body = <li className="lg-note">Votes show here once voting opens at {local(W, W.x.start)}.</li>;
  else if (W.voting && !ev.length) body = <li className="lg-note">Voting is open. No votes yet.</li>;
  else if (W.state === 'done') body = <li className="lg-note">Voting closed at {local(W, W.x.end)}. {plural(W.total, 'vote')} in all.</li>;
  else body = ev.map((e, j) => {
    const sAgo = Math.round((W.now - e.m) * 60);
    return <li key={j}><span className="lg-t">{sAgo < 3 ? 'Just now' : sAgo < 60 ? sAgo + NB + 's ago' : local(W, e.m)}</span><span className="lg-n" title={e.o.p.name}>{e.o.p.name}</span><span className="lg-r">{ord(e.o.rank)}</span></li>;
  });
  return (
    <section className="cl-ledger" aria-labelledby="lg-h">
      <h2 className="lbl" id="lg-h">Latest votes</h2><ol>{body}</ol>
      <p className="lg-c">{W.voting ? <><b>{fmtN(lastTen(W))}</b> in the last 10{NB}minutes</> : null}</p>
    </section>
  );
}

const SORTS: [string, string][] = [['ranked', 'Ranked'], ['shuffled', 'Shuffled'], ['newest', 'Newest']];
/* every entry not in the sheet: search, sort, and the first thirty until asked for all */
export function EntriesTable() {
  const { W, cfg: c, L, shownIds, setUi } = useCity(), t = tableView(W, c, shownIds), attrs = useRowAttrs(), open = useOpenRow();
  return (
    <section className="cl-table" id="entries" aria-labelledby="tb-h">
      <div className="tb-head">
        <h2 className="lbl" id="tb-h">{W.votesOn ? 'All projects' : 'All entries'} <span>{fmtN(W.arrived.length)}</span></h2>
        <label className="tb-q"><span className="vh">Search {W.votesOn ? 'projects' : 'entries'}</span>
          <input type="search" data-k="q" placeholder="Search by name or @handle" value={c.q} autoComplete="off" spellCheck={false} onChange={(e) => setUi({ q: e.target.value, more: 0 })} /></label>
        <div className="tb-sorts" role="group" aria-label="Sort">
          {SORTS.map((s) => { const dis = s[0] === 'ranked' && !W.votesOn; return <button key={s[0]} type="button" className="tb-s" data-sort={s[0]} aria-pressed={t.sort === s[0]} disabled={dis} title={dis ? 'No ranking while building' : undefined} onClick={() => setUi({ sort: s[0] })}>{s[1]}</button>; })}
        </div>
      </div>
      {t.note ? <p className="tb-note">{t.note}</p> : null}
      {t.empty ? <p className="tb-empty">{t.empty}</p> : null}
      <ol className="tb-rows">
        {t.rows.map((o) => (
          <li key={'t' + o.p.id} {...attrs(o, 'tb-r' + (c.you === o.k ? ' is-you' : ''), undefined, 't')}>
            <a className="tb-n" href={projectHref(W, o.p, L)} data-pid={o.p.id} data-row onClick={(e) => open(e, o.p.id)}>
              <span className="rk">{W.votesOn ? o.rank : ''}</span><span className="pn">{o.p.name}</span>{c.you === o.k ? <b className="you" data-g="1">Yours</b> : null}
            </a>
            <span className="tb-h">@{o.p.handle}</span><span className="tb-p">{o.p.pitch}</span><span className="tb-a">{local(W, o.arrive)}</span>
            <span className="tb-v">{W.votesOn ? fmtN(o.v) : ''}</span><VoteBtn o={o} cls="vb-s" />
          </li>
        ))}
      </ol>
      {t.more ? <button type="button" className="tb-more" data-more="1" onClick={() => setUi({ more: 1 })}>Show all {fmtN(t.total)}</button> : null}
    </section>
  );
}

/* the other nine cities, on the day's axis; each a link to its page */
export function RestOfDay() {
  const { W, L } = useCity(), d = restOfDay(W);
  return (
    <section className="cl-rest" aria-labelledby="rd-h">
      <h2 className="lbl" id="rd-h">The rest of the day <a href={homeHref(W, '', L)}>See the whole day</a></h2>
      <div className="rd-wrap">
        <ol>
          {d.rows.map((r) => (
            <li key={r.y.i} className={'rd-r is-' + r.y.state} data-k={'d' + r.y.i}>
              <a className="rd-n" href={cityHref(W, r.y.id, L)}>{r.y.name}<span className="rd-loc">{r.loc}</span></a>
              <span className="strip rd-s" aria-hidden="true"><i className="bar" style={{ left: r.l + '%', width: r.w + '%', '--bf': r.bf + '%', '--fill': r.fill + '%' } as CSSProperties}><i className="bar-b" /><i className="bar-v" /><i className="bar-run" /></i></span>
              <span className="rd-t"><span className="slot-k">{r.t[0]}</span><span className="slot-a">{r.t[1]}</span></span>
            </li>
          ))}
        </ol>
        {d.nx != null ? <i className="rd-now" style={{ '--nx': d.nx } as CSSProperties} aria-hidden="true" data-g="1" /> : null}
      </div>
    </section>
  );
}
