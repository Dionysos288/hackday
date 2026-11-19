/* mail.ts: the five emails, as words. Plain sentences, one link each, the city and its local time in the subject.
   Pure, so the desk's outbox and the lab can show exactly what was (or would have been) sent.

   link      your place on the list, and your link (to a builder, from the guest list)
   code      your six-digit code, with a link that does the same
   role      you are a host or a judge, with the desk link
   reminder  your city starts soon (Remind me)
   again     the same link again (Send it again, on the desk or from the sign-in sheet)
   claim     a six-digit code to the address a place is listed under, when someone signed in elsewhere claims it */
import { ON_LIST_NEXT } from './rule';
import { EVENT } from '@/lib/day-data';
import { checkIt } from '@/lib/hackday-server';

export type Template = 'link' | 'code' | 'role' | 'reminder' | 'again' | 'claim';
export type MailData = {
  city?: string;          /* the city's name */
  when?: string;          /* the start in the city's own time, "09:00 on 10 December" */
  link?: string;          /* the one link */
  code?: string;          /* six digits */
  role?: 'host' | 'judge' | 'super';
  name?: string;          /* the person's public name, when known */
  account?: string;       /* claim: the email of the account asking for the place */
};
export type Mail = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const ROLE: Record<string, string> = { host: 'a host', judge: 'a judge', super: 'a super admin' };

function body(lines: string[], link?: { href: string; label: string }, after: string[] = []): { text: string; html: string } {
  const text = lines.join('\n\n') + (link ? '\n\n' + link.label + ': ' + link.href : '') + (after.length ? '\n\n' + after.join('\n\n') : '') + '\n\n' + EVENT.name;
  const p = (s: string) => '<p style="margin:0 0 16px;font:16px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111">' + esc(s) + '</p>';
  const html = '<!doctype html><html><body style="margin:0;padding:24px;background:#fff">' + lines.map(p).join('')
    + (link ? '<p style="margin:24px 0"><a href="' + esc(link.href) + '" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:6px;text-decoration:none;font:500 16px -apple-system,Segoe UI,Helvetica,Arial,sans-serif">' + esc(link.label) + '</a></p>'
      + p('Or open this address: ' + link.href) : '')
    + after.map(p).join('') + p(EVENT.name) + '</body></html>';
  return { text, html };
}

export function render(t: Template, d: MailData): Mail {
  const city = d.city || 'your city', hi = d.name ? 'Hi ' + d.name + ',' : 'Hi,';
  switch (t) {
    case 'link': return {
      subject: 'Your place in ' + city + ', ' + EVENT.name,
      ...body([hi, 'You’re on the list for ' + EVENT.name + ' in ' + city + (d.when ? '. Building starts at ' + d.when + ', local time.' : '.'),
        'This link signs you in. Before the day it opens our page with your own editor line: add it to your editor, then say “' + checkIt() + '” to try it. On the day the same link opens ' + city + '’s page.',
        'Keep it: it works until the day after, and you can open it again. ' + ON_LIST_NEXT + ' Anyone can vote.'],
        d.link ? { href: d.link, label: 'Open your place in ' + city } : undefined,
        ['Not you, or got this by mistake? Ignore it; nothing happens unless the link is opened.']),
    };
    case 'again': return {
      subject: 'Your link for ' + city + ', ' + EVENT.name,
      ...body([hi, 'Here is your link for ' + city + ' again. It signs you in on any device.'],
        d.link ? { href: d.link, label: 'Open ' + city } : undefined),
    };
    case 'code': return {
      subject: (d.code ? d.code + ' is your code' : 'Your code') + ' for ' + EVENT.name,
      ...body(['Your code is ' + (d.code || '') + '.', 'Type it in the sheet that asked for it. It works for an hour.'],
        d.link ? { href: d.link, label: 'Or sign in with this link' } : undefined,
        ['If you did not ask for a code, ignore this email.']),
    };
    case 'role': return {
      subject: 'You are ' + ROLE[d.role || 'host'] + (d.city ? ' for ' + d.city : '') + ' at ' + EVENT.name,
      ...body([hi, 'You were added as ' + ROLE[d.role || 'host'] + (d.city ? ' for ' + d.city : ' for every city') + '.',
        d.role === 'judge' ? 'You have 50 votes for the day and may put several on one project. Vote on the city pages while voting is open.'
          : 'The desk is where you run the day: the guest list, the entries, the stage and the door.',
        'Sign in with this email; we send a six-digit code each time.'],
        d.link ? { href: d.link, label: d.role === 'judge' ? 'Open ' + (d.city || 'the cities') : 'Open the desk' } : undefined),
    };
    case 'claim': return {
      subject: (d.code ? d.code + ' is your code' : 'Your code') + ' to move your place in ' + city,
      ...body(['Your code is ' + (d.code || '') + '.',
        'Someone signed in' + (d.account ? ' as ' + d.account : '') + ' asked to move your place in ' + city + ' to that account. If that was you, type the code where it asked. It works for 15 minutes.'],
        undefined,
        ['If it was not you, ignore this email. Your place stays where it is.']),
    };
    case 'reminder': return {
      subject: city + ' starts' + (d.when ? ' at ' + d.when : ' soon') + ', ' + EVENT.name,
      ...body([hi, city + ' starts' + (d.when ? ' at ' + d.when + ', local time' : ' soon') + '. Voting opens when building starts.'],
        d.link ? { href: d.link, label: 'Open ' + city } : undefined),
    };
  }
}
