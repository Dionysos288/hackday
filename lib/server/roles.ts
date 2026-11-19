/* roles.ts: who may do what on the desk, in one place. Every desk action asks here first.
   - super: everything, in every city;
   - host: their city's guest list, entries, deck, door, and adding minutes (a host of every city is possible);
   - judge: their votes (the database checks those) and seeing flags in their city.
   Signing in to the desk is the six-digit code or the room is not enough: a session made by a personal link or the
   room code does not open the desk (the signed hd_desk cookie, set only by a code; see keys.ts). */
import { cookies } from 'next/headers';
import { asUser } from './supabase';
import { DESK_COOKIE, deskMarkOk } from './keys';
import { bootstrapSuper, ensurePerson, personByAuth, rolesOf, type Person, type Role } from './people';

export type Desk = { person: Person; roles: Role[]; super: boolean; hosts: (city: string) => boolean; judges: (city: string) => boolean; cities: string[] | 'all' };

/* the desk's person, or why not */
export async function deskUser(): Promise<Desk | { error: string; status: number }> {
  const sb = await asUser();
  const { data } = await sb.auth.getUser();
  const u = data.user;
  if (!u || !u.email) return { error: 'Sign in to the desk with your email.', status: 401 };
  if (!deskMarkOk(u.id, (await cookies()).get(DESK_COOKIE)?.value)) return { error: 'The desk needs a code from your email, even if you are signed in on this device.', status: 401 };
  const p = (await personByAuth(u.id)) || (await ensurePerson(u.email));
  await bootstrapSuper(p);
  const roles = await rolesOf(p.id);
  if (!roles.length) return { error: 'This email has no role on the desk. Ask a super admin to add you.', status: 403 };
  const sup = roles.some((r) => r.role === 'super');
  const hostAll = roles.some((r) => r.role === 'host' && !r.city);
  const hosts = (c: string) => sup || hostAll || roles.some((r) => r.role === 'host' && r.city === c);
  const judges = (c: string) => roles.some((r) => r.role === 'judge' && (!r.city || r.city === c));
  const cities = sup || hostAll || roles.some((r) => r.role === 'judge' && !r.city) ? 'all' as const : Array.from(new Set(roles.map((r) => r.city).filter((c): c is string => !!c)));
  return { person: p, roles, super: sup, hosts, judges, cities };
}

/* what each action needs */
export type Need = 'super' | 'host' | 'judge-or-host';
export function allowed(d: Desk, need: Need, city: string | null): boolean {
  if (need === 'super') return d.super;
  if (!city) return d.super;
  if (need === 'host') return d.hosts(city);
  return d.hosts(city) || d.judges(city);
}
