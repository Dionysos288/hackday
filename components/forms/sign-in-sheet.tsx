'use client';
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { RESEND_S, emailOK } from '@/lib/forms';
import { emit, store, type Session } from './store';
import { FM_ACT, FM_F, FM_FORM, FM_H, FM_L, FM_P, FM_T, ErrBox, Sheet, useSheet } from './sheet';

/* Sign-in: email, then six digits. Used on its own and as the email step before a first vote. */
export type SignInOpts = { label?: string; title?: string; reason?: string; verb?: string };
export type Who = { handle: string; email: string };

export function SignInSheet({ o, done }: { o: SignInOpts; done: (who: Who | null) => void }) {
  const result = useRef<Who | null>(null);
  /* a code sent in the last ten minutes picks up where the person left off */
  const [start] = useState(() => { const sent = store.codeSent(); return sent && Date.now() - sent.at < 600000 ? { step: 'code' as const, email: sent.email } : { step: 'email' as const, email: store.lastEmail() || '' }; });
  const emRef = useRef<HTMLInputElement>(null), firstDigit = useRef<HTMLInputElement>(null);
  return (
    <Sheet label={o.label || 'Sign in'} focusRef={start.step === 'code' ? firstDigit : emRef} onDone={() => done(result.current)}>
      <SignInBody o={o} start={start} emRef={emRef} firstDigit={firstDigit} onSignedIn={(s) => { result.current = { handle: s.handle, email: s.email }; }} />
    </Sheet>
  );
}

