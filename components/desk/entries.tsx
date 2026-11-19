'use client';
/* Entries: the city's entries as they arrive, newest first, flagged ones first. A host can hide or show one, refresh
   its picture and open it; a judge sees the same list and its flags. */
import { useMemo } from 'react';
import { FLAG_WORDS, type DeskAct, type DeskCity, type DeskState } from '@/lib/event/desk';
import { ago, Sec, Status, usePress } from './parts';

export function Entries({ s, c, now, act }: { s: DeskState; c: DeskCity; now: number; act: DeskAct }) {
  const { busy, said, run } = usePress(act);
  const list = useMemo(() => s.entries.slice().sort((a, b) => Number(b.flags.length > 0) - Number(a.flags.length > 0) || b.created - a.created), [s.entries]);
  const flagged = list.filter((e) => e.flags.length).length, hidden = list.filter((e) => e.hidden).length;
  const aside = list.length + (list.length === 1 ? ' entry' : ' entries') + (flagged ? ', ' + flagged + ' flagged' : '') + (hidden ? ', ' + hidden + ' hidden' : '');
  return (
    <Sec title={'Entries in ' + c.name} id="dk-ent" aside={aside}>
      {s.can.host ? null : <p className="dk-note">You can see flags here. Only a host can hide an entry.</p>}
      {list.length ? (
        <ul className="dk-list">
          {list.map((e) => {
            const k = 'e:' + e.no;
            return (
              <li key={e.no} className={'dk-row has-pic' + (e.hidden ? ' is-off' : '')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {e.picture ? <img className="dk-pic" src={e.picture} alt="" loading="lazy" /> : <span className="dk-pic" aria-hidden="true" />}
                <div className="dk-who">
                  <b>{e.name}</b>
                  <span>{e.by || 'No name'}{e.byEmail ? ' · ' + e.byEmail : ''}</span>
                  <div className="dk-marks">
                    <span>{ago(e.created, now)}</span>
                    <span>{e.via === 'editor' ? 'From an editor' : 'From the web'}</span>
                    {e.hidden ? <span className="dk-mark-box">Hidden</span> : null}
                  </div>
                  {e.flags.length ? <ul className="dk-flags" aria-label="Flags">{e.flags.map((f) => <li key={f}>{FLAG_WORDS[f] || f}</li>)}</ul> : null}
                  <Status said={said} k={k} />
                </div>
                <p className="dk-num" style={{ margin: 0 }}>{e.votes}<small>{e.judge ? 'votes · ' + e.judge + ' from judges' : 'votes'}</small></p>
                <div className="dk-acts">
                  {s.can.host ? (
                    <button type="button" className="dk-t" disabled={busy === k} aria-label={(e.hidden ? 'Show ' : 'Hide ') + e.name} onClick={() => run(k, e.hidden ? 'entry.show' : 'entry.hide', { city: c.id, no: e.no }, () => e.hidden ? 'Shown again on the city page.' : 'Hidden from the city page and the ranking.')}>{e.hidden ? 'Show' : 'Hide'}</button>
                  ) : null}
                  {s.can.host ? <button type="button" className="dk-t" disabled={busy === k} aria-label={'Refresh ' + e.name + '’s picture'} onClick={() => run(k, 'entry.picture', { city: c.id, no: e.no }, () => 'The picture is fetched again from the project’s page.')}>Refresh picture</button> : null}
                  <a className="dk-t" href={'/city/' + c.id + '/p/' + e.slug} target="_blank" rel="noreferrer" aria-label={'Open ' + e.name + ' on the city page'}>Open</a>
                  <a className="dk-t" href={e.url} target="_blank" rel="noreferrer" aria-label={e.name + '’s live link'}>Live link</a>
                  {e.repo ? <a className="dk-t" href={e.repo} target="_blank" rel="noreferrer" aria-label={e.name + '’s repository'}>Repository</a> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="dk-note">No entries yet. They appear here the moment someone submits.</p>}
    </Sec>
  );
}
