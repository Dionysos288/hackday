'use client';
import clsx from 'clsx';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { CHECKS, cityLabel, pictureError, atCity, withScheme, type FieldName } from '@/lib/forms';
import { emit, store, type Entry } from './store';
import { FM_ACT, FM_DONE, FM_F, FM_FORM, FM_H, FM_L, FM_NOTE, FM_P, FM_T, ErrBox, Sheet, useSheet } from './sheet';
import type { Who } from './sign-in-sheet';
import { FromEditor } from '@/components/day/get-ready';
import { RULES, SERVER } from '@/lib/hackday-server';
import { submit } from '@/lib/submit';

/* Submit: one entry per person. The same sheet edits it until building closes, then says so. A new entry gets two
   parts under one sentence about the rules: from your editor first (the sentence to say), then in the browser (this
   form). Both run the same checks. Editing an entry is the form alone. */
export type SubmitOpts = { city?: string; cityName?: string; deadline?: Date | string; off?: number };
type Fields = { name: string; pitch: string; repo: string; demo: string; video: string; rules: boolean };
const NAMES: FieldName[] = ['name', 'pitch', 'repo', 'demo', 'video', 'rules'];
const isPast = (d: Date | string) => Date.now() > new Date(d).getTime();

export function SubmitSheet({ o, who, done, again, share }: { o: SubmitOpts; who: Who; done: (e: Entry | null) => void; again: () => void; share: (e: Entry) => void }) {
  const [mine] = useState(() => store.entryFor(who.handle));
  const edit = !!mine, saved = useRef<Entry | null>(null), nameRef = useRef<HTMLInputElement>(null);
  const cityName = edit ? (mine!.cityName || cityLabel(mine!.city)) : (o.cityName || cityLabel(o.city));
  const [doneEntry, setDoneEntry] = useState<Entry | null>(null);
  return (
    <Sheet wide label={doneEntry ? (edit ? 'Saved' : 'Submitted') : cityName ? 'Entry · ' + cityName : 'Entry'} focusRef={nameRef} onDone={() => done(saved.current)}>
      {doneEntry
        ? <DoneView edit={edit} entry={doneEntry} cityName={cityName} until={until(edit, mine, o)} again={again} share={share} />
        : <SubmitForm o={o} who={who} mine={mine} cityName={cityName} nameRef={nameRef} onSaved={(e) => { saved.current = e; setDoneEntry(e); }} />}
    </Sheet>
  );
}
function deadlineOf(edit: boolean, mine: Entry | null, o: SubmitOpts) { return edit ? (mine!.deadline || o.deadline) : o.deadline; }
function until(edit: boolean, mine: Entry | null, o: SubmitOpts) { const d = deadlineOf(edit, mine, o); return d ? atCity(d, o.off) : ''; }

