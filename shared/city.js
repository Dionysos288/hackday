/* city.js: one city's page (city.html?city=<id>). The home's row, opened: the same name | strip | slot, with projects
   hanging on the city's session where cities hang on the day. A project opens as a sheet (&p=<slug> links to it).

   render(cfg) is a pure function of the config and one UTC minute. The world comes from DAY.calc (day-data.js), the
   same seeded data the home reads, so a city's row on the home and this page always agree: same winner, same counts,
   same moment. The look is saved/city.config.json (tuned in lab/city-lab.html); the seed and the schedule come from
   saved/day.config.json, so both pages draw the same day.

   The clock is real: before the session the page counts down, during it votes arrive as the day's data says, after
   it the result stands. For checking, ?moment=before|build|vote|last|closed|picked or ?t= (a position in the city's
   session, 0 to 1, from an hour before it starts to half an hour after the pick) move the clock, which keeps running
   from there; ?still=1 stops it. ?seed= and ?ground= preview a data set and a ground. Links to the home and to other
   cities carry all of these.

   Rules: same row as the home; time runs across; projects re-sort, rows glide, numbers never animate; a row never
   moves under the pointer or focus; one winner, one cut line; nothing listed twice; vote where you look, no toast; no
   ranking while building; vote traces are step lines; every vote lands as a tick at the now line; the rest of the
   day is always one click away; the winner's mark is the city's seal.

   Keys: J and K move between rows, V votes for the current row, Enter opens it, Escape closes it.
   window.CITY.extend(hooks) lets the lab add layouts and its panel without any of that in this file. */
