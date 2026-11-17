'use client';
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';

/* The sheet: one <dialog>, opened with showModal(). Every form (sign-in, submit, remind, share) is one of these.
   It animates in and out through data-state (closed, open, closing; forms.css has the motion), keeps Tab inside,
   closes on Escape and on a press on the backdrop (not while busy), sits above the phone's keyboard, locks the page
   behind it and gives focus back to whatever opened it. */

/* timers cannot read CSS variables: a duration is read from its token when it is needed */
export function token(name: string): number { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); const n = parseFloat(v) || 0; return /ms$/.test(v) ? n : n * 1000; }
export function isTouch(): boolean { return window.matchMedia('(pointer: coarse)').matches; }

let openCount = 0;
function lockPage(on: boolean) { openCount += on ? 1 : -1; document.documentElement.classList.toggle('fm-lock', openCount > 0); }
/* on a phone the sheet sits on the bottom edge of the visual viewport, so the keyboard never covers it */
function fitKeyboard(dlg: HTMLDialogElement): () => void {
  const vv = window.visualViewport; if (!vv) return () => {};
  const fit = () => { const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); dlg.style.setProperty('--fm-kb', kb + 'px'); dlg.style.setProperty('--fm-vh', vv.height + 'px'); };
  fit(); vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
  return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); };
}

type SheetValue = { id: string; close: () => void; busy: RefObject<boolean>; focus: (el?: HTMLElement | null) => void; open: RefObject<boolean> };
const SheetContext = createContext<SheetValue | null>(null);
export function useSheet(): SheetValue { const v = useContext(SheetContext); if (!v) throw new Error('useSheet outside a Sheet'); return v; }

export const IconX = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>;
export const IconErr = () => <svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="6" /><path d="M7 3.8v3.8M7 9.9v.2" /></svg>;
export const IconOut = () => <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M5 3h6v6M11 3 3 11" /></svg>;
/* a field's error line: hidden while there is nothing to say */
export function ErrBox({ id, msg }: { id: string; msg: string }) { return <p className="fm-err" id={id} hidden={!msg}><IconErr /><span>{msg}</span></p>; }

/* focusRef: what takes focus when the sheet opens; onDone runs once, after the sheet has closed */
export function Sheet({ label, wide, focusRef, onDone, children }: { label: string; wide?: boolean; focusRef?: RefObject<HTMLElement | null>; onDone: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), id = 'fm-' + useId().replace(/[^a-z0-9]/gi, '');
  const busy = useRef(false), isOpen = useRef(false), st = useRef({ closing: false, done: false, tm: 0, unfit: null as null | (() => void), opener: null as Element | null });
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  /* one clean-up, whichever way the sheet ends: the exit timer, the 'close' event, or an uncancelable Escape */
  const finish = useCallback(() => {
    const s = st.current, dlg = ref.current; if (s.done) return; s.done = true; isOpen.current = false;
    clearTimeout(s.tm); if (s.unfit) s.unfit(); lockPage(false);
    if (dlg && dlg.open) dlg.close();
    const o = s.opener as HTMLElement | null;
    if (o && o.isConnected && typeof o.focus === 'function') o.focus({ preventScroll: true });
    doneRef.current();
  }, []);
  /* close(): animate out, then dialog.close() */
  const close = useCallback(() => {
    const s = st.current, dlg = ref.current; if (!dlg || s.closing || !dlg.open) return;
    s.closing = true; dlg.dataset.state = 'closing';
    s.tm = window.setTimeout(finish, token('--dur-panel-exit'));
  }, [finish]);
  /* modals take focus: the given field on a pointer device; the heading on touch, so the keyboard does not jump up */
  const focus = useCallback((el?: HTMLElement | null) => {
    const dlg = ref.current; if (!dlg) return;
    const h = dlg.querySelector<HTMLElement>('.fm-h');
    if (el && !isTouch()) el.focus({ preventScroll: true }); else if (h) h.focus({ preventScroll: true }); else dlg.focus();
  }, []);

  useLayoutEffect(() => {
    const dlg = ref.current, s = st.current; if (!dlg) return;
    s.opener = document.activeElement; s.done = false; s.closing = false;
    dlg.dataset.state = 'closed'; dlg.showModal(); isOpen.current = true; lockPage(true); s.unfit = fitKeyboard(dlg);
    /* commit the closed pose (a style read forces it), then transition to open. No rAF: it stalls in a background tab. */
    void getComputedStyle(dlg).transform; void getComputedStyle(dlg, '::backdrop').opacity; dlg.dataset.state = 'open';
    focus(focusRef?.current);
    /* unmounted while open (a page change, or the development double mount): close without the clean-up callback */
    return () => { if (!s.done) { s.done = true; clearTimeout(s.tm); if (s.unfit) s.unfit(); lockPage(false); isOpen.current = false; if (dlg.open) dlg.close(); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- opens once, when the sheet mounts
  }, []);

  /* Escape. Chrome makes a second Escape (or one with no user activation) uncancelable and closes at once: then only clean up. */
  const onCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => { if (!e.cancelable) { setTimeout(finish, 0); return; } e.preventDefault(); if (!busy.current) close(); };
  /* a close event queued before a remount arrives while the dialog is open again: only a real close counts */
  const onClose = () => { if (!ref.current || !ref.current.open) finish(); };
  const onClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const t = e.target as Element, dlg = ref.current!;
    if (t.closest('[data-close]')) { close(); return; }
    /* a press on the backdrop (the dialog box itself, outside its content) dismisses */
    if (t === dlg && !busy.current) { const r = dlg.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(); }
  };
  /* Tab stays inside the sheet: from the last control it wraps to the first, and back */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab') return;
    const dlg = ref.current!;
    const f = Array.prototype.filter.call(dlg.querySelectorAll('a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'), (n: HTMLButtonElement) => !n.disabled && !n.closest('[hidden]') && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden') as HTMLElement[];
    if (!f.length) return; const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || a === dlg || !dlg.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !dlg.contains(a))) { e.preventDefault(); first.focus(); }
  };

  const value = useMemo(() => ({ id, close, busy, focus, open: isOpen }), [id, close, focus]);
  return (
    <dialog ref={ref} className={'fm' + (wide ? ' is-wide' : '')} aria-labelledby={id + '-h'} onCancel={onCancel} onClose={onClose} onClick={onClick} onKeyDown={onKeyDown}>
      <div className="fm-in">
        <div className="fm-top"><p className="fm-k">{label}</p><button className="fm-x" type="button" data-close aria-label="Close"><IconX /></button></div>
        <div data-body><SheetContext.Provider value={value}>{children}</SheetContext.Provider></div>
      </div>
    </dialog>
  );
}