function SubmitForm({ o, who, mine, cityName, nameRef, onSaved }: { o: SubmitOpts; who: Who; mine: Entry | null; cityName: string; nameRef: React.RefObject<HTMLInputElement | null>; onSaved: (e: Entry) => void }) {
  const { id, busy: busyRef, open: openRef } = useSheet(), edit = !!mine;
  const city = edit ? mine!.city : o.city, deadline = deadlineOf(edit, mine, o), untilT = until(edit, mine, o);
  const otherCity = edit && o.city && mine!.city !== o.city;
  const [f, setF] = useState<Fields>(() => edit ? { name: mine!.name || '', pitch: mine!.pitch || '', repo: mine!.repo || '', demo: mine!.demo || '', video: mine!.video || '', rules: true } : { name: '', pitch: '', repo: '', demo: '', video: '', rules: false });
  const [err, setErr] = useState<Partial<Record<FieldName | 'picture', string>>>({});
  const [busy, setBusy] = useState(false), [closed, setClosed] = useState(false);
  /* the picture: a new file, the one already saved (kept), or none */
  const [pic, setPic] = useState<{ file: File | null; keep: boolean; url: string; preview: string }>(() => ({ file: null, keep: !!(mine && mine.picture), url: '', preview: mine && mine.picture ? mine.picture : '' }));
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null), formRef = useRef<HTMLFormElement>(null), headRef = useRef<HTMLHeadingElement>(null);
  const urlRef = useRef('');
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const check = (n: FieldName, v: string | boolean) => { const m = CHECKS[n](v); setErr((e) => ({ ...e, [n]: m })); return !m; };
  const set = (n: FieldName, v: string | boolean) => { setF((x) => ({ ...x, [n]: v })); if (err[n]) check(n, v); };
  const takeFile = (file: File | null | undefined) => {
    if (!file) return;
    const m = pictureError(file); setErr((e) => ({ ...e, picture: m }));
    if (m) { if (fileRef.current) fileRef.current.value = ''; return; }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const u = URL.createObjectURL(file); urlRef.current = u; setPic({ file, keep: false, url: u, preview: u });
  };
  const removePic = () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = ''; if (fileRef.current) fileRef.current.value = ''; setErr((e) => ({ ...e, picture: '' })); setPic({ file: null, keep: false, url: '', preview: '' }); fileRef.current?.focus(); };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault(); if (busyRef.current) return;
    let first: HTMLElement | null = null;
    NAMES.forEach((n) => { if (!check(n, f[n]) && !first) first = (formRef.current?.elements.namedItem(n) as HTMLElement | null) || null; });
    if (err.picture && !first) first = fileRef.current;
    if (first) { (first as HTMLElement).focus(); return; }
    if (deadline && isPast(deadline)) { setClosed(true); headRef.current?.focus(); return; }
    busyRef.current = true; setBusy(true);
    const fields = { name: f.name.trim(), pitch: f.pitch.trim(), repo: withScheme(f.repo), demo: f.demo.trim() ? withScheme(f.demo) : '', video: f.video.trim() ? withScheme(f.video) : '', city: city || '', cityName: cityName || '', deadline: deadline ? new Date(deadline).toISOString() : '' };
    /* the same checks as the editor's way in (lib/submit.ts); the stand-in store saves */
    submit(fields, { now: new Date(), hasEntry: edit, off: o.off }, (d) => store.saveEntry(who.handle, d, pic.file, pic.keep)).then(({ verdict, entry }) => {
      busyRef.current = false;
      if (!entry) {
        setBusy(false);
        if (verdict.refused.some((r) => r.check === 'closed')) { setClosed(true); headRef.current?.focus(); return; }
        const r = verdict.refused.find((x) => x.check === 'repo') ?? verdict.refused[0];
        if (r) { setErr((e) => ({ ...e, repo: r.say })); (formRef.current?.elements.namedItem('repo') as HTMLElement | null)?.focus(); }
        return;
      }
      emit(); if (!openRef.current) return; onSaved(entry);
    });
  };

  const attrs = (n: FieldName) => ({ className: 'fm-i', id: id + '-' + n, name: n, 'aria-describedby': id + '-e-' + n, 'aria-invalid': err[n] ? true : undefined, ref: n === 'name' ? nameRef : undefined });
  const onBlurField = (n: FieldName) => { const v = f[n]; if (typeof v === 'string' && (v.trim() || err[n])) check(n, v); };
  const field = (n: FieldName, label: string, input: React.ReactNode, hint?: React.ReactNode) => (
    <div className={FM_F}><label className={FM_L} htmlFor={id + '-' + n}><span>{label}</span>{hint}</label>{input}<ErrBox id={id + '-e-' + n} msg={err[n] || ''} /></div>
  );
  const text = (n: 'name' | 'pitch' | 'repo' | 'demo' | 'video') => ({ value: f[n], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(n, e.target.value), onBlur: () => onBlurField(n) });

  return (
    <>
      <h2 ref={headRef} className={FM_H} id={id + '-h'} tabIndex={-1}>{edit ? 'Edit your project' : 'Submit your project'}</h2>
      <p className={FM_P}>{closed
        ? 'Submissions for ' + cityName + ' closed at ' + untilT + '. Your entry was not saved.'
        : <>{otherCity ? 'You already have an entry in ' + cityName + '. One entry per person, so this edits it. ' : ''}Entering as <b>@{who.handle}</b>. One entry per person.{untilT ? ' You can edit it until ' + untilT + '.' : ''}</>}</p>
      {/* the editor door shows once the server is open; until then one line says so, and the form is the way in */}
      {edit || closed ? null : SERVER.live ? <div className="gr-two mt-3">
        <p className={FM_NOTE}>The rules, for both ways in: {RULES.join(' ')}</p>
        <FromEditor city={cityName || undefined} rules={false} />
        <h3 className="gr-in">In the browser</h3>
      </div> : <p className={FM_NOTE + ' mt-3'}>{RULES.join(' ')} Submitting from your editor opens later; for now, submit here.</p>}
      <form ref={formRef} className={FM_FORM} noValidate onSubmit={onSubmit}>
        {field('name', 'Project name', <input {...attrs('name')} {...text('name')} type="text" maxLength={40} autoComplete="off" spellCheck={false} enterKeyHint="next" />)}
        {field('pitch', 'One-line pitch', <input {...attrs('pitch')} {...text('pitch')} type="text" maxLength={100} autoComplete="off" spellCheck enterKeyHint="next" />,
          <span className={clsx('tabular-nums', f.pitch.length >= 100 ? 'text-ink' : 'text-ink-3')} id={id + '-ct'} aria-hidden="true">{f.pitch.length}/100</span>)}
        {field('repo', 'GitHub repo', <input {...attrs('repo')} {...text('repo')} type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="https://github.com/you/project" enterKeyHint="next" />)}
        {field('demo', 'Demo link', <input {...attrs('demo')} {...text('demo')} type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="https://" enterKeyHint="next" />, <small>Optional</small>)}
        {field('video', 'Video link', <input {...attrs('video')} {...text('video')} type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="https://" enterKeyHint="next" />, <small>Optional</small>)}
        <div className={FM_F}>
          <span className={FM_L} id={id + '-pl'}><span>Picture</span><small>Optional</small></span>
          <div className="grid grid-cols-2 items-end gap-x-4 phone-window:grid-cols-[minmax(0,1fr)] phone-window:gap-y-2">
            <label className={'fm-pic' + (pic.preview ? ' has-img' : '') + (over ? ' is-over' : '')} data-pic
              onDragOver={(e: DragEvent) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); takeFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}>
              <input ref={fileRef} type="file" name="picture" accept="image/jpeg,image/png,image/webp" aria-labelledby={id + '-pl'} aria-describedby={id + '-ph ' + id + '-e-picture'} aria-invalid={err.picture ? true : undefined}
                onChange={(e) => takeFile(e.target.files && e.target.files[0])} />
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file */}
              {pic.preview ? <img src={pic.preview} alt="Picture preview" /> : null}
              <span className="grid justify-items-center gap-y-1 p-4 text-center text-sm text-ink-2 [&_b]:font-medium [&_b]:text-ink" data-pic-t hidden={!!pic.preview}><b>Add a picture</b><span>Drop it here or choose a file</span></span>
            </label>
            <div className="grid content-end gap-y-2">
              <p className={FM_NOTE} id={id + '-ph'}>Shown at 16:9 in the list and on your project page. JPEG, PNG or WebP, up to 5{' '}MB.</p>
              <div className="flex flex-wrap gap-x-4" data-pic-a hidden={!pic.preview}>
                <button className={FM_T} type="button" onClick={() => fileRef.current?.click()}>Change picture</button>
                <button className={FM_T} type="button" onClick={removePic}>Remove picture</button>
              </div>
            </div>
          </div>
          <ErrBox id={id + '-e-picture'} msg={err.picture || ''} />
        </div>
        <div className={FM_F}>
          <label className="fm-chk"><input type="checkbox" name="rules" aria-describedby={id + '-e-rules'} aria-invalid={err.rules ? true : undefined} checked={f.rules}
            onChange={(e) => { setF((x) => ({ ...x, rules: e.target.checked })); if (err.rules) check('rules', e.target.checked); }} />
          <span>I built this during the hackathon.</span></label>
          <ErrBox id={id + '-e-rules'} msg={err.rules || ''} />
        </div>
        <div className={FM_ACT}><button className="fm-b g" type="submit" disabled={busy || closed} aria-busy={busy || undefined}>{busy ? (edit ? 'Saving changes…' : 'Submitting project…') : (edit ? 'Save changes' : 'Submit project')}</button></div>
      </form>
    </>
  );
}

function DoneView({ edit, entry, cityName, until: untilT, again, share }: { edit: boolean; entry: Entry; cityName: string; until: string; again: () => void; share: (e: Entry) => void }) {
  const { id, close } = useSheet(), h = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h.current?.focus(); }, []);
  return (
    <>
      <h2 ref={h} className={FM_H} id={id + '-h'} tabIndex={-1}>{edit ? 'Changes saved.' : entry.name + ' is in.'}</h2>
      <p className={FM_P} role="status">{(edit ? 'Your entry is up to date' : 'Your entry is in the ' + (cityName || 'city') + ' list') + (untilT ? '. You can edit it until ' + untilT + '.' : '.')}</p>
      <div className={FM_DONE}><div className={FM_ACT}>
        <button className="fm-b g" type="button" data-share onClick={() => share(entry)}>Share entry</button>
        <button className="fm-b" type="button" data-again onClick={() => { close(); again(); }}>Edit entry</button>
        <button className="fm-b" type="button" data-close>Done</button>
      </div></div>
    </>
  );
}
