/* store.ts: the stand-in server. There is no backend yet: this is the only code that reads or writes localStorage for
   the forms, and the only code that waits on the "network". Swap its methods for real calls and nothing else changes.

   Keys are versioned (hackday:v1:…), so a later shape can move to v2 without reading stale data. Each key holds the
   smallest thing that works: the session, the last email, a pending code, the entries by handle, the reminders. */
import { useSyncExternalStore } from 'react';
import { slugOf } from '@/lib/forms';

export type Session = { email: string; handle: string; voter: boolean };
export type Entry = {
  id: string; handle: string; slug: string; name: string; pitch: string; repo: string; demo: string; video: string;
  city: string; cityName: string; deadline: string; picture: string | null; createdAt: string; updatedAt: string;
};
export type EntryFields = Pick<Entry, 'name' | 'pitch' | 'repo' | 'demo' | 'video' | 'city' | 'cityName' | 'deadline'>;
export type FormsState = Readonly<{ signedIn: boolean; handle: string | null; email: string | null; voter: boolean; entry: Entry | null }>;

const PREFIX = 'hackday:v1:';
const LATENCY = 600;   /* a round trip, so busy states show */

export function handleOf(email: string): string { return String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15) || 'builder'; }

function read<T>(k: string, d: T): T { try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v) as T; } catch { return d; } }
function write(k: string, v: unknown): boolean { try { if (v == null) localStorage.removeItem(PREFIX + k); else localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch { return false; } }
function wait<T>(v?: T): Promise<T> { return new Promise((r) => { setTimeout(() => r(v as T), LATENCY); }); }

/* the stand-in keeps a 1280-wide JPEG so it fits in localStorage; a real API uploads the file itself */
function shrinkPicture(file: File): Promise<string | null> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const w = Math.min(1280, img.naturalWidth), h = Math.round(w * 9 / 16), c = document.createElement('canvas'), x = c.getContext('2d');
      c.width = w; c.height = h; const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      x?.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}

export const store = {
  /* who is here, or null */
  session(): Session | null { return read<Session | null>('session', null); },
  lastEmail(): string { return read('last-email', ''); },
  sendCode(email: string) { write('last-email', email); write('code', { email, at: Date.now() }); return wait({ ok: true }); },
  codeSent(): { email: string; at: number } | null { return read('code', null); },
  forgetCode() { write('code', null); },
  /* the stand-in accepts any six digits */
  verifyCode(email: string, code: string): Promise<{ ok: boolean; session?: Session }> {
    return wait().then(() => {
      if (!/^\d{6}$/.test(code)) return { ok: false };
      const s = { email, handle: handleOf(email), voter: true };
      write('session', s); write('code', null); return { ok: true, session: s };
    });
  },
  signOut() { write('session', null); write('code', null); return Promise.resolve(); },

  /* one entry per person, keyed by handle */
  entryFor(handle: string | null): Entry | null { if (!handle) return null; return read<Record<string, Entry>>('entries', {})[handle] || null; },
  saveEntry(handle: string, fields: EntryFields, file: File | null, keepPicture: boolean): Promise<Entry> {
    return Promise.all([file ? shrinkPicture(file) : Promise.resolve(null), wait()]).then((r) => {
      const all = read<Record<string, Entry>>('entries', {}), old = all[handle], now = new Date().toISOString();
      const e: Entry = {
        ...fields,
        id: old ? old.id : 'e' + Date.now().toString(36), handle,
        slug: old ? old.slug : slugOf(fields.name) + '-' + handle,
        picture: r[0] || (keepPicture && old ? old.picture : null),
        createdAt: old ? old.createdAt : now, updatedAt: now,
      };
      all[handle] = e;
      if (!write('entries', all)) { e.picture = null; all[handle] = e; write('entries', all); }   /* storage full: keep the entry, drop the picture */
      return e;
    });
  },

  reminders(): Record<string, string> { return read('reminders', {}); },
  remind(email: string, city: string) { const r = store.reminders(); r[city] = email; write('reminders', r); write('last-email', email); return wait(true); },

  /* this visitor's own votes, per city and seed */
  votes(key: string): Record<string, 1> { return read<Record<string, Record<string, 1>>>('votes', {})[key] || {}; },
  setVotes(key: string, v: Record<string, 1>) { const all = read<Record<string, Record<string, 1>>>('votes', {}); all[key] = v; write('votes', all); emit(); },

  reset() { const drop: string[] = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(PREFIX) === 0) drop.push(k); } drop.forEach((k) => localStorage.removeItem(k)); } catch { /* storage blocked */ } },
};

/* ---------------- the state the pages read, as an external store ---------------- */
let cached: FormsState | null = null;
const subs = new Set<() => void>();
function snapshot(): FormsState {
  if (cached) return cached;
  const s = store.session();
  cached = Object.freeze({ signedIn: !!s, handle: s ? s.handle : null, email: s ? s.email : null, voter: !!(s && s.voter), entry: s ? store.entryFor(s.handle) : null });
  return cached;
}
/* after any write the sheets make: everyone reading the state renders again */
export function emit() { cached = null; voteCache.clear(); subs.forEach((fn) => fn()); }
let listening = false;
function onStorage(e: StorageEvent) { if (e.key && e.key.indexOf(PREFIX) === 0) emit(); }
function subscribe(fn: () => void) {
  subs.add(fn);
  /* one storage listener for the whole page, however many readers */
  if (!listening) { listening = true; window.addEventListener('storage', onStorage); }
  return () => { subs.delete(fn); if (!subs.size && listening) { listening = false; window.removeEventListener('storage', onStorage); } };
}
const SERVER: FormsState = Object.freeze({ signedIn: false, handle: null, email: null, voter: false, entry: null });
/* the person's sign-in and entry; nothing on the server and in the first render, so hydration matches */
export function useFormsState(): FormsState { return useSyncExternalStore(subscribe, snapshot, () => SERVER); }
export function formsState(): FormsState { return snapshot(); }

/* this visitor's votes for one city and seed ('berlin:17'); none on the server and in the first render */
const voteCache = new Map<string, Readonly<Record<string, 1>>>();
const NO_VOTES: Readonly<Record<string, 1>> = Object.freeze({});
function votesSnapshot(key: string) { let v = voteCache.get(key); if (!v) { v = Object.freeze(store.votes(key)); voteCache.set(key, v); } return v; }
export function useVotes(key: string): Readonly<Record<string, 1>> { return useSyncExternalStore(subscribe, () => votesSnapshot(key), () => NO_VOTES); }
