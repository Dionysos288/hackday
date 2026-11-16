/* day-data.js: the one fixture for day-lab.html (the home) and city-lab.html (one city). Placeholders, not confirmed:
   which ten cities, the 09:00 local start, the date. Offsets are December UTC offsets in minutes. Sunrise and sunset
   are approximate local times for mid-December, used only to draw the daylight band; they are not checked against an
   almanac.

   DAY.calc holds everything both pages compute, so a city's row on the home and that city's own page always agree:
   the schedule, the clock, and each city's seeded project list. The home's seeding is kept call-for-call (same seed,
   same random draws, same winner and counts as before); each city then gets its full list of entries on top, with
   arrival times and a vote history. Projects 1-20 come from shared/data.js (window.HACK.P); the rest of each city's
   entries are generated here from the seed. */
(function () {
  'use strict';
  function hm(s) { var p = s.split(':'); return +p[0] * 60 + +p[1]; }
  var C = [
    ['sydney', 'Sydney', 660, '05:40', '19:58'],
    ['tokyo', 'Tokyo', 540, '06:40', '16:28'],
    ['singapore', 'Singapore', 480, '06:59', '19:00'],
    ['bengaluru', 'Bengaluru', 330, '06:30', '17:55'],
    ['berlin', 'Berlin', 60, '08:10', '15:53'],
    ['lagos', 'Lagos', 60, '06:50', '18:35'],
    ['london', 'London', 0, '07:59', '15:51'],
    ['sao-paulo', 'São Paulo', -180, '05:15', '18:45'],
    ['new-york', 'New York', -300, '07:09', '16:28'],
    ['san-francisco', 'San Francisco', -480, '07:14', '16:51']
  ];
  var cities = C.map(function (r, i) { return { i: i, id: r[0], name: r[1], offset: r[2], rise: hm(r[3]), set: hm(r[4]) }; });

  /* ---------------- calc: every number both pages show ---------------- */
  var TA = 0.94;   /* home clock: t from 0 to TA runs the day's strip; from TA to 1 is the day after (archived) */
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(a, R) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* c: { schedule, startHour, buildMin, voteMin, pickAfter }. Minutes are UTC minutes from Dec 11, 00:00. */
  function sched(c) {
    var cs = cities.map(function (city) {
      var start = c.schedule === 'same' ? c.startHour * 60 : c.startHour * 60 - city.offset;
      return { city: city, start: start, buildEnd: start + c.buildMin, end: start + c.buildMin + c.voteMin };
    });
    var first = Math.min.apply(null, cs.map(function (x) { return x.start; })), last = Math.max.apply(null, cs.map(function (x) { return x.end; }));
    var pickAt = Math.ceil((last + c.pickAfter) / 15) * 15, winStart = Math.floor((first - 60) / 60) * 60;
    var winEnd = Math.max(winStart + 1440, Math.ceil((pickAt + 30) / 60) * 60);
    return { cs: cs, first: first, last: last, pickAt: pickAt, winStart: winStart, winEnd: winEnd };
  }
  /* the home's clock: t (0..1) to a UTC minute and back */
  function nowOf(t, S) { return t >= TA ? S.winEnd + 7 * 1440 : S.winStart + t / TA * (S.winEnd - S.winStart); }
  function tOf(now, S) { return clamp((now - S.winStart) / (S.winEnd - S.winStart) * TA, 0, TA - 0.0005); }

  /* generated entries: plain names, plain pitches, one handle each */
  var NA = ['Quiet', 'Paper', 'Signal', 'Little', 'Open', 'Second', 'Night', 'Field', 'Pocket', 'Slow', 'North', 'Glass', 'Copper', 'Hollow', 'Kind', 'Loose', 'Plain', 'Late', 'Bright', 'Common', 'Small', 'Spare'];
  var NB = ['Queue', 'Ledger', 'Index', 'Lantern', 'Harbor', 'Atlas', 'Notebook', 'Relay', 'Sketch', 'Tally', 'Compass', 'Inbox', 'Garden', 'Mirror', 'Switch', 'Pantry', 'Almanac', 'Beacon', 'Thread', 'Drawer', 'Roster', 'Kettle'];
  var NF = ['Landlords', 'Book Clubs', 'Food Banks', 'Choirs', 'Night Shifts', 'Allotments', 'Climbing Gyms', 'Dog Walkers'];
  var PX = ['A Realtime board', 'Row-level policies', 'An Edge Function', 'A Storage browser', 'pgvector search', 'Magic-link sign-in', 'A Postgres changelog', 'A typed client', 'A cron dashboard', 'Presence cursors', 'A shared calendar', 'Auth with passkeys'];
  var PY = ['small teams', 'side projects', 'classrooms', 'a food bank', 'pet sitters', 'book clubs', 'open-source maintainers', 'a running club', 'event organizers', 'landlords and tenants', 'a corner shop', 'night-shift nurses'];
  var HN = ['ana', 'bo', 'chidi', 'dana', 'emre', 'femi', 'gus', 'hana', 'ivo', 'jin', 'kai', 'lena', 'milo', 'nia', 'oli', 'pia', 'quin', 'rui', 'sol', 'tara', 'uma', 'vik', 'wren', 'xiu', 'yara', 'zed'];
  var HS = ['.dev', '_b', '.sh', '.codes', '.app', '', '.io', '_k'];
  function slug(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  /* One city's seeded world. Draws from the home's two generators first and in the home's order, so the home's
     winner, entry count and vote counts are unchanged; everything after that uses its own generator. */
  var CACHE = {};
  function seedData(seed) {
    if (CACHE[seed]) return CACHE[seed];
    var H = window.HACK, P = H.P, R = mulberry32(seed * 7919 + 13), perm = shuffle(P, R), pick = Math.floor(R() * 10);
    var out = cities.map(function (city, i) {
      var Rc = mulberry32(seed * 1000 + i * 104729 + 7), entries = 48 + Math.floor(Rc() * 170), win = perm[i];
      var rest = shuffle(P.filter(function (p) { return p !== win; }), Rc).slice(0, 6), top = Math.round(entries * (1.6 + Rc() * 1.8));
      var list = [win].concat(rest).map(function (p, k) {
        return { p: p, votes: k ? Math.round(top * (0.93 - k * 0.1) * (0.88 + Rc() * 0.1)) : top, e: k ? 0.55 + Rc() * 0.4 : 1.05 + Rc() * 0.5 };
      });
      return { i: i, entries: entries, list: list, _all: null, seed: seed };
    });
    return (CACHE[seed] = { cities: out, pick: pick });
  }
  /* The full list for one city: the home's seven, the other thirteen sample projects, then generated entries up to the
     entry count. Every entry gets an arrival (a fraction of the build) and a vote curve. The tail is held under the
     second project at every moment (smaller total, slower curve), so the leader the home shows is the leader of the
     full list. */
  function all(sd) {
    if (sd._all) return sd._all;
    var H = window.HACK, P = H.P, Rx = mulberry32(sd.seed * 1000 + sd.i * 104729 + 99991), N = sd.entries;
    var inTop = sd.list.map(function (r) { return r.p; });
    var tailP = shuffle(P.filter(function (p) { return inTop.indexOf(p) < 0; }), Rx), used = {};
    P.forEach(function (p) { used[p.name] = 1; });
    for (var k = tailP.length + 7; k < N; k++) {
      var nm = '';
      for (var g = 0; g < 40 && (!nm || used[nm]); g++) {
        var a = Rx();
        nm = a < 0.12 ? NB[Math.floor(Rx() * NB.length)] + ' for ' + NF[Math.floor(Rx() * NF.length)]
          : a < 0.3 ? NB[Math.floor(Rx() * NB.length)] + ['ly', 'r', 'io', 'kit'][Math.floor(Rx() * 4)]
          : NA[Math.floor(Rx() * NA.length)] + ' ' + NB[Math.floor(Rx() * NB.length)];
      }
      if (used[nm]) nm += ' ' + (k + 1);
      used[nm] = 1;
      var hd = HN[Math.floor(Rx() * HN.length)] + (Rx() < 0.5 ? '' : HN[Math.floor(Rx() * HN.length)].slice(0, 3)) + HS[Math.floor(Rx() * HS.length)];
      var id = 1000 + sd.i * 1000 + k;
      tailP.push({ id: id, name: nm, handle: hd, pitch: PX[Math.floor(Rx() * PX.length)] + ' for ' + PY[Math.floor(Rx() * PY.length)] + '.',
        repo: 'github.com/' + hd.replace(/[^a-z0-9]/gi, '') + '/' + slug(nm), demo: slug(nm) + '.vercel.app', gen: true });
    }
    tailP = tailP.slice(0, Math.max(0, N - 7));
    var V7 = Math.min.apply(null, sd.list.slice(1).map(function (r) { return r.votes; })), e1 = sd.list[1].e, T = tailP.length;
    var tail = tailP.map(function (p, j) {
      var v = Math.round(V7 * 0.94 * Math.pow(1 - j / Math.max(1, T), 2.1) * (0.82 + Rx() * 0.18));
      return { p: p, votes: v, e: e1 + Rx() * 0.35 };
    });
    var full = sd.list.map(function (r) { return { p: r.p, votes: r.votes, e: r.e }; }).concat(tail);
    full.forEach(function (r, k) { r.k = k; });
    /* arrival order: a seeded shuffle; the first arrives as building opens. The home counts entries as
       max(1, round(N * f^0.85)), and these arrivals are placed so that count is exactly the number already in. */
    shuffle(full, Rx).forEach(function (r, a) { r.a = a; r.af = a ? Math.pow((a + 0.5) / N, 1 / 0.85) : 0; });
    return (sd._all = full);
  }
  /* votes for one entry at f (0..1 through voting); whole numbers, so the trace steps. The home's formula. */
  function votesAt(r, f) { return f >= 1 ? r.votes : Math.round(r.votes * Math.pow(Math.max(0.02, f), r.e)); }
  /* the minute (as a fraction of voting) at which an entry reached its n-th vote: the inverse of votesAt */
  function fOfVote(r, n) { return n <= 0 ? 0 : Math.pow((n - 0.5) / r.votes, 1 / r.e); }
  function countAt(N, f) { return Math.max(1, Math.round(N * Math.pow(f, 0.85))); }
  /* the leader of the full list at f; ties go to the earlier entry in the home's order */
  function leader(sd, f) { var best = null; all(sd).forEach(function (r) { var v = votesAt(r, f); if (!best || v > best.v) best = { p: r.p, v: v, r: r }; }); return best; }

  /* one city's state at UTC minute now: the same fields the home row reads */
  function cityState(x, sd, now) {
    var o = { i: x.city.i, id: x.city.id, name: x.city.name, city: x.city, start: x.start, buildEnd: x.buildEnd, end: x.end, entries: sd.entries, list: sd.list, sd: sd };
    if (now < x.start) { o.state = 'next'; o.wait = x.start - now; }
    else if (now < x.buildEnd) { o.state = 'build'; o.f = (now - x.start) / (x.buildEnd - x.start); o.n = countAt(sd.entries, o.f); o.left = x.buildEnd - now; }
    else if (now < x.end) { o.state = 'vote'; o.f = (now - x.buildEnd) / (x.end - x.buildEnd); o.n = sd.entries; o.left = x.end - now; var b = leader(sd, o.f); o.lead = { p: b.p, v: b.v }; }
    else { o.state = 'done'; o.n = sd.entries; o.lead = { p: sd.list[0].p, v: sd.list[0].votes }; }
    return o;
  }

  window.DAY = {
    date: 'Dec 11, 2026',
    year: 2026, month: 12, day: 11,
    name: 'Supabase Hackathon',
    pickers: 'Ant and Copple',
    /* east to west, always (rule 1) */
    cities: cities,
    /* Past rows come from HACK.past only. Winners of past hackathons are not in the repo, so none are shown. */
    past: function () { return (window.HACK && window.HACK.past) || []; },
    calc: { TA: TA, mulberry32: mulberry32, shuffle: shuffle, sched: sched, nowOf: nowOf, tOf: tOf, seedData: seedData, all: all, votesAt: votesAt, fOfVote: fOfVote, countAt: countAt, leader: leader, cityState: cityState, slug: slug },
    /* the schedule knobs both pages share, with the home's defaults */
    SCHED: { schedule: 'sun', startHour: 9, buildMin: 90, voteMin: 60, pickAfter: 60 }
  };
})();
