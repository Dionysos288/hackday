'use client';
/* The desk: one screen for every role, drawn from a DeskState and acting through one act(). /lab/desk feeds it sample
   data and a local act; /desk feeds it /api/desk/state and POST /api/desk. Which tabs show depends on the role:
   - a host: Today, Guests, Entries, Stage, Door;
   - a judge: Today and Entries (with flags);
   - a super admin: all of those, and Cities, People, Switches, The pick, Outbox, Log. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DeskAct, DeskState } from '@/lib/event/desk';
import { Announcer, useAsk } from './parts';
import { Today } from './today';
import { Guests } from './guests';
import { Entries } from './entries';
import { Deck } from './deck';
import { Door } from './door';
import { Cities, Log, Outbox, People, Pick, Switches } from './admin';
import './desk.css';
import '@/components/forms/forms.css';
import { EVENT } from '@/lib/day-data';

type Tab = { id: string; label: string; wide?: boolean };
const HOST: Tab[] = [{ id: 'today', label: 'Today' }, { id: 'guests', label: 'Guests' }, { id: 'entries', label: 'Entries' }, { id: 'stage', label: 'Stage' }, { id: 'door', label: 'Door' }];
const JUDGE: Tab[] = [{ id: 'today', label: 'Today' }, { id: 'entries', label: 'Entries' }];
const SUPER: Tab[] = [{ id: 'cities', label: 'Cities' }, { id: 'people', label: 'People' }, { id: 'switches', label: 'Switches' }, { id: 'pick', label: 'The pick' }, { id: 'outbox', label: 'Outbox', wide: true }, { id: 'log', label: 'Log', wide: true }];

export function tabsFor(s: DeskState): { city: Tab[]; admin: Tab[] } {
  return { city: s.can.host ? HOST : s.can.judge ? JUDGE : s.can.super ? JUDGE : [], admin: s.can.super ? SUPER : [] };
}

export function Desk({ s, act, now, onCity, onSignOut, site, tab: tab0 }: {
  s: DeskState; act: DeskAct; now: number; onCity: (id: string) => void; onSignOut?: () => void; site: string; tab?: string;
}) {
  const { city, admin } = useMemo(() => tabsFor(s), [s]);
  const all = useMemo(() => city.concat(admin), [city, admin]);
  const [want, setTab] = useState(tab0 || ''), [was, setWas] = useState(tab0);
  if (was !== tab0) { setWas(tab0); if (tab0) setTab(tab0); }
  const tab = all.some((t) => t.id === want) ? want : all[0]?.id || 'today';
  /* the chosen tab stays in sight when the row scrolls on a phone */
  const rowRef = useRef<HTMLDivElement>(null);
  /* the fades at the row's ends show only while there is more to scroll that way */
  const ends = () => { const el = rowRef.current; if (!el) return; el.dataset.l = el.scrollLeft > 2 ? '1' : ''; el.dataset.r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2 ? '1' : ''; };
  useEffect(() => {
    document.getElementById('dk-tab-' + tab)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); ends();
    /* the tab stays in the address, so a reload or coming back from the remote opens it again */
    const u = new URL(location.href); if (u.searchParams.get('tab') !== tab) { u.searchParams.set('tab', tab); history.replaceState(history.state, '', u); }
  }, [tab]);
  /* the city just chosen shows in the select while it loads */
  const [pend, setPend] = useState<string | null>(null);
  const shownCity = pend && pend !== s.city ? pend : s.city;
  useEffect(() => { window.addEventListener('resize', ends); return () => window.removeEventListener('resize', ends); }, []);
  const { ask, node } = useAsk();
  const c = s.cities.find((x) => x.id === s.city) || null;
  const role = s.me.super ? 'Super admin' : s.me.roles.map((r) => (r.role === 'host' ? 'Host' : 'Judge') + ', ' + (r.city ? s.cities.find((x) => x.id === r.city)?.name || r.city : 'all cities')).join(' · ');

  const keyTabs = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = all.findIndex((t) => t.id === tab);
    const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -2;
    if (j === -2) return;
    e.preventDefault();
    const t = all[(j + all.length) % all.length]; setTab(t.id);
    requestAnimationFrame(() => document.getElementById('dk-tab-' + t.id)?.focus());
  };

  return (
    <div className={'dk' + (admin.length ? ' is-wide' : '')}>
      <header className="dk-head">
        <div className="dk-bar">
          <p className="dk-name">{EVENT.name} <span>Desk</span></p>
          <div className="dk-city">
            {s.cities.length > 1 ? (
              <>
                <label className="sr-only" htmlFor="dk-city">City</label>
                <select id="dk-city" value={shownCity || ''} onChange={(e) => { setPend(e.target.value); onCity(e.target.value); }}>
                  {s.cities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </>
            ) : c ? <b>{c.name}</b> : null}
          </div>
        </div>
        <div className="dk-tabs" role="tablist" aria-label="Desk" onKeyDown={keyTabs} ref={rowRef} onScroll={ends}>
          {city.map((t) => <TabKey key={t.id} t={t} on={tab === t.id} set={setTab} />)}
          {admin.length && city.length ? <span className="dk-tabgap" aria-hidden="true" /> : null}
          {admin.map((t) => <TabKey key={t.id} t={t} on={tab === t.id} set={setTab} />)}
        </div>
      </header>
      <main key={c?.id || 'none'} className="dk-main" id={'dk-panel-' + tab} role="tabpanel" aria-labelledby={'dk-tab-' + tab} tabIndex={-1}>
        <h1 className="sr-only">{(all.find((t) => t.id === tab)?.label || 'Desk') + (c ? ' · ' + c.name : '')}</h1>
        {!c ? <p className="dk-p">No city to show.</p>
          : tab === 'today' ? <Today s={s} c={c} now={now} act={act} ask={ask} go={setTab} />
            : tab === 'guests' ? <Guests s={s} c={c} now={now} act={act} ask={ask} />
              : tab === 'entries' ? <Entries s={s} c={c} now={now} act={act} />
                : tab === 'stage' ? <Deck s={s} c={c} act={act} ask={ask} />
                  : tab === 'door' ? <Door c={c} act={act} site={site} />
                    : tab === 'cities' ? <Cities s={s} c={c} now={now} act={act} ask={ask} />
                      : tab === 'people' ? <People s={s} act={act} ask={ask} />
                        : tab === 'switches' ? <Switches s={s} c={c} act={act} ask={ask} />
                          : tab === 'pick' ? <Pick s={s} c={c} now={now} act={act} ask={ask} />
                            : tab === 'outbox' ? <Outbox s={s} now={now} act={act} />
                              : tab === 'log' ? <Log s={s} now={now} /> : null}
      </main>
      <footer className="dk-main dk-foot">
        <p className="dk-note" style={{ margin: 0 }}>Signed in as <b>{s.me.name || s.me.email}</b>{s.me.name ? ' (' + s.me.email + ')' : ''} · {role}.</p>
        {onSignOut ? <button type="button" className="dk-t" onClick={onSignOut}>Sign out of the desk</button> : null}
      </footer>
      {node}
      <Announcer />
    </div>
  );
}

function TabKey({ t, on, set }: { t: Tab; on: boolean; set: (id: string) => void }) {
  return <button type="button" role="tab" id={'dk-tab-' + t.id} aria-selected={on} aria-controls={on ? 'dk-panel-' + t.id : undefined} tabIndex={on ? 0 : -1} className="dk-tab" onClick={() => set(t.id)}>{t.label}</button>;
}
