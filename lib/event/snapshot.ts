/* snapshot.ts: what the public pages read about a city, as one JSON answer (event-plan.md, "Reading: one snapshot per
   city"). The shape is shared by the server that builds it and the pages that read it. No email, no owner id, no
   flag: only what a visitor may see. Times are milliseconds since 1970 (UTC). Pure. */

export type SnapCity = {
  id: string; name: string; offset: number; venue: string | null; luma: string | null; editor: string | null;
  planned: number; buildMin: number; voteAfter: number;
  /* the live times, set when the host starts the clock; null before */
  buildStart: number | null; buildEnd: number | null; voteEnd: number | null;
  submissionsPaused: boolean; votingPaused: boolean;
};
export type SnapEntry = {
  no: number; slug: string; name: string; pitch: string; url: string; repo: string | null; video: string | null;
  picture: string | null; by: string | null; via: 'editor' | 'web'; created: number;
  votes: number; judge: number; reached: number;
};
/* every vote that counts, oldest first: [entry no, ms, n, 1 when a judge's] (n is 1 for a public vote; a judge's press
   may be several, or negative when taken back) */
export type SnapStep = [no: number, at: number, n: number, judge: 0 | 1];
export type CitySnap = { at: number; stale?: boolean; city: SnapCity; entries: SnapEntry[]; steps: SnapStep[] };
/* the pick, once a super admin has entered Ant and Copple's choice */
export type DaySnap = { at: number; stale?: boolean; cities: CitySnap[]; pick: { city: string; no: number } | null };

/* the ranking rule: most votes, then who reached that count first, then who arrived first */
export function rankOrder(a: SnapEntry, b: SnapEntry): number { return b.votes - a.votes || a.reached - b.reached || a.created - b.created; }

/* the phase at a moment, from the live times (planned times before the clock starts are never a phase) */
export function phaseAt(c: SnapCity, ms: number): 'next' | 'build' | 'vote' | 'done' {
  if (c.buildStart == null || ms < c.buildStart) return 'next';
  if (ms < (c.buildEnd ?? Infinity)) return 'build';
  if (ms < (c.voteEnd ?? Infinity)) return 'vote';
  return 'done';
}
