/* day.js: the home (index.html). Ten cities on one day, drawn as a timetable.

   render(cfg) is a pure function of the config and one UTC minute: the seed decides every city's entries, votes and
   winner (DAY.calc in day-data.js, shared with the city page), the minute decides the moment, and the config decides
   the look. The config is saved/day.config.json; lab/day-lab.html tunes it and writes it.

   The clock is real. Before the day the page is in its announced state with a true countdown, on the day it follows
   the clock, and after the last city it shows the finished day. For checking, the URL can move the clock (it then
   keeps running from there): ?moment=announced|first|mid|closed|picked|archived, or ?t= (a position in the day, 0 to 1;
   0.94 and up is the day after). ?still=1 stops it. ?ground= and ?seed= preview a ground and a data set. All of these
   carry across links to the city pages.

   Rules: cities east to west, always; one green now line; every city is one fixed row and text never reflows;
   unchanged cells do not move; heavier weight means live; green only for now, the leader or winner, you, the main
   action; a city announces only its top result; ten become one through joining lines; dashed means not yet, hatched
   means closed; every picture is a project picture.

   window.HOME.extend(hooks) lets the lab add layouts and its panel without any of that in this file. */
(function () {
  'use strict';
  var D = window.DAY, M = D.calc, TA = M.TA;
  var DEF = {
    seed: 17, mode: 'timetable', t: 0.5,
    ground: 'night', schedule: 'sun', startHour: 9, buildMin: 90, voteMin: 60, pickAfter: 60,
    display: 88, ratio: 1.5, row: 76, slope: 5, hair: 1, band: 100, soft: 75,
    green: 4, shot: 40, peek: 1, seal: 1, speed: 1, reduced: 0, you: -1
  };
  /* [min, max, step] */
  var BOUNDS = {
    seed: [1, 9999, 1], t: [0, 1, 0.001], startHour: [8, 11, 1], buildMin: [60, 180, 15], voteMin: [30, 120, 15], pickAfter: [30, 120, 15],
    display: [56, 128, 4], ratio: [1.2, 1.62, 0.02], row: [64, 96, 4], slope: [4, 6, 1], hair: [0.5, 1.5, 0.25], band: [0, 100, 5], soft: [0, 90, 5],
    green: [1, 4, 1], shot: [28, 56, 4], peek: [0, 1, 1], seal: [0, 1, 1], speed: [0.5, 2, 0.1], reduced: [0, 1, 1], you: [-1, 9, 1]
  };
  var CHOICES = { mode: ['timetable'], ground: ['night', 'paper', 'mint'], schedule: ['sun', 'same'] };
  var MODES = { timetable: timetable };
  var HOOK = { base: '', links: null, configure: null, start: null, after: [], ground: null };

  function clampCfg(c) {
    Object.keys(BOUNDS).forEach(function (k) { var v = +c[k], b = BOUNDS[k]; c[k] = Math.min(b[1], Math.max(b[0], isFinite(v) && c[k] !== '' && c[k] != null ? v : DEF[k])); if (b[2] >= 1) c[k] = Math.round(c[k]); });
    Object.keys(CHOICES).forEach(function (k) { if (CHOICES[k].indexOf(String(c[k])) < 0) c[k] = DEF[k]; c[k] = String(c[k]); });
    return c;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var NB = ' ';

  /* ---------------- time ---------------- */
  function sched(c) { return M.sched(c); }
  /* the minute on screen: the clock's, or (in the lab) the config's t */
  function nowOf(c, S) { return c.now != null ? c.now : M.nowOf(c.t, S); }
  function tOf(now, S) { return M.tOf(now, S); }
  function moments(c) {
    var S = sched(c), mid = S.cs[6];
    return [
      ['announced', 'Announced', 0],
      ['first', 'First city live', tOf(S.first + Math.min(45, c.buildMin / 2), S)],
      ['mid', 'Mid-day', tOf(mid.buildEnd + c.voteMin / 4, S)],
      ['closed', 'All closed', tOf(S.last + (S.pickAt - S.last) / 2, S)],
      ['picked', 'Picked', tOf(Math.min(S.pickAt + 15, S.winEnd - 5), S)],
      ['archived', 'Archived', 0.97]
    ];
  }
  function hhmm(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function dayOf(m) { return 'Dec ' + (D.day + Math.floor(Math.round(m) / 1440)); }
  function plural(n, w) { return n + NB + w + (n === 1 ? '' : 's'); }
  /* a countdown: zero units drop; a day or more is said in days and hours */
  function dur(min, short) {
    min = Math.max(1, Math.round(min));
    if (min >= 1440) { var d = Math.floor(min / 1440), dh = Math.floor((min % 1440) / 60); return short ? d + NB + 'd' + (dh ? ' ' + dh + NB + 'h' : '') : plural(d, 'day') + (dh ? ' ' + plural(dh, 'hour') : ''); }
    var h = Math.floor(min / 60), m = min % 60;
    if (short) return (h ? h + NB + 'h' : '') + (h && m ? ' ' : '') + (m ? m + NB + 'min' : '');
    return (h ? plural(h, 'hour') : '') + (h && m ? ' ' : '') + (m ? plural(m, 'minute') : '');
  }
  function tz(off) { if (!off) return 'UTC'; var s = off < 0 ? '−' : '+', a = Math.abs(off); return 'UTC' + s + Math.floor(a / 60) + (a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''); }

  /* ---------------- the seeded world ---------------- */
  function world(c) {
    var S = sched(c), now = nowOf(c, S), SD = M.seedData(c.seed), archived = now > S.winEnd;
    /* each city's state, and its leader, come from the full seeded list it shares with its own page */
    var cs = S.cs.map(function (x, i) { return M.cityState(x, SD.cities[i], now); });
    var live = cs.filter(function (x) { return x.state === 'build' || x.state === 'vote'; }), done = cs.filter(function (x) { return x.state === 'done'; });
    var picked = now >= S.pickAt, pc = cs[SD.pick]; pc.win = { p: pc.list[0].p, v: pc.list[0].votes };
    return { S: S, now: now, cs: cs, live: live, done: done, allDone: done.length === 10, picked: picked, archived: archived, early: now < S.winStart, pick: pc, total: cs.reduce(function (a, x) { return a + x.entries; }, 0) };
  }

  /* ---------------- copy ---------------- */
  function status(W) {
    var pc = W.pick, nm = pc.win.p.name;
    if (W.picked) return D.pickers + ' picked ' + nm + ' from ' + pc.name + '.';
    if (W.allDone) return 'All ten winners are in. The pick is at ' + hhmm(W.S.pickAt) + ' UTC.';
    var next = W.cs.filter(function (x) { return x.state === 'next'; }).sort(function (a, b) { return a.start - b.start; })[0];
    if (!W.live.length && !W.done.length) return next.name + ' starts first, in ' + dur(next.wait) + '.';
    var s = W.live.length === 1 ? W.live[0].name + ' is ' + (W.live[0].state === 'build' ? 'building' : 'voting') + '.' : W.live.length + ' of 10 cities are live.';
    if (!W.live.length) s = '';
    var last = W.done.slice().sort(function (a, b) { return b.end - a.end; })[0];
    if (last) s += (s ? ' ' : '') + last.name + '’s winner is in.';
    else if (next) s += ' ' + next.name + ' starts in ' + dur(next.wait) + '.';
    return s;
  }
  /* the main action: where to go next. Every live or coming city is a link to its page. */
  function action(W, c) {
    if (W.allDone || W.archived) return { t: W.picked ? 'See the winner' : 'See the ten winners', href: '#pick' };
    var you = c.you >= 0 ? W.cs[c.you] : null, x;
    if (you && (you.state === 'next' || you.state === 'build')) return { t: 'Join in ' + you.name, href: cityHref(you, c) };
    if (you && you.state === 'vote') return { t: 'Vote in ' + you.name, href: cityHref(you, c) };
    x = W.cs.filter(function (y) { return y.state === 'vote'; })[0]; if (x) return { t: 'Vote in ' + x.name, href: cityHref(x, c) };
    x = W.cs.filter(function (y) { return y.state === 'build'; })[0]; if (x) return { t: 'Join in ' + x.name, href: cityHref(x, c) };
    x = W.cs.filter(function (y) { return y.state === 'next'; })[0]; return { t: 'Join in ' + x.name, href: cityHref(x, c) };
  }
  function slotText(x, W) {
    if (x.state === 'next') return { k: 'Starts in', a: dur(x.wait, true), b: 'Entries open then' };
    if (x.state === 'build') return { k: 'Building', a: x.n + NB + (x.n === 1 ? 'entry' : 'entries'), b: 'Closes in ' + dur(x.left, true) };
    if (x.state === 'vote') return { k: 'Leading', a: x.lead.p.name, b: plural(x.lead.v, 'vote') + ' · ' + dur(x.left, true) + ' left' };
    var pk = W.picked && W.pick === x;
    return { k: (pk ? 'Picked' : 'Winner') + ' of ' + x.n, a: x.lead.p.name, b: plural(x.lead.v, 'vote') };
  }

  /* ---------------- pictures and seals ---------------- */
  function pic(p, cls) { var u = p && window.projectPicture ? window.projectPicture(p) : ''; return p ? '<img class="' + (cls || 'pic') + '"' + (u ? ' src="' + u + '"' : '') + ' alt="" decoding="async">' : '<i class="' + (cls || 'pic') + ' pic-empty"></i>'; }
  var SEALC = {};
  function seal(kind, key, size) {
    if (!window.SEAL) return '';
    var k = kind + ':' + key + ':' + size; if (SEALC[k] != null) return SEALC[k];
    try { SEALC[k] = kind === 'city' ? window.SEAL.forCity(key, { size: size }) : window.SEAL.merged(key, { size: size, draw: true }); } catch (e) { SEALC[k] = ''; }
    return SEALC[k];
  }

  /* ---------------- links (they carry the preview parameters) ---------------- */
  function cityHref(x, c) { return HOOK.links ? HOOK.links.city(x, c) : 'city.html?city=' + x.id + PREVIEW.query(x, c); }

  /* ---------------- the pieces of a row ---------------- */
  function view(c, W) {
    var S = W.S, span = S.winEnd - S.winStart, now = Math.min(W.now, S.winEnd), v0 = S.winStart, v1 = v0 + span;
    return { v0: v0, v1: v1, x: function (m) { return (m - v0) / (v1 - v0) * 100; }, nx: (now - v0) / (v1 - v0) * 100, span: span };
  }
  function band(city, V, c) {
    var o = '';
    for (var d = -1; d <= 2; d++) {
      var a = d * 1440 + city.rise - city.offset, b = d * 1440 + city.set - city.offset;
      if (b <= V.v0 || a >= V.v1) continue;
      var s = r2(clamp(c.soft / (b - a) * 100, 0, 49));   /* drawn whole; the strip clips it, so the soft edge never moves */
      o += '<i class="day" style="left:' + r2(V.x(a)) + '%;width:' + r2(V.x(b) - V.x(a)) + '%;--s:' + s + '%"></i>';
    }
    return o;
  }
  function you(x, c) { return c.you === x.i && c.green >= 4 ? ' · <b class="you" data-g="1">Yours</b>' : ''; }
  function bar(x, V, W, c) {
    var l = V.x(x.start), w = V.x(x.end) - l, bf = (x.buildEnd - x.start) / (x.end - x.start) * 100, fill = 0;
    if (x.state === 'build') fill = x.f * bf; else if (x.state === 'vote') fill = bf + x.f * (100 - bf); else if (x.state === 'done') fill = 100;
    return '<i class="bar" style="left:' + r2(l) + '%;width:' + r2(w) + '%;--bf:' + r2(bf) + '%;--fill:' + r2(fill) + '%" data-i="' + x.i + '"><i class="bar-b"></i><i class="bar-v"></i><i class="bar-run"></i>' +
      '<span class="bar-t' + (l + w > 72 ? ' r' : '') + '">' + localSpan(x) + ' <span>' + tz(x.city.offset) + you(x, c) + '</span></span></i>';
  }
  function ruler(x, V, c, W) {
    return '<span class="strip" aria-hidden="true">' + band(x.city, V, c) + '<i class="wire" style="left:' + r2(V.x(x.end)) + '%"></i>' + bar(x, V, W, c) + '</span>';
  }
  /* the now line shows only while the clock is inside the strip */
  function showNow(W) { return !W.archived && !W.early; }
  function axis(V, W, cls) {
    var o = '<div class="axis ' + (cls || '') + '" aria-hidden="true">', first = Math.ceil(V.v0 / 180) * 180, live = showNow(W);
    for (var m = first; m <= V.v1; m += 180) {
      var x = V.x(m); if (x < 0 || x > 100) continue;
      var lbl = ((m % 1440) + 1440) % 1440 === 0 ? dayOf(m) : hhmm(m), hide = x < 4 || x > 97 || (live && Math.abs(x - V.nx) < 8);
      o += '<i class="tick" style="left:' + r2(x) + '%">' + (hide ? '' : '<span>' + lbl + '</span>') + '</i>';
    }
    return o + '<span class="axis-utc"' + (live && V.nx < 8 ? ' style="opacity:0"' : '') + '>UTC</span></div>';
  }
  function nowLine(V, W, extra) {
    if (!showNow(W)) return '';
    return '<div class="now ' + (extra || '') + '" aria-hidden="true" data-g="1"><b style="transform:translateX(' + r2(V.nx) + '%)"><i></i><span>' + hhmm(W.now) + '</span></b></div>';
  }
  function slot(x, W, c) {
    var t = slotText(x, W), p = x.state === 'vote' || x.state === 'done' ? x.lead.p : null, pk = W.picked && W.pick === x;
    var g = (x.state === 'vote' && c.green >= 3) || (pk && c.green >= 3);
    return '<div class="slot' + (g ? ' g' : '') + '"><span class="slot-pic">' + pic(p) + (c.peek && p ? pic(p, 'peek') : '') + '</span>' +
      '<span class="slot-k">' + (g ? '<i class="gsq" data-g="1"></i>' : '') + esc(t.k) + '</span><span class="slot-a">' + esc(t.a) + '</span><span class="slot-b">' + esc(t.b) + '</span></div>';
  }
  function localSpan(x) { var o = x.city.offset; return hhmm(x.start + o) + '–' + hhmm(x.end + o); }
  function rowCls(x, W, c, extra) {
    var pk = W.picked && W.pick === x;
    return 'row is-' + x.state + (pk ? ' is-pick' : '') + (c.you === x.i ? ' is-you' : '') + (extra ? ' ' + extra : '');
  }
  function nameHtml(x, c, cls) {
    return '<a class="' + cls + '" href="' + esc(cityHref(x, c)) + '" data-city="' + x.id + '" data-k="n' + x.i + '">' + esc(x.name) +
      '<span class="loc"><span>' + localSpan(x) + '</span><span>' + tz(x.city.offset) + you(x, c) + '</span></span></a>';
  }
  function tie(x, W) { return '<i class="tie" aria-hidden="true"' + (W.picked && W.pick === x ? ' data-g="1"' : '') + '></i>'; }
  function cityMark(x, W, c) { return c.seal && x.state === 'done' ? '<span class="mark" aria-hidden="true">' + seal('city', x.id, 24) + '</span>' : ''; }
  function join(W, c, cls) {
    var pc = W.pick, lbl = W.picked ? 'Picked: ' + pc.win.p.name + ', ' + pc.name : D.pickers + ' pick one at ' + hhmm(W.S.pickAt) + ' UTC';
    return '<div class="join ' + (cls || '') + (W.picked ? ' is-picked' : '') + (W.allDone ? ' is-full' : '') + '"><span class="join-lbl">' + esc(lbl) + '</span><i class="join-o"' + (W.picked ? ' data-g="1"' : '') + '>' +
      (W.picked && c.seal ? seal('merged', W.cs.map(function (x) { return x.id; }), 40) : '') + '</i></div>';
  }
  /* phone: time runs down, so now sits on the boundary between the cities that have started and those that have not */
  function pnow(W) {
    if (!showNow(W)) return '';
    var ny = W.cs.filter(function (x) { return x.start <= W.now; }).length;
    return '<i class="pnow" style="--ny:' + ny + '" aria-hidden="true" data-g="1"><span>Now ' + hhmm(W.now) + ' UTC</span></i>';
  }
  function trunk(W) {
    return '<i class="trunk" aria-hidden="true"></i>' + (W.picked ? '<i class="trunk-g" data-g="1" aria-hidden="true" style="--pi:' + W.pick.i + '"></i>' : '');
  }
  var MARK = '<svg viewBox="0 0 109 113" aria-hidden="true"><path class="lo" d="M63.708 110.284C60.8455 113.885 55.0414 111.912 54.9725 107.314L53.964 40.0627H99.2193C107.413 40.0627 111.983 49.5228 106.888 55.9374L63.708 110.284Z"/><path d="M45.317 2.07103C48.1765 -1.53037 53.9809 0.442937 54.0498 5.04075L54.4916 72.2922H9.80319C1.60924 72.2922 -2.96112 62.8321 2.13456 56.4175L45.317 2.07103Z"/></svg>';
  function masthead(W, c, cls) {
    var act = action(W, c), g = c.green >= 2;
    return '<header class="mh ' + (cls || '') + '">' +
      '<a class="mh-mark" href="#top" aria-label="Supabase Hackathon, top of the page">' + MARK + '<span>supabase <b>hackathon</b></span></a>' +
      '<p class="mh-date"><span>' + esc(D.date) + '</span><span class="mh-sub">Ten cities, one day</span></p>' +
      '<p class="mh-status">' + esc(status(W)) + '</p>' +
      '<a class="mh-act' + (g ? ' g' : '') + '" href="' + esc(act.href) + '"' + (g ? ' data-g="1"' : '') + '>' + esc(act.t) + '</a></header>';
  }

  /* ---------------- the timetable ---------------- */
  function timetable(W, c) {
    var V = P.view(c, W), rows = W.cs.map(function (x) {
      return '<li class="' + rowCls(x, W, c, 'tt-row') + '" data-k="r' + x.i + '" style="--i:' + x.i + '">' + nameHtml(x, c, 'name') + ruler(x, V, c, W) + slot(x, W, c) + tie(x, W) + cityMark(x, W, c) + '</li>';
    }).join('');
    return masthead(W, c, 'mh-band') + '<section class="tt" aria-label="The ten cities, east to west">' + axis(V, W, 'tt-axis') +
      '<ol class="rows">' + rows + '</ol>' + pnow(W) + nowLine(V, W, 'tt-now') + trunk(W) + join(W, c) + '</section>';
  }

  /* ---------------- below the timetable ---------------- */
  function below(W, c) {
    var pc = W.pick, p = pc.win.p, S = W.S, o = [];
    o.push('<section class="pk' + (W.picked ? ' is-picked' : '') + '" id="pick" aria-labelledby="pk-h"><i class="pk-line" aria-hidden="true"></i>' +
      '<div class="pk-pic">' + (W.picked ? pic(p) : '<i class="pic pic-empty"></i>') + '</div>' +
      '<div class="pk-tx"><h2 class="lbl" id="pk-h">The pick</h2>' +
      (W.picked ? '<p class="pk-name">' + esc(p.name) + '</p><p class="pk-who">' + esc(pc.name) + '’s winner, @' + esc(p.handle) + '. ' + plural(pc.win.v, 'vote') + ' of ' + pc.entries + NB + 'entries.</p><p class="pk-pitch">' + esc(p.pitch) + '</p>'
        : '<p class="pk-name pk-wait">' + (W.allDone ? 'Ten winners. One pick.' : W.done.length + ' of 10 winners in') + '</p><p class="pk-who">' + esc(D.pickers) + ' pick one of the ten city winners at ' + hhmm(S.pickAt) + ' UTC.</p><p class="pk-pitch">The pick is announced here.</p>') +
      '</div><div class="pk-seal" aria-hidden="true">' + (W.picked && c.seal ? seal('merged', W.cs.map(function (x) { return x.id; }), 160) : '') + '</div></section>');
    o.push('<section class="how" aria-labelledby="how-h"><h2 class="lbl" id="how-h">How it works</h2><ol>' +
      '<li><span class="how-k">Build</span><span>Each city builds for ' + dur(c.buildMin) + ', starting ' + hhmm(c.startHour * 60) + ' local' + (c.schedule === 'same' ? ' UTC' : '') + '.</span></li>' +
      '<li><span class="how-k">Vote</span><span>Then the city votes for ' + dur(c.voteMin) + '. The project with the most votes wins its city.</span></li>' +
      '<li><span class="how-k">Pick</span><span>' + esc(D.pickers) + ' pick one of the ten city winners.</span></li></ol></section>');
    var faq = (window.HACK && window.HACK.faq) || [];
    if (faq.length) o.push('<section class="qa" aria-labelledby="qa-h"><h2 class="lbl" id="qa-h">Questions</h2><dl>' +
      faq.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl></section>');
    var rows = D.past().map(function (e) { return '<li><span class="ps-d">' + esc(e.date) + '</span><span class="ps-n">' + esc(e.name) + '</span><span class="ps-f">' + esc(e.format) + '</span><span class="ps-e">' + (e.submissions ? e.submissions + NB + 'entries' : 'Not listed') + '</span><span class="ps-w"></span><span class="ps-pic"></span></li>'; });
    if (W.archived) rows.unshift('<li class="ps-fold"><span class="ps-d">' + esc(D.date) + '</span><span class="ps-n">' + esc(D.name) + '</span><span class="ps-f">Ten cities, one day</span><span class="ps-e">' + W.total.toLocaleString('en-US') + NB + 'entries</span><span class="ps-w">' + esc(p.name) + ', ' + esc(pc.name) + '</span><span class="ps-pic">' + pic(p) + '</span></li>');
    o.push('<section class="past" aria-labelledby="past-h"><h2 class="lbl" id="past-h">Past hackathons</h2><ol>' + rows.join('') + '</ol></section>');
    o.push('<footer class="ft"><span>' + esc(D.name) + '</span><span>Times are UTC on the strip and local in each row.</span></footer>');
    return o.join('');
  }

  /* ---------------- render ---------------- */
  var root = null, page = null, last = null, anim = {}, prevW = null;
  function applyGround(c, W) {
    var g = HOOK.ground ? HOOK.ground(c, W) : c.ground;
    if (window.dayPalette) window.dayPalette(g);
    return g;
  }
  function render(c) {
    c = clampCfg(Object.assign({}, DEF, c));
    var W = world(c), fn = MODES[c.mode] || timetable;
    applyGround(c, W);
    var fact = Math.round(c.display / (c.ratio * c.ratio) / 4) * 4;
    root.dataset.mode = c.mode;
    var st = page.style;
    st.setProperty('--disp', c.display); st.setProperty('--row', c.row); st.setProperty('--fact', fact); st.setProperty('--fact2', Math.max(16, Math.round(fact / c.ratio / 2) * 2));
    st.setProperty('--sc', c.slope); st.setProperty('--shot', c.shot); st.setProperty('--hair', c.hair + 'px'); st.setProperty('--speed', c.speed); st.setProperty('--bandk', c.band / 100);
    var html = fn(W, c) + below(W, c);
    /* motion bookkeeping: what changed since the last render, going forward in time */
    var tnow = performance.now(), fwd = prevW && W.now > prevW.now && prevW.cs;
    if (fwd) W.cs.forEach(function (x, i) {
      var a = prevW.cs[i].state; if (a === x.state) return;
      anim['s' + i] = tnow;
      if (x.state === 'done') anim['l' + i] = tnow;
    });
    if (fwd && W.picked && !prevW.picked) anim.pick = tnow;
    prevW = W;
    var tpl = document.createElement('template'); tpl.innerHTML = html;
    var spd = 1 / c.speed, DUR = { s: 280 * spd, l: 480 * spd, pick: 2400 * spd };   /* --dur-panel, --dur-draw, --dur-reveal */
    Object.keys(anim).forEach(function (k) {
      var kind = k === 'pick' ? 'pick' : k[0], el = kind === 'pick' ? null : tpl.content.querySelector('[data-k="r' + k.slice(1) + '"]'), age = tnow - anim[k];
      if (age > DUR[kind]) { delete anim[k]; return; }
      if (kind === 'pick') return;
      if (el) { el.classList.add(kind === 's' ? 'swap' : 'land'); el.style.setProperty('--age', '-' + Math.round(age) + 'ms'); }
    });
    page.classList.toggle('reveal', !!anim.pick); if (anim.pick) page.style.setProperty('--rage', '-' + Math.round(tnow - anim.pick) + 'ms');
    if (!last || last.mode !== c.mode) { page.textContent = ''; page.appendChild(tpl.content); }
    else morph(page, tpl.content);
    last = c;
    return W;
  }
  /* a small keyed morph: keeps elements (and their images and running animations) when only text or attributes change */
  function morph(a, b) {
    var ac = a.childNodes, bc = Array.prototype.slice.call(b.childNodes), i;
    for (i = 0; i < bc.length; i++) { if (i < ac.length) same(ac[i], bc[i]); else a.appendChild(bc[i]); }
    while (ac.length > bc.length) a.removeChild(a.lastChild);
  }
  function same(x, y) {
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName || (x.nodeType === 1 && x.getAttribute('data-k') !== y.getAttribute('data-k'))) { x.parentNode.replaceChild(y, x); return; }
    if (x.nodeType !== 1) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; return; }
    var i, at;
    for (i = x.attributes.length - 1; i >= 0; i--) { at = x.attributes[i].name; if (!y.hasAttribute(at)) x.removeAttribute(at); }
    for (i = 0; i < y.attributes.length; i++) { at = y.attributes[i]; if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value); }
    if (x.namespaceURI === 'http://www.w3.org/2000/svg') { if (x.innerHTML !== y.innerHTML) x.innerHTML = y.innerHTML; return; }
    morph(x, y);
  }

  /* ---------------- the clock and the preview parameters ---------------- */
  var q = new URLSearchParams(location.search);
  var EPOCH = Date.UTC(D.year, D.month - 1, D.day);   /* minute 0: Dec 11, 00:00 UTC */
  var CLOCK = { offset: 0, still: q.get('still') === '1', at: null, preview: false };
  function realMinute() { return (Date.now() - EPOCH) / 60000; }
  function clockNow() { return CLOCK.still ? CLOCK.at : realMinute() + CLOCK.offset; }
  /* ?moment= or ?t= moves the clock to that moment; it keeps running from there unless ?still=1 */
  function setClock(c) {
    var S = sched(c), at = null, mm = q.get('moment'), t = q.get('t');
    if (mm) { var m = moments(c).filter(function (x) { return x[0] === mm; })[0]; if (m) at = M.nowOf(m[2], S); }
    if (at == null && t != null && t !== '' && isFinite(+t)) at = M.nowOf(+t, S);
    CLOCK.preview = at != null;
    if (at == null) at = realMinute();
    CLOCK.offset = at - realMinute(); CLOCK.at = at;
  }
  /* what a link to the other pages carries: the moment (as that page's t), the seed and the ground, if this page was given them */
  var PREVIEW = {
    query: function (x, c) {
      var u = '';
      if (CLOCK.preview || CLOCK.still) { var w0 = x.start - 60, w1 = sched(c).pickAt + 30; u += '&t=' + ((clockNow() - w0) / (w1 - w0)).toFixed(5); }
      if (CLOCK.still) u += '&still=1';
      if (q.get('seed')) u += '&seed=' + encodeURIComponent(q.get('seed'));
      if (q.get('ground')) u += '&ground=' + encodeURIComponent(q.get('ground'));
      return u;
    }
  };

  /* ---------------- boot ---------------- */
  var cfg = Object.assign({}, DEF);
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  function go() {
    clampCfg(cfg);
    if (!HOOK.start) cfg.now = clockNow();
    var W = render(cfg);
    HOOK.after.forEach(function (f) { f(W, cfg); });
    return W;
  }
  /* the arrival, once per session: the pen draws the strip, then the bars land east to west */
  var vtIn = false;
  function arrive(force) {
    var seen = false; try { seen = !!sessionStorage.getItem('day-intro'); } catch (e) { /* storage blocked */ }
    if ((seen && !force) || REDUCED.matches || cfg.reduced || CLOCK.still || (vtIn && !force)) return;
    page.classList.remove('arrive'); void page.offsetWidth; page.classList.add('arrive');
    try { sessionStorage.setItem('day-intro', '1'); } catch (e) { /* storage blocked */ }
    setTimeout(function () { page.classList.remove('arrive'); }, 1400 / cfg.speed);
  }
  /* the person's own city, once they have entered (shared/forms.js); without it, no row is marked as theirs */
  function yourCity() {
    var F = window.FORMS, e = F && F.state && F.state.entry, id = e && (e.city || e.cityId);
    var hit = id && D.cities.filter(function (x) { return x.id === id; })[0];
    return hit ? hit.i : -1;
  }
  function load(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); }
  function configure(c) {
    /* the saved config is the look; the clock, your city and the preview parameters are the page's own */
    ['seed', 'ground'].forEach(function (k) { if (q.get(k) != null) c[k] = q.get(k); });
    c.mode = 'timetable'; c.you = yourCity();
    clampCfg(c); setClock(c);
  }
  function startClock() {
    var lastMin = null;
    setInterval(function () { var m = Math.floor(clockNow()); if (m !== lastMin && !document.hidden) { lastMin = m; go(); } }, 1000);
    if (window.FORMS && typeof window.FORMS.on === 'function') window.FORMS.on('change', function () { cfg.you = yourCity(); go(); });
  }
  function boot() {
    root = document.getElementById('day'); page = root.querySelector('.dl-page');
    if (last) prevW = null;   /* drawn early for a view transition: the next render is a plain update */
    var seals = window.SEAL ? window.SEAL.load(HOOK.base + 'saved/seal.config.json') : Promise.resolve();
    /* the first paint waits for Geist (at most 800 ms), so names and the status line do not reflow when it lands */
    var fonts = document.fonts ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 800); })]) : null;
    Promise.all([load(HOOK.base + 'saved/day.config.json'), seals, fonts]).then(function (s) {
      cfg = Object.assign({}, DEF, s[0]);
      SEALC = {};
      if (HOOK.configure) HOOK.configure(cfg, q); else configure(cfg);
      go(); arrive(false);
      if (HOOK.start) HOOK.start(); else startClock();
      document.documentElement.dataset.ready = '1';
    });
  }

  /* home to city and back: the clicked city's name and bar are the shared elements (cross-document view transition,
     an enhancement; plain navigation works without it). The city page names its title and session bar the same. */
  var CITY_URL = /city(?:-lab)?\.html\?(?:.*&)?city=([a-z-]+)/;
  function nameRow(id) {
    var r = page && page.querySelector('[data-city="' + id + '"]'); if (!r) return null;
    var li = r.closest('li'), b = li && li.querySelector('.bar');
    r.style.viewTransitionName = 'city-name'; if (b) b.style.viewTransitionName = 'city-bar';
    return function () { r.style.viewTransitionName = ''; if (b) b.style.viewTransitionName = ''; };
  }
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return; e.viewTransition.ready.catch(function () { /* skipped or aborted */ });
    var to = e.activation && e.activation.entry && e.activation.entry.url, m = to && CITY_URL.exec(to);
    if (!m) return;
    var undo = nameRow(m[1]); if (undo) e.viewTransition.finished.then(undo, undo);
  });
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return; e.viewTransition.ready.catch(function () { /* skipped or aborted */ });
    var from = (window.navigation && navigation.activation && navigation.activation.from && navigation.activation.from.url) || '', m = CITY_URL.exec(from);
    var id = (m && m[1]) || q.get('from');
    if (!id) return;
    vtIn = true; try { e.viewTransition.types.add('back'); } catch (err) { /* types not supported */ }
    if (!last) early();
    var undo = nameRow(id); if (undo) e.viewTransition.finished.then(undo, undo); else e.viewTransition.skipTransition();
  });
  /* the first frame on the way back from a city: drawn from the URL straight away, before the saved config loads, so
     the transition has a row to land on */
  function early() {
    root = document.getElementById('day'); page = root && root.querySelector('.dl-page'); if (!page) return;
    var c = Object.assign({}, DEF);
    if (HOOK.configure) HOOK.configure(c, q); else configure(c);
    cfg = c; go();
  }

  /* the parts a layout is drawn from. The timetable reads view() through here, so the lab can swap it. */
  var P = {
    view: view, ruler: ruler, axis: axis, nowLine: nowLine, nameHtml: nameHtml, slot: slot, slotText: slotText, tie: tie, cityMark: cityMark,
    trunk: trunk, join: join, pnow: pnow, masthead: masthead, rowCls: rowCls, pic: pic, seal: seal, localSpan: localSpan, you: you, cityHref: cityHref,
    esc: esc, r2: r2, clamp: clamp, dur: dur, plural: plural, hhmm: hhmm, tz: tz, NB: NB
  };
  window.HOME = {
    DEF: DEF, BOUNDS: BOUNDS, CHOICES: CHOICES, MODES: MODES, parts: P, TA: TA,
    clampCfg: clampCfg, render: render, go: go, arrive: arrive, sched: sched, moments: function (c) { return moments(clampCfg(Object.assign({}, DEF, c))); },
    get cfg() { return cfg; }, set cfg(c) { cfg = c; },
    reset: function () { prevW = null; },
    get page() { return page; },
    /* hooks: { base, defaults, bounds, choices, modes, links, configure(cfg, q), start(), after(W, cfg), ground(cfg, W) } */
    extend: function (h) {
      if (h.defaults) Object.assign(DEF, h.defaults);
      if (h.bounds) Object.assign(BOUNDS, h.bounds);
      if (h.choices) Object.keys(h.choices).forEach(function (k) { CHOICES[k] = h.choices[k]; });
      if (h.modes) Object.keys(h.modes).forEach(function (k) { MODES[k] = h.modes[k]; if (CHOICES.mode.indexOf(k) < 0) CHOICES.mode.push(k); });
      ['base', 'links', 'configure', 'start', 'ground'].forEach(function (k) { if (h[k] != null) HOOK[k] = h[k]; });
      if (h.after) HOOK.after.push(h.after);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
