'use client';
import { useEffect, useState } from 'react';
import { isGround } from '@/lib/palette';
import { FormsProvider, useForms, type Forms } from '@/components/forms/forms-provider';
import { useFormsState } from '@/components/forms/store';
import { applyGround } from '@/components/ground/apply-ground';
import '@/components/forms/forms.css';
import './forms-lab.css';

/* The forms tuning page: open each sheet, see the state the pages read, clear what is stored. */
const inHours = (h: number) => new Date(Date.now() + h * 3600000);
const SAMPLE = { name: 'Sentry Pup', pitch: 'A watchdog for your Edge Functions that barks in Slack before your users notice.', handle: 'mira_k', city: 'berlin', cityName: 'Berlin', slug: 'sentry-pup', votes: 45, rank: 1 };
const GROUNDS = [['night', 'Night'], ['paper', 'Paper'], ['mint', 'Mint']];

export function FormsLab({ ground }: { ground: string | null }) {
  return <FormsProvider><Lab ground={ground && isGround(ground) ? ground : 'night'} /></FormsProvider>;
}

function Lab({ ground: g0 }: { ground: string }) {
  const F = useForms() as Forms, st = useFormsState(), [log, setLog] = useState('Nothing yet.'), [ground, setGround] = useState(g0);
  useEffect(() => { applyGround(ground); const u = new URL(location.href); if (ground === 'night') u.searchParams.delete('ground'); else u.searchParams.set('ground', ground); history.replaceState(null, '', u); }, [ground]);
  /* Berlin: building for three more hours; Tokyo starts at midnight UTC today */
  const RUN: Record<string, () => Promise<unknown>> = {
    signIn: () => F.signIn(),
    ensureVoter: () => F.ensureVoter(),
    submit: () => F.submit({ city: 'berlin', cityName: 'Berlin', deadline: inHours(3) }),
    submitClosed: () => F.submit({ city: 'berlin', cityName: 'Berlin', deadline: inHours(-1 / 60) }),
    remind: () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return F.remind({ city: 'tokyo', cityName: 'Tokyo', when: d }); },
    share: () => F.share(SAMPLE),
    shareMine: () => { const e = st.entry; return F.share(e ? { name: e.name, pitch: e.pitch, handle: e.handle, city: e.city, cityName: e.cityName, slug: e.slug } : SAMPLE); },
    signOut: () => F.signOut(),
    reset: () => { F.reset(); return Promise.resolve('cleared'); },
  };
  const run = (n: string) => RUN[n]().then((v) => {
    const o = v && typeof v === 'object' && (v as { picture?: string }).picture ? { ...(v as object), picture: '(data URL)' } : v;
    setLog((n === 'submitClosed' ? 'submit' : n) + ' → ' + (v === undefined ? 'done' : typeof o === 'string' ? o : JSON.stringify(o)));
  });
  const e = st.entry ? { name: st.entry.name, city: st.entry.city, slug: st.entry.slug, picture: st.entry.picture ? 'yes' : 'no' } : null;
  const B = (n: string, t: string, g?: boolean) => <button key={n} className={'fm-b' + (g ? ' g' : '')} type="button" onClick={() => run(n)}>{t}</button>;
  return (
    <main className="lab">
      <header className="lab-h">
        <div><p className="lab-k">Supabase Hackathon</p><h1>Forms lab</h1></div>
        <div className="lab-seg" role="group" aria-label="Ground">{GROUNDS.map(([k, t]) => <button key={k} className="fm-b" type="button" aria-pressed={ground === k} onClick={() => setGround(k)}>{t}</button>)}</div>
      </header>
      <section className="lab-sec" aria-labelledby="k-flows">
        <p className="lab-k" id="k-flows">Flows</p>
        <div className="lab-row">
          {B('signIn', 'Sign in')}{B('ensureVoter', 'Vote (email step)')}{B('submit', 'Submit project', true)}{B('submitClosed', 'Submit after the deadline')}
          {B('remind', 'Remind me')}{B('share', 'Share a project')}{B('shareMine', 'Share your entry')}
        </div>
        <p className="lab-note">Any six digits work as the code. Submit opens sign-in first when no one is signed in. The network takes about 0.6{' '}s.</p>
      </section>
      <section className="lab-sec" aria-labelledby="k-state">
        <p className="lab-k" id="k-state">Forms state</p>
        <p className="lab-state" id="state" aria-live="polite">signedIn <b>{String(st.signedIn)}</b> · handle <b>{st.handle || 'null'}</b> · email <b>{st.email || 'null'}</b> · voter <b>{String(st.voter)}</b>{'\n'}entry <b>{e ? JSON.stringify(e) : 'null'}</b></p>
        <p className="lab-k" style={{ marginTop: 'var(--s-4)' }}>Last result</p>
        <p className="lab-log" id="log">{log}</p>
      </section>
      <section className="lab-sec" aria-labelledby="k-data">
        <p className="lab-k" id="k-data">Stored data</p>
        <div className="lab-row">{B('signOut', 'Sign out')}{B('reset', 'Reset stored data')}</div>
      </section>
    </main>
  );
}