(function () {
  'use strict';
  var D = window.DAY, M = D.calc;
  var DEF = {
    seed: 17, city: 'berlin', mode: 'tower', t: -1,
    schedule: 'sun', startHour: 9, buildMin: 90, voteMin: 60, pickAfter: 60,
    ground: 'night', top: 10, row: 56, nameSize: 32, disp: 128, pic: 36,
    strip: 'both', trace: 1.5, cut: 'full', ledger: 'ledger', peek: 1, table: 44, seal: 1,
    you: -1, rate: 1, reorder: 4, speed: 1, reduced: 0,
    sort: 'ranked', q: '', more: 0
  };
  /* [min, max, step] */
  var BOUNDS = {
    seed: [1, 9999, 1], t: [0, 1, 0.0001], startHour: [8, 11, 1], buildMin: [60, 180, 15], voteMin: [30, 120, 15], pickAfter: [30, 120, 15],
    top: [6, 12, 1], row: [48, 72, 4], nameSize: [20, 40, 2], disp: [72, 160, 4], pic: [28, 56, 4], trace: [1, 2.5, 0.5], peek: [0, 1, 1], table: [36, 56, 4], seal: [0, 1, 1],
    you: [-1, 40, 1], rate: [0, 30, 1], reorder: [2, 10, 1], speed: [0.5, 2, 0.1], reduced: [0, 1, 1], more: [0, 1, 1]
  };
  var CHOICES = { mode: ['tower'], city: D.cities.map(function (c) { return c.id; }), ground: ['night', 'paper', 'mint'], schedule: ['sun', 'same'], strip: ['both', 'arrivals', 'traces'], cut: ['full', 'short', 'off'], ledger: ['ledger', 'off'], sort: ['ranked', 'shuffled', 'newest'] };
  var MODES = { tower: tower };
  var HOOK = { base: '', links: null, configure: null, start: null, after: [], keys: null, click: null, empty: null };
  var NB = ' ';

  function clampCfg(c) {
    Object.keys(BOUNDS).forEach(function (k) {
      if (k === 't' && (c.t == null || +c.t < 0)) { c.t = -1; return; }
      var v = +c[k], b = BOUNDS[k]; c[k] = Math.min(b[1], Math.max(b[0], isFinite(v) && c[k] !== '' && c[k] != null ? v : DEF[k])); if (b[2] >= 1) c[k] = Math.round(c[k]);
    });
    Object.keys(CHOICES).forEach(function (k) { if (CHOICES[k].indexOf(String(c[k])) < 0) c[k] = DEF[k]; c[k] = String(c[k]); });
    c.q = String(c.q || '').slice(0, 60);
    return c;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  function hhmm(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function plural(n, w, pl) { return fmtN(n) + NB + (n === 1 ? w : (pl || w + 's')); }
  function fmtN(n) { return Number(n).toLocaleString('en-US'); }
  function ord(n) { return n + (n % 100 > 10 && n % 100 < 14 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')); }
  function tz(off) { if (!off) return 'UTC'; var s = off < 0 ? '−' : '+', a = Math.abs(off); return 'UTC' + s + Math.floor(a / 60) + (a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''); }
  function slug(p) { return M.slug(p.name); }
  /* a countdown: zero units drop; a day or more is said in days and hours */
  function dur(min, short) {
    min = Math.max(1, Math.round(min));
    if (min >= 1440) { var d = Math.floor(min / 1440), dh = Math.floor((min % 1440) / 60); return short ? d + NB + 'd' + (dh ? ' ' + dh + NB + 'h' : '') : plural(d, 'day') + (dh ? ' ' + plural(dh, 'hour') : ''); }
    var h = Math.floor(min / 60), m = min % 60;
    if (short) return (h ? h + NB + 'h' : '') + (h && m ? ' ' : '') + (m ? m + NB + 'min' : '');
    return (h ? plural(h, 'hour') : '') + (h && m ? ' ' : '') + (m ? plural(m, 'minute') : '');
  }

  /* ---------------- time ---------------- */
  function cityIndex(c) { return D.cities.filter(function (x) { return x.id === c.city; })[0].i; }
  /* this city's window: an hour before it starts to half an hour after the pick */
  function win(c) {
    var S = M.sched(c), x = S.cs[cityIndex(c)];
    return { S: S, x: x, w0: x.start - 60, w1: S.pickAt + 30 };
  }
  /* the minute on screen: the clock's, or (in the lab) the config's t across the window */
  function nowOf(c, Wn) { return c.now != null ? c.now : Wn.w0 + (c.t < 0 ? 0 : c.t) * (Wn.w1 - Wn.w0); }
  function tAt(m, Wn) { return clamp((m - Wn.w0) / (Wn.w1 - Wn.w0), 0, 1); }
  function moments(c) {
    var Wn = win(c), x = Wn.x, S = Wn.S;
    return [
      ['before', 'Before', tAt(x.start - 25, Wn)],
      ['build', 'Building', tAt(x.start + c.buildMin * 0.55, Wn)],
      ['vote', 'Voting', tAt(x.buildEnd + c.voteMin * 0.38, Wn)],
      ['last', 'Last minutes', tAt(x.end - Math.max(3, Math.round(c.voteMin * 0.1)), Wn)],
      ['closed', 'Closed', tAt(x.end + Math.min(25, (S.pickAt - x.end) / 2), Wn)],
      ['picked', 'Picked', tAt(S.pickAt + 15, Wn)]
    ];
  }
  /* the home's clock position for a minute, unclamped: below 0 is before the day, 0.94 and up the day after */
  function homeT(now, S) { return now > S.winEnd ? 1 : (now - S.winStart) / (S.winEnd - S.winStart) * M.TA; }

  /* ---------------- the world ---------------- */
  var voted = {};   /* this visitor's own votes, kept in the browser */
  function world(c) {
    var Wn = win(c), S = Wn.S, x = Wn.x, i = cityIndex(c), SD = M.seedData(c.seed), sd = SD.cities[i], all = M.all(sd), now = nowOf(c, Wn);
    var st = M.cityState(x, sd, now), city = x.city, off = city.offset;
    var votesOn = st.state === 'vote' || st.state === 'done', f = st.state === 'vote' ? st.f : st.state === 'done' ? 1 : 0;
    var rows = all.map(function (r) {
      var v = votesOn ? M.votesAt(r, f) : 0, mine = votesOn && st.state === 'vote' && voted[r.p.id] ? 1 : 0;
      return { r: r, p: r.p, k: r.k, a: r.a, arrive: x.start + r.af * c.buildMin, v: v + mine, mine: mine };
    });
    var arrived = st.state === 'next' ? [] : st.state === 'build' ? rows.filter(function (o) { return o.a < st.n; }) : rows;
    var ranked = votesOn ? arrived.slice().sort(function (a, b) { return b.v - a.v || a.k - b.k; }) : arrived.slice().sort(function (a, b) { return b.a - a.a; });
    ranked.forEach(function (o, j) { o.rank = j + 1; });
    var lead = votesOn && ranked.length ? ranked[0] : null, second = ranked[1];
    var total = arrived.reduce(function (a, o) { return a + o.v; }, 0);
    var picked = now >= S.pickAt, pick = SD.pick, pickCity = D.cities[pick], pickSd = SD.cities[pick];
    var ys = c.you >= 0 && c.you < rows.length ? rows.filter(function (o) { return o.k === c.you; })[0] : null;
    return {
      c: c, S: S, x: x, Wn: Wn, i: i, city: city, off: off, sd: sd, SD: SD, now: now, st: st, state: st.state, f: f, votesOn: votesOn,
      rows: rows, arrived: arrived, ranked: ranked, lead: lead, second: second, total: total, topV: sd.list[0].votes,
      /* traces share one vertical scale: the leader's count now, so first place's line reaches the top of its row */
      scaleV: Math.max(10, lead ? lead.v : 0),
      picked: picked, isPick: pick === i, pickCity: pickCity, pickWin: pickSd.list[0].p, you: ys,
      last: st.state === 'vote' && st.left <= Math.max(3, Math.round(c.voteMin * 0.1)) + 0.01,
      inDay: now >= S.winStart && now <= S.winEnd,
      day: S.cs.map(function (y, j) { return M.cityState(y, SD.cities[j], now); })
    };
  }
  /* the last few votes before now, from the shared vote curves (each entry's n-th vote has a minute) */
  function latest(W, n) {
    if (W.state !== 'vote') return [];
    var x = W.x, len = x.end - x.buildEnd, ev = [];
    W.rows.forEach(function (o) {
      var v = o.v - o.mine;
      for (var j = 0; j < 3 && v - j > 0; j++) { var fv = M.fOfVote(o.r, v - j); ev.push({ o: o, m: x.buildEnd + Math.max(0, fv) * len }); }
    });
    return ev.sort(function (a, b) { return b.m - a.m; }).slice(0, n);
  }
  function lastTen(W) {
    if (W.state !== 'vote') return 0;
    var x = W.x, f0 = Math.max(0, (W.now - 10 - x.buildEnd) / (x.end - x.buildEnd));
    return W.rows.reduce(function (a, o) { return a + (o.v - o.mine) - (W.now - 10 < x.buildEnd ? 0 : M.votesAt(o.r, f0)); }, 0);
  }

  /* ---------------- pictures and seals ---------------- */
  function pic(p, cls) { var u = p && window.projectPicture ? window.projectPicture(p) : ''; return p ? '<img class="' + (cls || 'pic') + '"' + (u ? ' src="' + u + '"' : '') + ' alt="" decoding="async">' : '<i class="' + (cls || 'pic') + ' pic-empty"></i>'; }
  var SEALC = {};
  function seal(id, size) {
    if (!window.SEAL) return ''; var k = id + ':' + size; if (SEALC[k] != null) return SEALC[k];
    try { SEALC[k] = window.SEAL.forCity(id, { size: size, draw: true }); } catch (e) { SEALC[k] = ''; }
    return SEALC[k];
  }

  /* ---------------- copy ---------------- */
  function local(W, m) { return hhmm(m + W.off); }
  function status(W) {
    var s = W.st, nm = W.city.name;
    if (s.state === 'next') return nm + ' starts at ' + local(W, W.x.start) + (s.wait >= 1440 ? ' on ' + D.date : '') + '. That is in ' + dur(s.wait) + '.';
    if (s.state === 'build') return nm + ' is building. Entries close in ' + dur(s.left) + '.';
    if (s.state === 'vote') return 'Voting closes in ' + dur(s.left) + '.';
    return W.lead.p.name + ' won ' + nm + '.';   /* the pick is said once, on the line under the table */
  }
  /* the main action. Remind me and Submit open forms (shared/forms.js), so they are buttons; the rest are links. */
  function action(W) {
    var s = W.state;
    if (s === 'next') return { t: 'Remind me', act: 'remind' };
    if (s === 'build') return { t: 'Submit your project', act: 'submit' };
    if (s === 'vote') return { t: 'Vote', href: '#sheet' };
    return W.picked ? { t: 'See the winner', href: homeHref(W, '#pick') } : { t: 'See the ten', href: homeHref(W, '') };
  }
  function noun(W, n) { return W.votesOn ? plural(n, 'project') : plural(n, 'entry', 'entries'); }
  function gapText(W, o) {
    if (!W.votesOn || !W.lead) return '';
    if (o === W.lead) return !W.second ? 'The only project' : o.v === W.second.v ? 'Level with 2nd' : fmtN(o.v - W.second.v) + ' ahead of 2nd';
    return o.v === W.lead.v ? 'Level with 1st' : fmtN(W.lead.v - o.v) + ' behind 1st';
  }
  function cutText(W, c) {
    if (c.cut === 'off') return '';
    var done = W.state === 'done';
    return c.cut === 'short' ? (done ? 'Won ' : 'Wins ') + W.city.name : 'The most votes ' + (done ? 'won ' : 'wins ') + W.city.name + '.';
  }

  /* ---------------- links between the pages (they carry the preview parameters) ---------------- */
  var q = new URLSearchParams(location.search);
  function carry(t) {
    var u = '';
    if (CLOCK.preview || CLOCK.still) u += '&t=' + t.toFixed(5);
    if (CLOCK.still) u += '&still=1';
    if (q.get('seed')) u += '&seed=' + encodeURIComponent(q.get('seed'));
    if (q.get('ground')) u += '&ground=' + encodeURIComponent(q.get('ground'));
    return u;
  }
  function cityHref(W, id) {
    if (HOOK.links) return HOOK.links.city(W, id);
    var y = W.S.cs.filter(function (z) { return z.city.id === id; })[0], w0 = y.start - 60, w1 = W.S.pickAt + 30;
    return 'city.html?city=' + id + carry((W.now - w0) / (w1 - w0));
  }
  function homeHref(W, hash) {
    if (HOOK.links) return HOOK.links.home(W, hash);
    var u = carry(homeT(W.now, W.S));
    return './' + (u ? '?' + u.slice(1) : '') + (hash || '');
  }
  function projectHref(W, p) {
    if (HOOK.links) return '#p-' + slug(p);
    return 'city.html?city=' + W.city.id + '&p=' + slug(p) + carry((W.now - W.Wn.w0) / (W.Wn.w1 - W.Wn.w0));
  }

  /* ---------------- the masthead and the mini day ---------------- */
  function miniDay(W, c) {
    var S = W.S, span = S.winEnd - S.winStart, X = function (m) { return r2((m - S.winStart) / span * 100); }, nx = X(Math.min(W.now, S.winEnd));
    var bars = W.day.map(function (y, j) {
      var me = j === W.i, l = X(y.start), w = X(y.end) - l;
      var fill = y.state === 'build' ? y.f * (y.buildEnd - y.start) / (y.end - y.start) : y.state === 'vote' ? (y.buildEnd - y.start) / (y.end - y.start) + y.f * (y.end - y.buildEnd) / (y.end - y.start) : y.state === 'done' ? 1 : 0;
      return '<a class="mini-b is-' + y.state + (me ? ' is-me' : '') + '" href="' + esc(cityHref(W, y.id)) + '" style="--l:' + l + '%;--w:' + r2(w) + '%;--j:' + j + ';--fill:' + r2(fill * 100) + '%"' + (me ? ' aria-current="page"' : '') + ' aria-label="' + esc(y.name) + '"><i></i></a>';
    }).join('');
    return '<nav class="mini"' + (c.mini ? ' data-style="' + c.mini + '"' : '') + ' aria-label="The whole day">' +
      '<a class="mini-home" href="' + esc(homeHref(W)) + '"><span class="mini-k">The day</span><span class="mini-v">' + esc(D.date) + '</span></a>' +
      '<span class="mini-plot">' + bars + (W.inDay ? '<i class="mini-now" style="left:' + nx + '%" data-g="1"></i>' : '') + '</span></nav>';
  }
  var MARK = '<svg viewBox="0 0 109 113" aria-hidden="true"><path class="lo" d="M63.708 110.284C60.8455 113.885 55.0414 111.912 54.9725 107.314L53.964 40.0627H99.2193C107.413 40.0627 111.983 49.5228 106.888 55.9374L63.708 110.284Z"/><path d="M45.317 2.07103C48.1765 -1.53037 53.9809 0.442937 54.0498 5.04075L54.4916 72.2922H9.80319C1.60924 72.2922 -2.96112 62.8321 2.13456 56.4175L45.317 2.07103Z"/></svg>';
  function masthead(W, c) {
    var a = action(W);
    return '<header class="mh mh-band cl-mh">' +
      '<a class="mh-mark" href="' + esc(homeHref(W)) + '" aria-label="Supabase Hackathon, the whole day">' + MARK + '<span>supabase <b>hackathon</b></span></a>' +
      miniDay(W, c) +
      '<p class="mh-status">' + esc(status(W)) + '</p>' +
      (a.act ? '<button type="button" class="mh-act g" data-g="1" data-act="' + a.act + '">' + esc(a.t) + '</button>'
        : '<a class="mh-act g" data-g="1" href="' + esc(a.href) + '" data-act="' + W.state + '">' + esc(a.t) + '</a>') + '</header>';
  }

  /* ---------------- the title ---------------- */
  function title(W, c) {
    var s = W.st, nm = W.city.name, k1, v1;
    if (s.state === 'next') { k1 = 'Starts in'; v1 = dur(s.wait, true); }
    else if (s.state === 'build') { k1 = 'Entries close in'; v1 = dur(s.left, true); }
    else if (s.state === 'vote') { k1 = 'Voting closes in'; v1 = dur(s.left, true); }
    else { k1 = 'Voting closed at'; v1 = local(W, W.x.end); }
    var n = W.state === 'next' ? 0 : W.state === 'build' ? s.n : W.sd.entries;
    var facts = [
      [k1, v1, s.state === 'next' || s.state === 'build' || s.state === 'vote'],
      ['Local time, ' + tz(W.off), local(W, W.now)],
      [W.votesOn ? 'Projects' : 'Entries', fmtN(n)],
      ['Votes', W.votesOn ? fmtN(W.total) : '–']
    ];
    var tem = r2(nm.length * 0.5 + 0.3);
    return '<section class="cl-title"' + (c.title ? ' data-title="' + c.title + '"' : '') + ' aria-label="' + esc(nm) + '">' +
      '<h1 class="cl-city" style="--tem:' + tem + '">' + esc(nm) + '</h1>' +
      '<dl class="cl-facts">' + facts.map(function (f, j) { return '<div class="fact' + (j === 0 ? ' fact-clock' : '') + '"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl></section>';
  }

  /* ---------------- the session strip (the city's bar, opened) ---------------- */
  function view(W) { var x = W.x, v0 = x.start - 10, v1 = x.end + 10; return { v0: v0, v1: v1, x: function (m) { return (m - v0) / (v1 - v0) * 100; }, nx: (W.now - v0) / (v1 - v0) * 100 }; }
  function sessionBar(W, V) {
    var x = W.x, s = W.st, l = V.x(x.start), w = V.x(x.end) - l, bf = (x.buildEnd - x.start) / (x.end - x.start) * 100, fill = 0;
    if (s.state === 'build') fill = s.f * bf; else if (s.state === 'vote') fill = bf + s.f * (100 - bf); else if (s.state === 'done') fill = 100;
    return '<span class="cl-bar is-' + s.state + '"><i class="bar" style="left:' + r2(l) + '%;width:' + r2(w) + '%;--bf:' + r2(bf) + '%;--fill:' + r2(fill) + '%"><i class="bar-b"></i><i class="bar-v"></i><i class="bar-run"></i></i>' +
      '<span class="sb-k" style="left:' + r2(l) + '%">Build ' + local(W, x.start) + '–' + local(W, x.buildEnd) + '</span>' +
      '<span class="sb-k" style="left:' + r2(V.x(x.buildEnd)) + '%">Vote ' + local(W, x.buildEnd) + '–' + local(W, x.end) + '</span>' +
      (W.now >= V.v0 && W.now <= V.v1 ? '<i class="sb-now" style="left:' + r2(V.nx) + '%" data-g="1"></i>' : '') + '</span>';
  }
  function ticks(W, V) {
    var o = '', x = W.x, first = Math.ceil(V.v0 / 15) * 15, live = W.now >= V.v0 && W.now <= V.v1;
    for (var m = first; m <= V.v1; m += 15) {
      var px = V.x(m), major = ((m + W.off) % 30 + 30) % 30 === 0, hide = !major || px < 3 || px > 97 || (live && Math.abs(px - V.nx) < 6);
      o += '<i class="cl-tick' + (m === x.buildEnd ? ' is-cut' : '') + (major ? ' major' : '') + '" style="left:' + r2(px) + '%">' + (hide ? '' : '<span>' + local(W, m) + '</span>') + '</i>';
    }
    return o + '<span class="cl-tz">' + tz(W.off) + '</span>';
  }
  function nowLine(W, V) {
    if (W.now < V.v0 || W.now > V.v1) return '';
    return '<div class="now cl-now" aria-hidden="true" data-g="1"><b style="transform:translateX(' + r2(V.nx) + '%)"><i></i><span>' + local(W, W.now) + '</span></b></div>';
  }
  /* one entry's line on the strip: the arrival mark, flat through the build, then the vote trace as steps to now */
  function trace(W, V, o, c, big) {
    var x = W.x, show = c.strip, h = 100, base = 92, top = big ? 10 : 14, out = '';
    var ax = V.x(o.arrive) * 10, end = Math.min(W.now, x.end), endX = V.x(end) * 10, bx = V.x(x.buildEnd) * 10;
    if (W.state === 'next' || o.arrive > W.now) return '';
    var d = 'M' + r2(ax) + ' ' + base + 'H' + r2(Math.min(endX, bx));
    if (W.votesOn && show !== 'arrivals') {
      var len = x.end - x.buildEnd, stepM = Math.max(2, Math.round(len / 12)), prevY = base, v = 0;
      for (var m = x.buildEnd; m <= end + 0.001; m += stepM) {
        var mm = Math.min(m, end), f = (mm - x.buildEnd) / len; v = M.votesAt(o.r, f);
        var y = r2(base - v / W.scaleV * (base - top));
        if (y !== prevY) { d += 'V' + y; prevY = y; }
        var nx = Math.min(m + stepM, end); d += 'H' + r2(V.x(nx) * 10);
        if (nx >= end) break;
      }
      if (o.mine) d += 'V' + r2(base - o.v / W.scaleV * (base - top));
    } else if (show === 'traces' && !W.votesOn) d = '';
    if (show === 'traces' && !W.votesOn) return '';
    out += '<svg class="tr" viewBox="0 0 1000 ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '"/></svg>';
    if (show !== 'traces') out += '<i class="arr" style="left:' + r2(ax / 10) + '%"></i>';
    return out;
  }
  /* a row someone just voted for: its highlight fades over --dur-flash (the age goes in as a negative delay, so a
     re-render never restarts it) */
  function flashAge(o, W) { var a = FLASH[o.p.id]; if (!a) return -1; var age = performance.now() - a; if (age > 1600 / W.c.speed) { delete FLASH[o.p.id]; return -1; } return Math.round(age); }
  function liAttr(W, o, cls, j) {
    var age = flashAge(o, W);
    return ' class="' + cls + (age >= 0 ? ' is-flash' : '') + '" data-k="' + (cls.indexOf('tb-r') === 0 ? 't' : 'p') + o.p.id + '" style="' + (j != null ? '--i:' + j + ';' : '') + (age >= 0 ? '--fage:-' + age + 'ms' : '') + '"';
  }

  /* ---------------- pieces of a row ---------------- */
  function rankCell(W, o) { return '<span class="rk">' + (W.votesOn ? o.rank : '') + '</span>'; }
  function nameLink(W, o, cls) {
    return '<a class="cl-pn ' + (cls || '') + '" href="' + esc(projectHref(W, o.p)) + '" data-pid="' + o.p.id + '" data-row>' + rankCell(W, o) + '<span class="pn">' + esc(o.p.name) + '</span>' +
      (W.c.you === o.k ? '<b class="you" data-g="1">Yours</b>' : '') + '</a>';
  }
  function voteBtn(W, o, cls) {
    var on = W.state === 'vote', v = !!voted[o.p.id];
    return '<button type="button" class="vb' + (cls ? ' ' + cls : '') + (v ? ' is-on' : '') + '" data-vote="' + o.p.id + '" aria-pressed="' + v + '"' + (on ? '' : ' disabled hidden') + ' aria-label="' + (v ? 'Take back your vote for ' : 'Vote for ') + esc(o.p.name) + '">' + (v ? 'Voted' : 'Vote') + '</button>';
  }
  function slotText(W, o) {
    if (!o) return { k: '', a: '', b: '' };
    if (W.state === 'build') return { k: 'Entry ' + String(o.a + 1).padStart(2, '0'), a: 'Arrived ' + local(W, o.arrive), b: '@' + o.p.handle };
    var first = o === W.lead, done = W.state === 'done';
    return { k: first ? (done ? (W.picked && W.isPick ? 'Picked' : 'Winner') : 'Leading') : ord(o.rank), a: plural(o.v, 'vote'), b: gapText(W, o) };
  }
  function slot(W, o, c) {
    var t = slotText(W, o), g = o && o === W.lead;
    return '<div class="slot cl-slot' + (g ? ' g' : '') + '"><span class="slot-pic">' + pic(o && o.p) + (c.peek && o ? pic(o.p, 'peek') : '') + '</span>' +
      '<span class="slot-k">' + (g ? '<i class="gsq" data-g="1"></i>' : '') + esc(t.k) + '</span><span class="slot-a">' + esc(t.a) + '</span><span class="slot-b">' + esc(t.b) + '</span></div>';
  }
  function sealMark(W, o, c) { return c.seal && W.state === 'done' && o === W.lead ? '<span class="mark cl-seal" aria-hidden="true">' + seal(W.city.id, 28) + '</span>' : ''; }
  function tie(W, o) { return o === W.lead && W.state === 'done' ? '<i class="tie cl-tie"' + (W.picked && W.isPick ? ' data-g="1"' : '') + ' aria-hidden="true"></i>' : ''; }
  function rowCls(W, o, extra) {
    if (!o) return 'cl-row is-empty' + (extra ? ' ' + extra : '');
    return 'cl-row' + (o === W.lead ? ' is-lead' : '') + (W.c.you === o.k ? ' is-you' : '') + (W.state === 'done' && o === W.lead && W.picked && W.isPick ? ' is-pick' : '') + (extra ? ' ' + extra : '');
  }

  /* the top of the sheet: the shown rows, held while a row is hovered or focused, batched otherwise */
  var shown = null, lastReorder = 0;
  function sheetRows(W, c, n, opts) {
    var trueTop = W.ranked.slice(0, n);
    if (!opts.live || !shown || shown.state !== W.state || shown.key !== W.c.city + W.c.seed + W.c.mode + n) { shown = { ids: trueTop.map(function (o) { return o.p.id; }), state: W.state, key: W.c.city + W.c.seed + W.c.mode + n }; lastReorder = performance.now(); }
    else {
      var held = holdNow(), due = performance.now() - lastReorder >= c.reorder * 1000, same = trueTop.map(function (o) { return o.p.id; }).join() === shown.ids.join();
      /* a hover holds the order for at most three batches, so the sheet never shows a stale ten for long */
      /* a change of leader never waits for the batch: first place is the one position that must not be stale (the cut line and the poster sit on it) */
      var lead = trueTop[0] && shown.ids[0] !== trueTop[0].p.id;
      if (!same && ((due || lead) && !held || performance.now() - lastReorder >= c.reorder * 3000)) { shown.ids = trueTop.map(function (o) { return o.p.id; }); lastReorder = performance.now(); }
    }
    var byId = {}; W.rows.forEach(function (o) { byId[o.p.id] = o; });
    var list = shown.ids.map(function (id) { return byId[id]; }).filter(Boolean);
    while (list.length < n) list.push(null);
    return list;
  }
  function holdNow() { var s = document.querySelector('.cl-sheet'); return !!(s && (s.matches(':hover') || s.contains(document.activeElement))) || !!(dlg && dlg.open); }

  /* ---------------- the tower: the top ten on the session strip ---------------- */
  function sheetHead(W, V, c) {
    return '<div class="cl-head" aria-hidden="true"><span class="cl-head-k">' + (W.votesOn ? (W.state === 'done' ? 'Final order' : 'By votes') : W.state === 'build' ? 'Newest first' : 'Not started') + '</span>' +
      '<span class="cl-axis">' + ticks(W, V) + sessionBar(W, V) + '</span></div>';
  }
  function placeholder(W, j) {
    var dash = W.state === 'next' && j < 3;
    return '<li class="cl-row is-empty' + (dash ? ' is-dash' : '') + '" data-k="e' + j + '"><span class="cl-pn"><span class="rk"></span><span class="pn">' + (dash ? '<i class="dash"></i>' : '') + '</span></span><span class="cl-strip"></span><div class="slot cl-slot"><span class="slot-pic">' + (dash ? '<i class="pic pic-empty"></i>' : '') + '</span><span class="slot-k"></span><span class="slot-a"></span><span class="slot-b"></span></div></li>';
  }
  function cut(W, c, j) { return j === 0 && W.votesOn && cutText(W, c) ? '<span class="cut" aria-hidden="true"><span>' + esc(cutText(W, c)) + '</span></span>' : ''; }
  function tower(W, c, opts) {
    var V = view(W), list = sheetRows(W, c, c.top, opts);
    var rows = list.map(function (o, j) {
      if (!o) return placeholder(W, j);
      return '<li' + liAttr(W, o, rowCls(W, o), j) + '>' + nameLink(W, o) +
        '<span class="cl-strip">' + trace(W, V, o, c) + flashTick(o, W, V) + '</span>' + slot(W, o, c) + voteBtn(W, o) + tie(W, o) + sealMark(W, o, c) + cut(W, c, j) + '</li>';
    }).join('');
    return '<section class="cl-sheet cl-tower" id="sheet" aria-label="' + esc(sheetLabel(W, c)) + '">' + sheetHead(W, V, c) +
      '<ol class="cl-rows">' + rows + '</ol>' + nowLine(W, V) + '<i class="cl-bound" style="--bx:' + r2(V.x(W.x.buildEnd) / 100) + '" aria-hidden="true"></i>' + foot(W, c) + '</section>';
  }
  function flashTick(o, W, V) { return FLASH[o.p.id] && W.state === 'vote' ? '<i class="vtick" style="left:' + r2(V.nx) + '%;--fage:-' + Math.round(performance.now() - FLASH[o.p.id]) + 'ms" data-g="1"></i>' : ''; }
  function sheetLabel(W, c) { return W.votesOn ? 'The top ' + c.top + ' in ' + W.city.name + ', by votes' : W.state === 'build' ? 'Entries in ' + W.city.name + ', newest first' : W.city.name + ' has no entries yet'; }
  /* under the sheet: your project, and the founders' pick. One line each, always present, so nothing moves. */
  function foot(W, c) {
    var y = W.you, ys = '', p = '';
    if (c.you >= 0) {
      if (W.state === 'next') ys = 'Entries open at ' + local(W, W.x.start) + '.';
      else if (!y || (W.state === 'build' && y.a >= W.st.n)) ys = 'Not in yet.';
      else if (W.state === 'build') ys = y.p.name + ', entry ' + String(y.a + 1).padStart(2, '0') + ', in at ' + local(W, y.arrive) + '.';
      else if (shown ? shown.ids.indexOf(y.p.id) >= 0 : y.rank <= c.top) ys = y.p.name + ' is ' + ord(y.rank) + ', in the ' + (c.top === 10 ? 'ten' : 'top ' + c.top) + ' above.';
      else ys = y.p.name + ' is ' + ord(y.rank) + ' with ' + plural(y.v, 'vote') + ', ' + gapText(W, y) + '.';
    }
    if (W.picked) p = W.isPick ? D.pickers + ' picked ' + W.lead.p.name + '. It won the day.' : D.pickers + ' picked ' + W.pickWin.name + ' from ' + W.pickCity.name + '.';
    else p = D.pickers + ' pick one of the ten at ' + local(W, W.S.pickAt) + '.';
    return '<p class="cl-foot"><span class="ft-you">' + (ys ? '<b class="you" data-g="1">Yours</b> ' + esc(ys) : '') + '</span>' +
      '<span class="ft-pick' + (W.picked && W.isPick ? ' g' : '') + '"' + (W.picked && W.isPick ? ' data-g="1"' : '') + '>' + esc(p) + '</span></p>';
  }

  /* ---------------- below the sheet ---------------- */
  function ledger(W, c) {
    if (c.ledger === 'off') return '';
    var ev = latest(W, 5), body;
    if (W.state === 'next' || W.state === 'build') body = '<li class="lg-note">Votes show here once voting opens at ' + local(W, W.x.buildEnd) + '.</li>';
    else if (W.state === 'done') body = '<li class="lg-note">Voting closed at ' + local(W, W.x.end) + '. ' + plural(W.total, 'vote') + ' in all.</li>';
    else body = ev.map(function (e) { var sAgo = Math.round((W.now - e.m) * 60); return '<li><span class="lg-t">' + (sAgo < 3 ? 'Just now' : sAgo < 60 ? sAgo + NB + 's ago' : local(W, e.m)) + '</span><span class="lg-n" title="' + esc(e.o.p.name) + '">' + esc(e.o.p.name) + '</span><span class="lg-r">' + ord(e.o.rank) + '</span></li>'; }).join('');
    return '<section class="cl-ledger" aria-labelledby="lg-h"><h2 class="lbl" id="lg-h">Latest votes</h2><ol>' + body + '</ol>' +
      '<p class="lg-c">' + (W.state === 'vote' ? '<b>' + fmtN(lastTen(W)) + '</b> in the last 10' + NB + 'minutes' : '') + '</p></section>';
  }
  function table(W, c) {
    var inSheet = {}, sheetList = shown ? shown.ids : [];
    sheetList.forEach(function (id) { inSheet[id] = 1; });
    var rest = W.arrived.filter(function (o) { return !inSheet[o.p.id]; }), sort = c.sort;
    if (!W.votesOn && sort === 'ranked') sort = 'newest';
    if (sort === 'ranked') rest.sort(function (a, b) { return a.rank - b.rank; });
    else if (sort === 'newest') rest.sort(function (a, b) { return b.a - a.a; });
    else rest = M.shuffle(rest, M.mulberry32(c.seed * 31 + W.i));
    var qq = c.q.trim().toLowerCase(), hits = [], note = '';
    if (qq) {
      var m = function (o) { return o.p.name.toLowerCase().indexOf(qq) >= 0 || ('@' + o.p.handle).toLowerCase().indexOf(qq.replace(/^@?/, '@')) >= 0; };
      hits = W.arrived.filter(function (o) { return inSheet[o.p.id] && m(o); });
      rest = rest.filter(m);
      if (hits.length) note = hits.map(function (o) { return o.p.name + (W.votesOn ? ' is ' + ord(o.rank) : ' is') + ' in the sheet above'; }).join('. ') + '.';
    }
    var cap = c.more ? rest.length : 30, shownRest = rest.slice(0, cap), lbl = W.votesOn ? 'All projects' : 'All entries';
    var rows = shownRest.map(function (o) {
      return '<li' + liAttr(W, o, 'tb-r' + (c.you === o.k ? ' is-you' : '')) + '>' +
        '<a class="tb-n" href="' + esc(projectHref(W, o.p)) + '" data-pid="' + o.p.id + '" data-row><span class="rk">' + (W.votesOn ? o.rank : '') + '</span><span class="pn">' + esc(o.p.name) + '</span>' + (c.you === o.k ? '<b class="you" data-g="1">Yours</b>' : '') + '</a>' +
        '<span class="tb-h">@' + esc(o.p.handle) + '</span><span class="tb-p">' + esc(o.p.pitch) + '</span><span class="tb-a">' + local(W, o.arrive) + '</span>' +
        '<span class="tb-v">' + (W.votesOn ? fmtN(o.v) : '') + '</span>' + voteBtn(W, o, 'vb-s') + '</li>';
    }).join('');
    var empty = W.state === 'next' ? 'No entries yet. Building opens at ' + local(W, W.x.start) + '.' : !rest.length && qq ? 'Nothing else matches “' + c.q + '”.' : !rest.length ? 'Every entry is in the sheet above.' : '';
    var sorts = [['ranked', 'Ranked'], ['shuffled', 'Shuffled'], ['newest', 'Newest']].map(function (s) {
      var dis = s[0] === 'ranked' && !W.votesOn;
      return '<button type="button" class="tb-s" data-sort="' + s[0] + '" aria-pressed="' + (sort === s[0]) + '"' + (dis ? ' disabled title="No ranking while building"' : '') + '>' + s[1] + '</button>';
    }).join('');
    return '<section class="cl-table" id="entries" aria-labelledby="tb-h"><div class="tb-head"><h2 class="lbl" id="tb-h">' + lbl + ' <span>' + fmtN(W.arrived.length) + '</span></h2>' +
      '<label class="tb-q"><span class="vh">Search ' + (W.votesOn ? 'projects' : 'entries') + '</span><input type="search" data-k="q" placeholder="Search by name or @handle" value="' + esc(c.q) + '" autocomplete="off" spellcheck="false"></label>' +
      '<div class="tb-sorts" role="group" aria-label="Sort">' + sorts + '</div></div>' +
      (note ? '<p class="tb-note">' + esc(note) + '</p>' : '') + (empty ? '<p class="tb-empty">' + esc(empty) + '</p>' : '') +
      '<ol class="tb-rows">' + rows + '</ol>' + (rest.length > cap ? '<button type="button" class="tb-more" data-more="1">Show all ' + fmtN(rest.length) + '</button>' : '') + '</section>';
  }
  function how(W, c) {
    var x = W.x, nm = W.city.name;
    return '<section class="how cl-how" aria-labelledby="how-h"><h2 class="lbl" id="how-h">How it works in ' + esc(nm) + '</h2><ol>' +
      '<li><span class="how-k">Build</span><span>Build from ' + local(W, x.start) + ' to ' + local(W, x.buildEnd) + ', ' + esc(nm) + ' time (' + hhmm(x.start) + ' to ' + hhmm(x.buildEnd) + ' UTC).</span></li>' +
      '<li><span class="how-k">Vote</span><span>Vote from ' + local(W, x.buildEnd) + ' to ' + local(W, x.end) + '. The project with the most votes wins ' + esc(nm) + '.</span></li>' +
      '<li><span class="how-k">Pick</span><span>' + esc(D.pickers) + ' pick one of the ten city winners at ' + local(W, W.S.pickAt) + '.</span></li></ol></section>';
  }
  function restOfDay(W, c) {
    var S = W.S, span = S.winEnd - S.winStart, X = function (m) { return (m - S.winStart) / span * 100; }, nx = X(Math.min(W.now, S.winEnd));
    var rows = W.day.filter(function (y, j) { return j !== W.i; }).map(function (y) {
      var t = y.state === 'next' ? ['Starts in', dur(y.wait, true)] : y.state === 'build' ? ['Building', plural(y.n, 'entry', 'entries')] : y.state === 'vote' ? ['Leading', y.lead.p.name] : [(W.picked && W.SD.pick === y.i ? 'Picked' : 'Winner'), y.lead.p.name];
      var l = X(y.start), w = X(y.end) - l, bf = (y.buildEnd - y.start) / (y.end - y.start) * 100, fill = y.state === 'build' ? y.f * bf : y.state === 'vote' ? bf + y.f * (100 - bf) : y.state === 'done' ? 100 : 0;
      return '<li class="rd-r is-' + y.state + '" data-k="d' + y.i + '"><a class="rd-n" href="' + esc(cityHref(W, y.id)) + '">' + esc(y.name) + '<span class="rd-loc">' + hhmm(y.start + y.city.offset) + '–' + hhmm(y.end + y.city.offset) + ' ' + tz(y.city.offset) + '</span></a>' +
        '<span class="strip rd-s" aria-hidden="true"><i class="bar" style="left:' + r2(l) + '%;width:' + r2(w) + '%;--bf:' + r2(bf) + '%;--fill:' + r2(fill) + '%"><i class="bar-b"></i><i class="bar-v"></i><i class="bar-run"></i></i></span>' +
        '<span class="rd-t"><span class="slot-k">' + esc(t[0]) + '</span><span class="slot-a">' + esc(t[1]) + '</span></span></li>';
    }).join('');
    return '<section class="cl-rest" aria-labelledby="rd-h"><h2 class="lbl" id="rd-h">The rest of the day <a href="' + esc(homeHref(W)) + '">See the whole day</a></h2><div class="rd-wrap"><ol>' + rows + '</ol>' +
      (W.inDay ? '<i class="rd-now" style="--nx:' + (Math.round(nx * 10) / 1000) + '" aria-hidden="true" data-g="1"></i>' : '') + '</div></section>';
  }
  function footer(W) { return '<footer class="ft"><span>' + esc(D.name) + ' · ' + esc(W.city.name) + '</span><span>Times are ' + esc(W.city.name) + ' time (' + tz(W.off) + ') unless marked UTC.</span></footer>'; }

  /* ---------------- render ---------------- */
  var frame, page, last = null, prevW = null, FLASH = {}, prevV = {};
  function render(c, opts) {
    opts = opts || {};
    c = clampCfg(Object.assign({}, DEF, c));
    if (c.t < 0) c.t = moments(c)[2][2];
    var W = world(c);
    if (window.dayPalette) window.dayPalette(c.ground);
    /* a vote someone else cast since the last frame lands as a tick at the now line (only when time runs forward) */
    if (opts.live && prevW && W.state === 'vote' && W.now > prevW.now && prevW.c.city === c.city && prevW.c.seed === c.seed) {
      var tnow = performance.now(); W.rows.forEach(function (o) { var pv = prevV[o.p.id]; if (pv != null && o.v - o.mine > pv) FLASH[o.p.id] = tnow; });
    } else if (!opts.live) FLASH = {};
    prevV = {}; W.rows.forEach(function (o) { prevV[o.p.id] = o.v - o.mine; });
    var closing = prevW && opts.live !== 'scrub' && prevW.state === 'vote' && W.state === 'done' && prevW.c.city === c.city && W.now > prevW.now;
    prevW = W;
    frame.dataset.mode = c.mode;
    var st = page.style;
    st.setProperty('--row', c.row); st.setProperty('--nsz', c.nameSize); st.setProperty('--disp', c.disp); st.setProperty('--shot', c.pic); st.setProperty('--trw', c.trace); st.setProperty('--tbh', c.table); st.setProperty('--speed', c.speed); st.setProperty('--top', c.top);
    page.dataset.state = W.state; page.dataset.last = W.last ? '1' : '';
    var fn = MODES[c.mode] || tower;
    var html = masthead(W, c) + title(W, c) + fn(W, c, opts) + ledger(W, c) + table(W, c) + how(W, c) + restOfDay(W, c) + footer(W);
    var tops = opts.live ? measure() : null;
    var tpl = document.createElement('template'); tpl.innerHTML = html;
    if (!last || last.mode !== c.mode || last.city !== c.city) { page.textContent = ''; page.appendChild(tpl.content); }
    else morph(page, tpl.content);
    if (tops) glide(tops);
    if (closing && !c.reduced) { page.classList.remove('closing'); void page.offsetWidth; page.classList.add('closing'); setTimeout(function () { page.classList.remove('closing'); }, 2600 / c.speed); }
    last = c;
    if (dlg && dlg.open && dlgId != null) dialogFill(W, dlgId);
    titles(W);
    return W;
  }
  /* the tab's title follows the city and the open project */
  function titles(W) {
    var o = dlg && dlg.open && dlgId != null ? W.rows.filter(function (r) { return r.p.id === dlgId; })[0] : null;
    var t = (o ? o.p.name + ' · ' : '') + W.city.name + ' · ' + D.name;
    if (document.title !== t) document.title = t;
  }
  /* rows glide when the order changes (FLIP: transform only, --dur-panel, --ease-move). Never under reduced motion. */
  function measure() { var m = {}; page.querySelectorAll('.cl-sheet [data-k^="p"]').forEach(function (e) { m[e.getAttribute('data-k')] = e.getBoundingClientRect().top; }); return m; }
  function glide(tops) {
    if (cfg.reduced || REDUCED.matches) return;
    var moved = [];
    page.querySelectorAll('.cl-sheet [data-k^="p"]').forEach(function (e) {
      var k = e.getAttribute('data-k'); if (tops[k] == null) return;
      var dy = tops[k] - e.getBoundingClientRect().top; if (Math.abs(dy) < 1) return;
      e.style.transition = 'none'; e.style.transform = 'translateY(' + Math.round(dy) + 'px)'; moved.push(e);
    });
    if (!moved.length) return;
    void page.offsetWidth;
    moved.forEach(function (e) { e.style.transition = ''; e.classList.add('gliding'); e.style.transform = ''; setTimeout(function () { e.classList.remove('gliding'); }, 400 / cfg.speed); });
  }
  /* a small keyed morph (the home's): keeps elements, focus and running animations when only text or attributes change */
  function morph(a, b) {
    var ac = a.childNodes, bc = Array.prototype.slice.call(b.childNodes), i;
    for (i = 0; i < bc.length; i++) { if (i < ac.length) same(ac[i], bc[i]); else a.appendChild(bc[i]); }
    while (ac.length > bc.length) a.removeChild(a.lastChild);
  }
  function same(x, y) {
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName || (x.nodeType === 1 && x.getAttribute('data-k') !== y.getAttribute('data-k'))) { x.parentNode.replaceChild(y, x); return; }
    if (x.nodeType !== 1) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; return; }
    var i, at;
    if (x.nodeName === 'INPUT') { if (document.activeElement !== x && x.value !== y.getAttribute('value')) x.value = y.getAttribute('value') || ''; return; }
    var gl = x.classList && x.classList.contains('gliding');   /* a gliding row keeps its transform until it lands */
    for (i = x.attributes.length - 1; i >= 0; i--) { at = x.attributes[i].name; if (gl && (at === 'style' || at === 'class')) continue; if (!y.hasAttribute(at)) x.removeAttribute(at); }
    for (i = 0; i < y.attributes.length; i++) { at = y.attributes[i]; if (gl && (at.name === 'style' || at.name === 'class')) continue; if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value); }
    if (x.namespaceURI === 'http://www.w3.org/2000/svg' && x.nodeName.toLowerCase() === 'svg') { if (x.innerHTML !== y.innerHTML) x.innerHTML = y.innerHTML; return; }
    morph(x, y);
  }

  /* ---------------- the project sheet (a real <dialog>) ---------------- */
  var dlg = null, dlgId = null, opener = null;
  function orderIds() { return Array.prototype.map.call(page.querySelectorAll('[data-row]'), function (a) { return +a.getAttribute('data-pid'); }).filter(function (v, i, a) { return a.indexOf(v) === i; }); }
  function dialogFill(W, id) {
    var o = W.rows.filter(function (r) { return r.p.id === id; })[0]; if (!o) return;
    var V = view(W), t = slotText(W, o), ids = orderIds(), ix = ids.indexOf(id), p = o.p;
    var prev = ix > 0 ? ids[ix - 1] : null, next = ix >= 0 && ix < ids.length - 1 ? ids[ix + 1] : null;
    var name = function (pid) { var r = W.rows.filter(function (x) { return x.p.id === pid; })[0]; return r ? r.p.name : ''; };
    var html = '<div class="pv-in"><header class="pv-top"><p class="pv-k">' + esc(W.city.name) + (W.votesOn ? ' · ' + ord(o.rank) + ' of ' + W.arrived.length : W.state === 'build' ? ' · Entry ' + String(o.a + 1).padStart(2, '0') : '') + '</p>' +
      '<button type="button" class="pv-x" data-close aria-label="Close">' + '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg></button></header>' +
      '<div class="pv-body"><span class="pv-pic">' + pic(p) + '</span><div class="pv-tx"><h2 class="pv-n" id="pv-h">' + esc(p.name) + '</h2><p class="pv-p">' + esc(p.pitch) + '</p>' +
      '<p class="pv-by">@' + esc(p.handle) + '</p><p class="pv-l"><a href="https://' + esc(p.repo) + '" target="_blank" rel="noopener">Repo</a><a href="https://' + esc(p.demo) + '" target="_blank" rel="noopener">Demo</a>' +
      (window.FORMS ? '<button type="button" class="pv-share" data-share="' + p.id + '">Share this project</button>' : '') + '</p>' +
      '<div class="pv-v"><p><b>' + esc(W.votesOn ? fmtN(o.v) : '–') + '</b> ' + (o.v === 1 ? 'vote' : 'votes') + '<span>' + esc(W.votesOn ? t.b : 'Arrived ' + local(W, o.arrive)) + '</span></p>' + voteBtn(W, o, 'vb-l') + '</div></div></div>' +
      '<div class="pv-strip"><span class="pv-sk">' + esc(W.city.name) + ', ' + local(W, W.x.start) + '–' + local(W, W.x.end) + ' ' + tz(W.off) + '</span><span class="cl-axis">' + ticks(W, V) + sessionBar(W, V) + '</span><span class="cl-strip pv-tr">' + trace(W, V, o, W.c, true) + '</span>' + nowLine(W, V) + '</div>' +
      '<nav class="pv-nav" aria-label="Other projects"><button type="button" data-go="' + (prev == null ? '' : prev) + '"' + (prev == null ? ' disabled' : '') + '><span>Previous</span>' + esc(prev == null ? '' : name(prev)) + '</button>' +
      '<button type="button" data-go="' + (next == null ? '' : next) + '"' + (next == null ? ' disabled' : '') + '><span>Next</span>' + esc(next == null ? '' : name(next)) + '</button></nav></div>';
    var tpl = document.createElement('template'); tpl.innerHTML = html;
    if (!dlg.firstChild || dlg.dataset.id !== String(id)) { dlg.textContent = ''; dlg.appendChild(tpl.content); dlg.dataset.id = id; } else morph(dlg, tpl.content);
  }
  /* the open project is in the URL (&p=<slug>), so it can be linked; replaceState, so Back still leaves the page */
  function urlProject(p) {
    if (HOOK.links) return;
    var u = new URL(location.href); if (p) u.searchParams.set('p', slug(p)); else u.searchParams.delete('p');
    history.replaceState(history.state, '', u);
  }
  function openProject(id, from) {
    if (!dlg) return;
    dlgId = id; opener = from || opener; dialogFill(prevW, id);
    var o = prevW.rows.filter(function (r) { return r.p.id === id; })[0]; urlProject(o && o.p); titles(prevW);
    if (!dlg.open) { dlg.showModal(); var x = dlg.querySelector('[data-close]'); if (x) x.focus(); }
  }
  function onClose() {
    var id = dlgId; dlgId = null; urlProject(null); if (prevW) titles(prevW);
    var row = page.querySelector('.cl-sheet [data-pid="' + id + '"], [data-pid="' + id + '"]');
    (row || opener || document.body).focus({ preventScroll: false });
    opener = null;
  }
  function share(id) {
    var F = window.FORMS, o = prevW && prevW.rows.filter(function (r) { return r.p.id === id; })[0];
    if (!F || typeof F.share !== 'function' || !o) return;
    F.share({ name: o.p.name, pitch: o.p.pitch, handle: o.p.handle, city: prevW.city.id, cityName: prevW.city.name, slug: slug(o.p), rank: prevW.votesOn ? o.rank : null, votes: prevW.votesOn ? o.v : null });
  }

  /* ---------------- voting ---------------- */
  /* a vote counts once the person has confirmed an email (shared/forms.js). Without that file, it counts locally. */
  var VKEY = 'hackday-votes';
  function readVotes() { try { var all = JSON.parse(localStorage.getItem(VKEY) || '{}'); return all[cfg.city + ':' + cfg.seed] || {}; } catch (e) { return {}; } }
  function writeVotes() { try { var all = JSON.parse(localStorage.getItem(VKEY) || '{}'); all[cfg.city + ':' + cfg.seed] = voted; localStorage.setItem(VKEY, JSON.stringify(all)); } catch (e) { /* storage blocked: votes last for this visit */ } }
  function vote(id) {
    if (!prevW || prevW.state !== 'vote') return;
    if (voted[id]) { delete voted[id]; writeVotes(); go({ live: true }); return; }
    var F = window.FORMS, ok = F && typeof F.ensureVoter === 'function' ? F.ensureVoter() : Promise.resolve(true);
    Promise.resolve(ok).then(function (yes) {
      if (!yes || !prevW || prevW.state !== 'vote') return;
      voted[id] = 1; writeVotes(); go({ live: true });
    }, function () { /* the email step failed: the vote is not counted */ });
  }
  /* the masthead's form actions */
  function formAct(kind) {
    var F = window.FORMS, W = prevW; if (!F || !W) return;
    var at = function (m) { return new Date(EPOCH + m * 60000); };
    if (kind === 'submit' && typeof F.submit === 'function') F.submit({ city: W.city.id, cityName: W.city.name, deadline: at(W.x.buildEnd) });
    if (kind === 'remind' && typeof F.remind === 'function') F.remind({ city: W.city.id, cityName: W.city.name, when: at(W.x.start) });
  }

  /* ---------------- the clock ---------------- */
  var EPOCH = Date.UTC(D.year, D.month - 1, D.day);   /* minute 0: Dec 11, 00:00 UTC */
  var CLOCK = { offset: 0, still: q.get('still') === '1', at: 0, preview: false };
  function realMinute() { return (Date.now() - EPOCH) / 60000; }
  function clockNow() { return CLOCK.still ? CLOCK.at : realMinute() + CLOCK.offset; }
  function setClock(c) {
    var Wn = win(c), at = null, mm = q.get('moment'), t = q.get('t');
    if (mm) { var m = moments(c).filter(function (x) { return x[0] === mm; })[0]; if (m) at = Wn.w0 + m[2] * (Wn.w1 - Wn.w0); }
    if (at == null && t != null && t !== '' && isFinite(+t)) at = Wn.w0 + +t * (Wn.w1 - Wn.w0);
    CLOCK.preview = at != null;
    if (at == null) at = realMinute();
    CLOCK.offset = at - realMinute(); CLOCK.at = at;
  }

  /* ---------------- boot ---------------- */
  var cfg = Object.assign({}, DEF), STILL = CLOCK.still;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  function go(opts) {
    clampCfg(cfg);
    if (!HOOK.start) cfg.now = clockNow();
    var W = render(cfg, opts);
    HOOK.after.forEach(function (f) { f(W, cfg, opts); });
    return W;
  }
  function arrive(force) {
    var seen = false; try { seen = !!sessionStorage.getItem('city-intro'); } catch (e) { /* storage blocked */ }
    if ((seen && !force) || REDUCED.matches || cfg.reduced || STILL || document.documentElement.classList.contains('vt-in')) return;
    page.classList.remove('arrive'); void page.offsetWidth; page.classList.add('arrive');
    try { sessionStorage.setItem('city-intro', '1'); } catch (e) { /* storage blocked */ }
    setTimeout(function () { page.classList.remove('arrive'); }, 1400 / cfg.speed);
  }

  /* ---------------- keys ---------------- */
  var cur = -1;
  function rowLinks() { return Array.prototype.slice.call(page.querySelectorAll('a[data-row]')); }
  function keys(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tg = e.target; if (tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) return;
    if (document.querySelector('dialog[open]:not(#pv)')) return;   /* a form sheet is open */
    if (dlg && dlg.open) {
      if (e.key === 'v' || e.key === 'V') { if (dlgId != null) vote(dlgId); }
      return;
    }
    var k = e.key, links = rowLinks();
    if (k === 'j' || k === 'J' || k === 'k' || k === 'K') {
      e.preventDefault(); var at = links.indexOf(document.activeElement); if (at < 0) at = cur;
      at = clamp(at + (k.toLowerCase() === 'j' ? 1 : -1), 0, links.length - 1); if (at < 0 && links.length) at = 0;
      cur = at; if (links[at]) links[at].focus();
    } else if (k === 'v' || k === 'V') {
      var a = document.activeElement && document.activeElement.closest && document.activeElement.closest('li, .ld-poster'), b = a && a.querySelector('[data-vote]');
      if (!b && links[cur]) { var li = links[cur].closest('li, .ld-poster'); b = li && li.querySelector('[data-vote]'); }
      if (b && !b.disabled) vote(+b.getAttribute('data-vote'));
    } else if (HOOK.keys) HOOK.keys(e);
  }
  function onClick(e) {
    if (HOOK.click && HOOK.click(e)) return;
    if (dlg && dlg.open && e.target === dlg) { dlg.close(); return; }   /* a click on the backdrop */
    var vb = e.target.closest('[data-vote]'); if (vb) { e.preventDefault(); vote(+vb.getAttribute('data-vote')); return; }
    var so = e.target.closest('[data-sort]'); if (so) { cfg.sort = so.getAttribute('data-sort'); go(); return; }
    var mo = e.target.closest('[data-more]'); if (mo) { cfg.more = 1; go(); return; }
    var gx = e.target.closest('[data-go]'); if (gx) { if (gx.getAttribute('data-go')) openProject(+gx.getAttribute('data-go')); return; }
    if (e.target.closest('[data-close]')) { dlg.close(); return; }
    var sh = e.target.closest('[data-share]'); if (sh) { share(+sh.getAttribute('data-share')); return; }
    var row = e.target.closest('a[data-row]');
    if (row) { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); var links = rowLinks(); cur = links.indexOf(row); openProject(+row.getAttribute('data-pid'), row); return; }
    var act = e.target.closest('.mh-act');
    if (act && act.dataset.act === 'vote') { e.preventDefault(); var f = page.querySelector('.cl-sheet a[data-row]'); if (f) { f.focus(); cur = 0; } return; }
    if (act && (act.dataset.act === 'submit' || act.dataset.act === 'remind')) { formAct(act.dataset.act); return; }
    if (e.target.closest('a, button, input, select, label, dialog')) return;
    if (HOOK.empty) HOOK.empty(e);
  }
  function onInput(e) { if (e.target.matches('.tb-q input')) { cfg.q = e.target.value; cfg.more = 0; go(); } }

  /* the clock ticks once a second; votes arrive as the day's data says */
  function startClock() {
    setInterval(function () { if (!STILL && !document.hidden) go({ live: true }); }, 1000);
    if (window.FORMS && typeof window.FORMS.on === 'function') window.FORMS.on('change', function () { go({ live: true }); });
  }

  /* view transition from the home: the city name and its bar travel (cross-document, an enhancement) */
  window.addEventListener('pagereveal', function (e) { if (!e.viewTransition) return; e.viewTransition.ready.catch(function () { /* skipped or aborted: plain navigation */ }); document.documentElement.classList.add('vt-in'); });

  function load(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); }
  function configure(c) {
    ['seed', 'city', 'ground', 'sort', 'q'].forEach(function (k) { if (q.get(k) != null) c[k] = q.get(k); });
    c.mode = 'tower'; c.you = -1; if (STILL) c.rate = 0;
    clampCfg(c); setClock(c); c.now = clockNow();
  }
  function boot() {
    frame = document.getElementById('city'); page = frame.querySelector('.dl-page');
    dlg = document.getElementById('pv'); dlg.addEventListener('close', onClose);
    /* first paint straight away from the URL, so a view transition from the home has a page to land on */
    cfg = Object.assign({}, DEF, D.SCHED); (HOOK.configure || configure)(cfg, q); voted = readVotes(); go();
    var seals = window.SEAL ? window.SEAL.load(HOOK.base + 'saved/seal.config.json') : Promise.resolve();
    Promise.all([load(HOOK.base + 'saved/day.config.json'), load(HOOK.base + 'saved/city.config.json'), seals]).then(function (s) {
      var day = s[0], city = s[1], base = Object.assign({}, DEF, D.SCHED);
      ['seed', 'schedule', 'startHour', 'buildMin', 'voteMin', 'pickAfter'].forEach(function (k) { if (day[k] != null) base[k] = day[k]; });
      Object.keys(city).forEach(function (k) { if (['schedule', 'startHour', 'buildMin', 'voteMin', 'pickAfter'].indexOf(k) < 0 && city[k] != null) base[k] = city[k]; });
      cfg = base; (HOOK.configure || configure)(cfg, q); voted = readVotes(); SEALC = {};
      go(); arrive(false);
      document.addEventListener('keydown', keys); document.addEventListener('click', onClick); page.addEventListener('input', onInput);
      if (HOOK.start) HOOK.start(); else {
        startClock();
        /* &p=<slug> opens that project */
        var want = q.get('p'), o = want && prevW.arrived.filter(function (r) { return slug(r.p) === want; })[0];
        if (o) openProject(o.p.id);
      }
      document.documentElement.dataset.ready = '1';
    });
  }

  var P = {
    esc: esc, r2: r2, clamp: clamp, hhmm: hhmm, plural: plural, fmtN: fmtN, ord: ord, dur: dur, tz: tz, slug: slug, local: local, NB: NB,
    view: view, sessionBar: sessionBar, ticks: ticks, trace: trace, liAttr: liAttr, rankCell: rankCell, nameLink: nameLink, voteBtn: voteBtn,
    slotText: slotText, slot: slot, sealMark: sealMark, tie: tie, rowCls: rowCls, sheetRows: sheetRows, sheetHead: sheetHead, placeholder: placeholder,
    cut: cut, cutText: cutText, flashTick: flashTick, sheetLabel: sheetLabel, foot: foot, pic: pic, homeT: homeT, tAt: tAt, win: win
  };
  window.CITY = {
    DEF: DEF, BOUNDS: BOUNDS, CHOICES: CHOICES, MODES: MODES, parts: P,
    clampCfg: clampCfg, render: function (c, o) { return render(c, o); }, go: go, arrive: arrive, vote: vote,
    moments: function (c) { return moments(clampCfg(Object.assign({}, DEF, D.SCHED, c))); },
    world: function (c) { var x = clampCfg(Object.assign({}, cfg, c)); if (x.t < 0) x.t = moments(x)[2][2]; return world(x); },
    get cfg() { return cfg; }, set cfg(c) { cfg = c; },
    get page() { return page; }, get last() { return prevW; },
    reset: function () { voted = {}; shown = null; prevW = null; },
    resetShown: function () { shown = null; },
    /* hooks: { base, defaults, bounds, choices, modes, links: { city(W, id), home(W, hash) }, configure(cfg, q), start(), after(W, cfg, opts), keys(e), click(e) -> handled, empty(e) } */
    extend: function (h) {
      if (h.defaults) Object.assign(DEF, h.defaults);
      if (h.bounds) Object.assign(BOUNDS, h.bounds);
      if (h.choices) Object.keys(h.choices).forEach(function (k) { CHOICES[k] = h.choices[k]; });
      if (h.modes) Object.keys(h.modes).forEach(function (k) { MODES[k] = h.modes[k]; if (CHOICES.mode.indexOf(k) < 0) CHOICES.mode.push(k); });
      ['base', 'links', 'configure', 'start', 'keys', 'click', 'empty'].forEach(function (k) { if (h[k] != null) HOOK[k] = h[k]; });
      if (h.after) HOOK.after.push(h.after);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