function SignInBody({ o, start, emRef, firstDigit, onSignedIn }: { o: SignInOpts; start: { step: 'email' | 'code'; email: string }; emRef: React.RefObject<HTMLInputElement | null>; firstDigit: React.RefObject<HTMLInputElement | null>; onSignedIn: (s: Session) => void }) {
  const { id, close, busy: busyRef, open: openRef } = useSheet();
  const [step, setStep] = useState(start.step), [email, setEmail] = useState(start.email), [value, setValue] = useState(start.email);
  const [emErr, setEmErr] = useState(''), [sending, setSending] = useState(false);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']), [bad, setBad] = useState<boolean[]>([false, false, false, false, false, false]);
  const [codeErr, setCodeErr] = useState(''), [checking, setChecking] = useState(false), [status, setStatus] = useState('');
  const [cool, setCool] = useState(0), [coolKey, setCoolKey] = useState(0);
  const ins = useRef<(HTMLInputElement | null)[]>([]);

  /* the resend countdown runs while the code step shows */
  useEffect(() => {
    if (step !== 'code') return;
    const sent = store.codeSent(), end = (sent ? sent.at : Date.now()) + RESEND_S * 1000;
    const tick = () => { const n = Math.ceil((end - Date.now()) / 1000); setCool(Math.max(0, n)); if (n <= 0) clearInterval(iv); };
    const iv = window.setInterval(tick, 1000); tick();
    return () => clearInterval(iv);
  }, [step, coolKey]);

  /* email: checked on submit and on blur; once wrong, it clears the moment it is right */
  const checkEmail = (v = value) => { const t = v.trim(), m = !t ? 'Enter your email so we can send the code.' : emailOK(t) ? '' : 'Check the email. It needs an @ and a domain.'; setEmErr(m); return !m; };
  const showCode = () => { setDigits(['', '', '', '', '', '']); setBad([false, false, false, false, false, false]); setCodeErr(''); setStep('code'); setCoolKey((k) => k + 1); };
  const onEmail = (e: FormEvent) => {
    e.preventDefault(); if (busyRef.current) return;
    if (!checkEmail()) { emRef.current?.focus(); return; }
    busyRef.current = true; setSending(true);
    const addr = value.trim(); setEmail(addr);
    store.sendCode(addr).then(() => {
      busyRef.current = false; setSending(false); if (!openRef.current) return;
      showCode(); requestFocus(0);
    });
  };
  /* focus after the step has rendered */
  const focusNext = useRef<number | null>(null);
  const requestFocus = (i: number) => { focusNext.current = i; };
  useEffect(() => { if (focusNext.current != null) { ins.current[focusNext.current]?.focus(); focusNext.current = null; } });

  const verify = (d: string[]) => {
    if (busyRef.current) return;
    const code = d.join('');
    if (code.length < 6) { setBad(d.map((x) => !x)); setCodeErr('Enter all six digits from the email.'); const k = d.findIndex((x) => !x); ins.current[k < 0 ? 0 : k]?.focus(); return; }
    busyRef.current = true; setChecking(true);
    store.verifyCode(email, code).then((r) => {
      busyRef.current = false; setChecking(false);
      if (!r.ok || !r.session) { setDigits(['', '', '', '', '', '']); setBad([true, true, true, true, true, true]); setCodeErr('That code does not match. Check the email and try again, or send a new code.'); ins.current[0]?.focus(); return; }
      onSignedIn(r.session); emit(); close();
    });
  };
  /* code: one digit per box, auto-advance; a paste or the keyboard's suggested code fills all six */
  const fill = (from: number, ds: string, base: string[]) => { const d = base.slice(); ds.slice(0, 6 - from).split('').forEach((ch, k) => { d[from + k] = ch; }); ins.current[Math.min(5, from + ds.length)]?.focus(); return d; };
  const clearErr = () => { setBad([false, false, false, false, false, false]); setCodeErr(''); };
  const onDigit = (i: number, raw: string) => {
    if (busyRef.current) return;
    const ds = raw.replace(/\D/g, ''); clearErr();
    let d = digits.slice();
    if (ds.length > 1) d = fill(i, ds, d); else { d[i] = ds; if (ds && i < 5) ins.current[i + 1]?.focus(); }
    setDigits(d);
    if (d.join('').length === 6) verify(d);
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) { e.preventDefault(); const d = digits.slice(); d[i - 1] = ''; setDigits(d); ins.current[i - 1]?.focus(); }
    else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); ins.current[i - 1]?.focus(); }
    else if (e.key === 'ArrowRight' && i < 5) { e.preventDefault(); ins.current[i + 1]?.focus(); }
  };
  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    const ds = ((e.clipboardData && e.clipboardData.getData('text')) || '').replace(/\D/g, ''); if (!ds) return;
    e.preventDefault(); if (busyRef.current) return; clearErr();
    const d = fill(ds.length >= 6 ? 0 : i, ds, digits); setDigits(d); if (d.join('').length === 6) verify(d);
  };
  const resend = () => {
    if (busyRef.current || cool > 0) return; setCool(1);
    store.sendCode(email).then(() => { if (!openRef.current) return; setDigits(['', '', '', '', '', '']); clearErr(); setStatus('We sent a new code to ' + email + '.'); setCoolKey((k) => k + 1); ins.current[0]?.focus(); });
  };
  const back = () => { if (busyRef.current) return; store.forgetCode(); setStep('email'); window.setTimeout(() => { emRef.current?.focus(); emRef.current?.select(); }, 0); };

  return (
    <>
      <h2 className={FM_H} id={id + '-h'} tabIndex={-1}>{step === 'email' ? (o.title || 'Sign in with your email') : 'Enter the code'}</h2>
      <p className={FM_P} id={id + '-p'}>{step === 'email' ? (o.reason ? o.reason + ' ' : '') + 'We email you a six-digit code. No password.' : <>We sent a six-digit code to <b>{email}</b>.</>}</p>
      <form className={FM_FORM} data-step="email" hidden={step !== 'email'} noValidate onSubmit={onEmail}>
        <div className={FM_F}>
          <label className={FM_L} htmlFor={id + '-em'}>Email</label>
          <input ref={emRef} className="fm-i" id={id + '-em'} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="send" placeholder="you@example.com" aria-describedby={id + '-ee'}
            value={value} readOnly={sending} aria-invalid={emErr ? true : undefined}
            onChange={(e) => { setValue(e.target.value); if (emErr) checkEmail(e.target.value); }} onBlur={() => { if (value.trim()) checkEmail(); }} />
          <ErrBox id={id + '-ee'} msg={emErr} />
        </div>
        <button className="fm-b g w-full" type="submit" disabled={sending} aria-busy={sending || undefined}>{sending ? 'Sending code…' : 'Send code'}</button>
      </form>
      <form className={FM_FORM} data-step="code" hidden={step !== 'code'} noValidate onSubmit={(e) => { e.preventDefault(); verify(digits); }}>
        <fieldset className="fm-code" id={id + '-cd'} aria-describedby={id + '-ce'} aria-busy={checking || undefined}>
          <legend className="sr-only">Six-digit code</legend>
          {digits.map((d, i) => (
            <input key={i} ref={(el) => { ins.current[i] = el; if (i === 0) firstDigit.current = el; }} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={i ? 'off' : 'one-time-code'} autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done"
              aria-label={'Digit ' + (i + 1) + ' of 6'} aria-describedby={id + '-ce'} data-1p-ignore data-lpignore="true" value={d} readOnly={checking} aria-invalid={bad[i] ? true : undefined}
              onChange={(e) => onDigit(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} onPaste={(e) => onPaste(i, e)} onFocus={(e) => e.target.select()} />
          ))}
        </fieldset>
        <ErrBox id={id + '-ce'} msg={codeErr} />
        <p className="sr-only" role="status" id={id + '-st'}>{status}</p>
        <button className="fm-b g w-full" type="submit" disabled={checking} aria-busy={checking || undefined}>{checking ? 'Checking code…' : (o.verb || 'Sign in')}</button>
        <div className={FM_ACT}>
          <button className={FM_T + ' tabular-nums'} type="button" data-resend disabled={cool > 0} onClick={resend}>{cool > 0 ? 'Send a new code in ' + cool + ' s' : 'Send a new code'}</button>
          <button className={FM_T} type="button" data-back onClick={back}>Use a different email</button>
        </div>
      </form>
    </>
  );
}
