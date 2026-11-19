'use client';
import Link from 'next/link';
/* /desk on the backend: reads /api/desk/state for the chosen city, acts through POST /api/desk and reads again. The
   state is read again every 15 seconds while the tab is showing, so counts and entries keep up without Realtime. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeskAct, DeskState } from '@/lib/event/desk';
import { Desk } from './desk';
import { DeskSignIn } from './sign-in';
import './desk.css';
import '@/components/forms/forms.css';
import { EVENT, CITY_WORD } from '@/lib/day-data';

type Load = { kind: 'loading' } | { kind: 'in'; why?: string } | { kind: 'no'; text: string } | { kind: 'ok'; s: DeskState };

export function DeskLive({ city: city0, mail, site, tab }: { city: string | null; mail: 'resend' | 'outbox'; site: string; tab?: string }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [now, setNow] = useState(() => Date.now());
  const city = useRef(city0);

  const read = useCallback(async () => {
    try {
      const r = await fetch('/api/desk/state' + (city.current ? '?city=' + encodeURIComponent(city.current) : ''), { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) return setLoad({ kind: 'in', why: /code from your email/.test(j.error || '') ? j.error : undefined });
      if (r.status === 403) return setLoad({ kind: 'no', text: j.error || 'This email has no role on the desk.' });
      if (r.status === 503) return setLoad({ kind: 'no', text: 'The desk opens when this site has its backend.' });
      if (!r.ok) return setLoad((l) => (l.kind === 'ok' ? l : { kind: 'no', text: j.error || 'The desk could not be read. Try again in a moment.' }));
      city.current = (j as DeskState).city;
      setLoad({ kind: 'ok', s: j as DeskState }); setNow(Date.now());
    } catch {
      setLoad((l) => (l.kind === 'ok' ? l : { kind: 'no', text: 'The desk could not be reached. Check the connection.' }));
    }
  }, []);

  useEffect(() => { read(); }, [read]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); } };
    const poll = () => { if (document.visibilityState === 'visible') read(); };
    const a = setInterval(tick, 1000 * 5), b = setInterval(poll, 15000);
    const vis = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(a); clearInterval(b); document.removeEventListener('visibilitychange', vis); };
  }, [read]);

  const act: DeskAct = useCallback(async (action, p = {}) => {
    const r = await fetch('/api/desk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...p }) });
    const j = await r.json().catch(() => ({ ok: false, error: 'That did not work. Try again.' }));
    if (r.status === 401) setLoad({ kind: 'in' });
    else if (r.ok && action !== 'import.preview' && action !== 'guest.link') await read();
    return r.ok ? { ...j, ok: true } : { ok: false, error: j.error || 'That did not work. Try again.' };
  }, [read]);

  const onCity = (id: string) => {
    city.current = id; read();
    const u = new URL(location.href); u.searchParams.set('city', id); history.replaceState(null, '', u);
  };
  const signOut = async () => { await fetch('/api/auth/out', { method: 'POST' }).catch(() => null); setLoad({ kind: 'in' }); };

  if (load.kind === 'loading') return <div className="dk"><main className="dk-in" aria-busy="true"><p className="dk-p">Opening the desk…</p></main></div>;
  if (load.kind === 'in') return <DeskSignIn mail={mail} why={load.why} onIn={() => { setLoad({ kind: 'loading' }); read(); }} />;
  if (load.kind === 'no') return (
    <div className="dk"><main className="dk-in"><div className="dk-in-card">
      <p className="dk-kicker">{EVENT.name} · Desk</p>
      <div><h1 className="dk-h">The desk is not open to you</h1><p className="dk-p">{load.text}</p></div>
      <div className="dk-acts-row"><button type="button" className="fm-b" onClick={signOut}>Sign in with another email</button><Link className="dk-t" href="/">See the {CITY_WORD} cities</Link></div>
    </div></main></div>
  );
  return <Desk s={load.s} act={act} now={now} onCity={onCity} onSignOut={signOut} site={site} tab={tab} />;
}
