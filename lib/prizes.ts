/* prizes.ts: what the day gives away.

   Decided by the owner on 2026-11-17:
   - The city prize: each city's first place wins a MacBook Neo.
   - The global prize: the one Ant and Copple pick from the thirty finalists wins $10,000.
   - Whether 2nd and 3rd in a city get anything is not decided, so nothing is said about them.
   A prize is named once per page, next to the thing that wins it. Pure. */

export type Prize = { what: string | null; confirmed: boolean };
export const PRIZES: { city: Prize; global: Prize } = {
  city: { what: 'a MacBook Neo', confirmed: true },
  global: { what: '$10,000', confirmed: true },
};

/* the city prize as a line: at the cut, beside first place */
export function cityPrize(city?: string, done?: boolean): string {
  const w = PRIZES.city.what;
  if (!w) return '1st place ' + (done ? 'won' : 'wins') + ' the city prize.';
  return '1st' + (city ? ' in ' + city : '') + (done ? ' won ' : ' wins ') + w + '.';
}
/* the global prize as a line: at the join */
export function globalPrize(done?: boolean): string {
  const w = PRIZES.global.what;
  if (!w) return done ? 'The pick won the global prize.' : 'The pick wins the global prize, to be announced.';
  return 'The pick ' + (done ? 'won ' : 'wins ') + w + '.';
}
/* short forms for a fact cell: a label and a value */
export function prizeFacts(): [string, string][] {
  return [['City prize', PRIZES.city.what ? cap(PRIZES.city.what.replace(/^an? /, '')) : 'To be announced'], ['Global prize', PRIZES.global.what ? cap(PRIZES.global.what.replace(/^an? /, '')) : 'To be announced']];
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
