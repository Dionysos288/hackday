/* entries.ts: the one submit, for both doors (the form on a city's page and the editor's MCP tool), with the checks of
   lib/hackday-server.ts really run:
   - the clock: only while building runs in the entry's city, and not while a super admin has paused submissions;
   - one entry per person: a second submit edits the first;
   - the repository (required): GitHub must be able to read it, and it must be made on the day (a block); a fork is a
     flag for the hosts;
   - the demo link: fetched once, guarded; no answer is a flag, never a block.
   The refusal words come from lib/submit.ts, so the form and the tool say the same thing.
   The picture: the person's upload first; with no upload, the demo page's own share image, copied into our bucket.
   The screenshot step is not built (it needs a browser on the host); until a picture is in, the pages show the seal. */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { verify, type Draft, type RepoFacts, type Verdict } from '@/lib/submit';
import { githubOK, slugOf, urlOK, withScheme, PIC_TYPES, MAX_PIC } from '@/lib/forms';
import { CHECKS } from '@/lib/hackday-server';
import { atCity } from '@/lib/forms';
import { admin } from './supabase';
import { type Person } from './people';
import { mayBuild } from './room';
import { entryOf, type MyEntry } from './me';
import { forget } from './snapshot';
import { guardKey } from './repo-key';
import { whenLocal } from './time';

export type SubmitInput = { name: string; pitch: string; repo: string; demo?: string; video?: string; by?: string };
export type Upload = { bytes: Uint8Array; type: string };
export type SubmitResult = { ok: true; entry: MyEntry; verdict: Verdict; keyFound?: string } | { ok: false; error: string; field?: string; verdict?: Verdict; status?: number };
type Row = Record<string, unknown>;

const T = 5000;
/* a fetch that only goes to public addresses, with a time limit and a size cap */
async function guarded(url: string, accept: string, cap: number): Promise<{ type: string; body: Uint8Array; final: string } | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.replace(/^\[|\]$/g, '');
    const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
    if (!ips.length || ips.some(privateIp)) return null;
    const r = await fetch(u, { headers: { accept, 'user-agent': 'SupabaseBuilderDay/1 (entry check)' }, redirect: 'follow', signal: AbortSignal.timeout(T) });
    if (!r.ok || !r.body) return null;
    const reader = r.body.getReader(), parts: Uint8Array[] = []; let n = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > cap) { await reader.cancel(); break; } parts.push(value); }
    const body = new Uint8Array(Math.min(n, cap)); let o = 0; for (const p of parts) { body.set(p.subarray(0, Math.max(0, body.length - o)), o); o += p.length; }
    return { type: (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(), body, final: r.url };
  } catch { return null; }
}
function privateIp(ip: string): boolean {
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const m = ip.replace(/^::ffff:/, '').split('.').map(Number);
  if (m.length !== 4) return false;
  return m[0] === 10 || m[0] === 127 || m[0] === 0 || (m[0] === 169 && m[1] === 254) || (m[0] === 172 && m[1] >= 16 && m[1] <= 31) || (m[0] === 192 && m[1] === 168) || (m[0] === 100 && m[1] >= 64 && m[1] <= 127);
}

/* what GitHub says about a repository; null when GitHub could not be asked (then the age check waits, never passes) */
export async function repoFacts(repo: string, dayStart: string | null): Promise<RepoFacts | null> {
  const m = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/i.exec(repo);
  if (!m) return { readable: false };
  /* the local stack only: a stand-in GitHub that reads every repository as made now, for local tests and the load run.
     Never on a real project: it needs the database to be on this machine. */
  if (process.env.HACKDAY_FAKE_GITHUB === '1' && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(process.env['NEXT_PUBLIC_SUPABASE_URL'] || '')) return { readable: !/not-found/.test(repo), createdAt: new Date().toISOString(), fork: /fork/.test(repo), dayStart: dayStart || undefined };
  try {
    const h: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'SupabaseBuilderDay/1' };
    if (process.env.GITHUB_TOKEN) h.authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
    const at = 'https://api.github.com/repos/' + m[1] + '/' + m[2];
    let r = await fetch(at, { headers: h, signal: AbortSignal.timeout(T) });
    /* an organisation can refuse a token by its own rules (an enterprise that caps a token's lifetime, say); a public
       repository can still be read without one */
    if ((r.status === 401 || r.status === 403) && h.authorization) {
      delete h.authorization;
      r = await fetch(at, { headers: h, signal: AbortSignal.timeout(T) });
    }
    if (r.status === 404) return { readable: false };
    if (!r.ok) return null;   /* rate limit or GitHub down: not checked, never refused for it */
    const j = await r.json() as { created_at?: string; fork?: boolean; private?: boolean };
    if (j.private) return { readable: false };
    return { readable: true, createdAt: j.created_at, fork: !!j.fork, dayStart: dayStart || undefined };
  } catch { return null; }
}

