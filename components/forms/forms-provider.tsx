'use client';
import { Fragment, createContext, useCallback, useContext, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ShareProject } from '@/lib/forms';
import { emit, store, type Entry } from './store';
import { token } from './sheet';
import { SignInSheet, type SignInOpts, type Who } from './sign-in-sheet';
import { SubmitSheet, type SubmitOpts } from './submit-sheet';
import { RemindSheet, type RemindOpts } from './remind-sheet';
import { ShareSheet } from './share-sheet';

/* The forms a page can open: sign-in, the email step before a vote, submit, remind me, share. Each returns a promise
   that settles when its sheet has closed, so a page asks and waits ("is this person a voter?") without knowing how
   the sheet works. The data goes through store.ts, the one boundary an API replaces later. */
export type Forms = {
  signIn: () => Promise<Who | null>;
  ensureVoter: () => Promise<boolean>;
  submit: (o: SubmitOpts) => Promise<Entry | null>;
  remind: (o: RemindOpts) => Promise<boolean>;
  share: (p: ShareProject) => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;
};
const FormsContext = createContext<Forms | null>(null);
/* null outside a provider: a page without forms counts a vote locally */
export function useForms(): Forms | null { return useContext(FormsContext); }

type Open = { key: number; el: ReactElement };
export function FormsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open[]>([]);
  const seq = useRef(0), signInRun = useRef<Promise<Who | null> | null>(null), submitRun = useRef<Promise<Entry | null> | null>(null);

  /* opens one sheet on top of any already open; settles with what the sheet hands back as it closes */
  const show = useCallback(<T,>(render: (done: (v: T) => void) => ReactElement): Promise<T> => new Promise<T>((resolve) => {
    const key = ++seq.current;
    const done = (v: T) => { setOpen((l) => l.filter((x) => x.key !== key)); resolve(v); };
    setOpen((l) => l.concat({ key, el: render(done) }));
  }), []);

  const forms = useMemo<Forms>(() => {
    const emailStep = (o: SignInOpts): Promise<Who | null> => {
      const s = store.session(); if (s) return Promise.resolve({ handle: s.handle, email: s.email });
      if (signInRun.current) return signInRun.current;
      const run = show<Who | null>((done) => <SignInSheet o={o} done={done} />).then((r) => { signInRun.current = null; return r; });
      signInRun.current = run; return run;
    };
    const share = (p: ShareProject) => show<void>((done) => <ShareSheet p={p} done={() => done()} />);
    const projectOf = (e: Entry): ShareProject => ({ name: e.name, pitch: e.pitch, handle: e.handle, city: e.city, cityName: e.cityName, slug: e.slug });
    const submit = (o: SubmitOpts): Promise<Entry | null> => {
      if (submitRun.current) return submitRun.current;
      /* Edit entry, from the done view: the sheet closes, then opens again on the entry */
      const again = () => { window.setTimeout(() => { submit(o); }, token('--dur-panel-exit')); };
      const run = emailStep({}).then((who) => (who ? show<Entry | null>((done) => <SubmitSheet o={o} who={who} done={done} again={again} share={(e) => { share(projectOf(e)); }} />) : null))
        .then((r) => { submitRun.current = null; return r; });
      submitRun.current = run; return run;
    };
    return {
      signIn: () => emailStep({}),
      ensureVoter: () => {
        const s = store.session(); if (s && s.voter) return Promise.resolve(true);
        return emailStep({ label: 'Vote', title: 'Confirm your email to vote', reason: 'One vote per project, so we need an email.', verb: 'Confirm email' }).then((r) => !!r);
      },
      submit,
      remind: (o) => show<boolean>((done) => <RemindSheet o={o} done={done} />),
      share,
      signOut: () => store.signOut().then(emit),
      reset: () => { store.reset(); emit(); },
    };
  }, [show]);

  return (
    <FormsContext.Provider value={forms}>
      {children}
      {open.length ? createPortal(open.map((x) => <Fragment key={x.key}>{x.el}</Fragment>), document.body) : null}
    </FormsContext.Provider>
  );
}