/* the demo page's own share image (og:image, then twitter:image), copied into our bucket */
async function shareImage(demo: string): Promise<Upload | null> {
  const page = await guarded(demo, 'text/html', 1_000_000);
  if (!page || page.type.indexOf('html') < 0) return null;
  const html = new TextDecoder().decode(page.body);
  const pick = (k: string) => new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*>', 'i').exec(html)?.[0].match(/content=["']([^"']+)["']/i)?.[1];
  const src = pick('og:image') || pick('og:image:url') || pick('twitter:image');
  if (!src) return null;
  let abs: string; try { abs = new URL(src.replace(/&amp;/g, '&'), page.final).toString(); } catch { return null; }
  const img = await guarded(abs, 'image/*', MAX_PIC);
  if (!img || PIC_TYPES.indexOf(img.type) < 0 || img.body.length >= MAX_PIC) return null;
  return { bytes: img.body, type: img.type };
}
async function demoAnswers(demo: string): Promise<boolean> { return !!(await guarded(demo, 'text/html,*/*', 64_000)); }

async function store(city: string, entry: string, up: Upload): Promise<string | null> {
  const ext = up.type === 'image/png' ? 'png' : up.type === 'image/webp' ? 'webp' : 'jpg', path = city + '/' + entry + '-' + Date.now().toString(36) + '.' + ext;
  const db = admin(), { error } = await db.storage.from('pictures').upload(path, up.bytes, { contentType: up.type, upsert: false, cacheControl: '31536000' });
  if (error) return null;
  return db.storage.from('pictures').getPublicUrl(path).data.publicUrl;
}

const closedSay = (city: string, end: string, off: number) => CHECKS.find((c) => c.id === 'closed')!.say!({ city, time: atCity(end, off) });

/* where the clock stands for submitting in a city, or why not */
function clockSays(c: Row, now: number): string | null {
  if (c.submissions_paused) return 'Submissions are paused in ' + c.name + ' for a moment. Try again shortly; your work is safe in your repository.';
  if (!c.build_start || now < new Date(c.build_start as string).getTime()) return 'Submissions open in ' + c.name + ' when building starts' + (c.build_start ? '.' : ', planned for ' + whenLocal(c.planned_start as string, c.offset_min as number) + ' local time.');
  if (now >= new Date(c.build_end as string).getTime()) return closedSay(c.name as string, c.build_end as string, c.offset_min as number);
  return null;
}

export async function submitEntry(p: Person, input: SubmitInput, o: { via: 'web' | 'editor'; upload?: Upload | null; keepPicture?: boolean }): Promise<SubmitResult> {
  const db = admin(), now = Date.now();
  const { data: old } = await db.from('entries').select('id, city, slug, picture, picture_from').eq('owner', p.id).maybeSingle();
  /* rule 7c: on the city's list, then the clock, then checked in with the room code (so a late press reads "closed",
     not "type the code") */
  const gate = await mayBuild(p, (old?.city as string) || null);
  if (!gate.ok && gate.field === 'list') return { ok: false, status: gate.status, error: gate.error, field: 'list' };
  const cityId = (old?.city as string) || (gate.ok ? gate.pass.city : gate.city!);
  const { data: c } = await db.from('cities').select('*').eq('id', cityId).single();
  if (!c) return { ok: false, error: 'That city is not on the list.' };
  const clock = clockSays(c, now);
  if (clock) return { ok: false, status: 409, error: clock, field: 'closed' };
  if (!gate.ok) return { ok: false, status: gate.status, error: gate.error, field: 'room' };

  /* the public name: Luma's, or what the person types the first time; never from the email */
  let name = p.name;
  const by = String(input.by || '').trim().slice(0, 60);
  if (!name && by) { await db.from('people').update({ name: by }).eq('id', p.id); name = by; }
  if (!name) return { ok: false, error: 'Say your name as it should show beside your project.', field: 'by' };

  const d: Draft = { name: String(input.name || '').trim().slice(0, 40), pitch: String(input.pitch || '').trim().slice(0, 140), repo: withScheme(String(input.repo || '').trim()), demo: input.demo ? withScheme(String(input.demo).trim()) : '', video: input.video ? withScheme(String(input.video).trim()) : '', city: cityId, cityName: c.name, deadline: c.build_end };
  if (!d.name) return { ok: false, error: 'Give your project a name.', field: 'name' };
  if (!githubOK(d.repo)) return { ok: false, error: CHECKS.find((x) => x.id === 'repo')!.say!({ repo: d.repo || 'the repository' }), field: 'repo' };
  if (d.demo && !urlOK(d.demo)) return { ok: false, error: 'Check the demo link. It needs to be a full web address.', field: 'demo' };
  if (d.video && !urlOK(d.video)) return { ok: false, error: 'Check the video link. It needs to be a full web address.', field: 'video' };

  const [facts, answers] = await Promise.all([repoFacts(d.repo, c.build_start as string), d.demo ? demoAnswers(d.demo) : Promise.resolve(true)]);
  const verdict = verify(d, { now: new Date(now), hasEntry: !!old, off: c.offset_min as number, repo: facts || undefined });
  if (!facts) verdict.later = ['age', 'fork', 'push', 'dates', 'supabase'];
  if (!answers) verdict.flags.push('demo');
  if (!verdict.ok) { const r = verdict.refused[0]; return { ok: false, error: r.say, field: r.check === 'closed' ? 'closed' : 'repo', verdict }; }
  /* the editor key in the repository: replaced, the entry still taken, the hosts told by a flag */
  const leak = await guardKey(gate.pass, d.repo);
  if (leak) verdict.flags.push('key');

  /* the slug: from the name, unique in the city; kept when the name has not changed */
  let slug = old?.slug as string | undefined;
  if (!slug || slugOf(d.name) !== String(slug).replace(/-\d+$/, '')) {
    const base = slugOf(d.name); slug = base;
    const { data: taken } = await db.from('entries').select('slug').eq('city', cityId).like('slug', base + '%').neq('owner', p.id);
    const set = new Set((taken || []).map((t) => t.slug)); for (let k = 2; set.has(slug); k++) slug = base + '-' + k;
  }
  const row = { city: cityId, owner: p.id, slug, name: d.name, pitch: d.pitch, url: d.demo || d.repo, repo: d.repo, video: d.video || null, via: o.via, flags: verdict.flags, updated_at: new Date().toISOString() };
  const w = old ? await db.from('entries').update(row).eq('id', old.id).select('id').single() : await db.from('entries').insert(row).select('id').single();
  if (w.error || !w.data) return { ok: false, error: w.error?.code === '23505' ? 'You already have an entry. Reload the page to edit it.' : 'Your entry was not saved. Try again.' };
  const id = w.data.id as string;

  /* the picture: an upload replaces; no upload keeps the old one when asked; otherwise the demo's share image */
  let pic: { url: string; from: string } | null = null;
  if (o.upload) { const u = await store(cityId, id, o.upload); if (u) pic = { url: u, from: 'upload' }; }
  else if (!(o.keepPicture && old?.picture) && d.demo) { const s = await shareImage(d.demo); if (s) { const u = await store(cityId, id, s); if (u) pic = { url: u, from: 'share' }; } }
  if (pic) await db.from('entries').update({ picture: pic.url, picture_from: pic.from }).eq('id', id);
  else if (!o.keepPicture && old?.picture && !o.upload) await db.from('entries').update({ picture: null, picture_from: null }).eq('id', id);

  forget(cityId);
  return { ok: true, entry: (await entryOf(p.id))!, verdict, ...(leak ? { keyFound: leak.say } : {}) };
}

/* Delete: the person's own entry, until building closes in its city */
export async function deleteEntry(p: Person): Promise<{ ok: true } | { ok: false; error: string; status?: number; field?: string }> {
  const db = admin();
  const { data: e } = await db.from('entries').select('id, city, cities(*)').eq('owner', p.id).maybeSingle();
  if (!e) return { ok: false, status: 404, error: 'You have no entry to delete.' };
  const c = e.cities as unknown as Row;
  const gate = await mayBuild(p, e.city as string);
  if (!gate.ok && gate.field === 'list') return { ok: false, status: gate.status, error: gate.error, field: 'list' };
  if (c.build_end && Date.now() >= new Date(c.build_end as string).getTime()) return { ok: false, status: 409, error: closedSay(c.name as string, c.build_end as string, c.offset_min as number) };
  if (!gate.ok) return { ok: false, status: gate.status, error: gate.error, field: 'room' };
  await db.from('entries').delete().eq('id', e.id);
  forget(e.city as string);
  return { ok: true };
}

/* Refresh picture: the demo's share image again (the person's own upload is replaced only when they ask) */
export async function refreshPicture(entryId: string): Promise<{ ok: true; picture: string | null } | { ok: false; error: string }> {
  const db = admin();
  const { data: e } = await db.from('entries').select('id, city, url, repo').eq('id', entryId).maybeSingle();
  if (!e) return { ok: false, error: 'That entry is gone.' };
  if (e.url === e.repo) return { ok: false, error: 'This entry has no demo link to take a picture from.' };
  const s = await shareImage(e.url as string);
  if (!s) return { ok: false, error: 'The demo page has no share image we could read. Upload a picture instead.' };
  const u = await store(e.city as string, e.id as string, s);
  if (!u) return { ok: false, error: 'The picture could not be saved. Try again.' };
  await db.from('entries').update({ picture: u, picture_from: 'share' }).eq('id', e.id);
  forget(e.city as string);
  return { ok: true, picture: u };
}
