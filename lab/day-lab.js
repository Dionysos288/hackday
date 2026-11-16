/* day-lab.js: the tuning page for the home (lab/day-lab.html). It extends shared/day.js through HOME.extend: three
   more layouts (Index, Wall, Dial), the knob panel, the layout picker and Save. Nothing in production loads it.

   The lab's clock is the config's t (0 to 1 across the day; 0.94 and up is the day after), not the real clock.
   Save writes the whole config to saved/day.config.json through the dev server (node tools/serve.mjs).

   Keys: 1-4 layouts, left/right arrows move time 15 min (shift: 1 h), N new seed, R replay arrival, P play the day,
   G grid, S save, \ panel. Click empty ground for a new seed. */
(function () {
  'use strict';
  var E = window.HOME, P = E.parts, D = window.DAY, M = D.calc, TA = E.TA;
  var esc = P.esc, r2 = P.r2, clamp = P.clamp, hhmm = P.hhmm, tz = P.tz;
  var MODES = ['timetable', 'index', 'wall', 'dial'];
  var MODE_NAMES = { timetable: 'Timetable', index: 'Index', wall: 'Wall', dial: 'Dial' };
  var q = new URLSearchParams(location.search);

  /* ---------------- knobs the production page does not have ---------------- */
  var LAB_DEF = { moves: 'line', bar: 'solid', join: 'bracket', grid: 0, vp: 'fit', you: 4 };

  /* "What moves: day" keeps now fixed and slides the day under it */
  var baseView = P.view;
  P.view = function (c, W) {
    if (c.moves !== 'day') return baseView(c, W);
    var S = W.S, span = S.winEnd - S.winStart, now = Math.min(W.now, S.winEnd), v0 = now - span * 0.35, v1 = v0 + span;
    return { v0: v0, v1: v1, x: function (m) { return (m - v0) / (v1 - v0) * 100; }, nx: (now - v0) / (v1 - v0) * 100, span: span };
  };

  /* ---------------- the other three layouts ---------------- */
  function index(W, c, compact) {
    var V = P.view(c, W), rows = W.cs.map(function (x) {
      return '<li class="' + P.rowCls(x, W, c, 'ix-row') + '" data-k="r' + x.i + '" style="--i:' + x.i + '">' + P.nameHtml(x, c, 'name') +
        '<span class="ix-ruler">' + P.ruler(x, V, c, W) + '<i class="ix-now" style="left:' + r2(V.nx) + '%"' + (W.archived ? ' hidden' : ' data-g="1"') + '></i></span>' + P.slot(x, W, c) + P.tie(x, W) + P.cityMark(x, W, c) + '</li>';
    }).join('');
    return (compact ? '' : P.masthead(W, c, 'mh-poster')) + '<section class="ix' + (compact ? ' ix-compact' : '') + '" aria-label="The ten cities, east to west">' + P.axis(V, W, 'ix-axis') +
      '<ol class="rows">' + rows + '</ol>' + P.pnow(W) + P.trunk(W) + P.join(W, c) + '</section>';
  }
  function wall(W, c) {
    var V = P.view(c, W), panels = W.cs.map(function (x) {
      var loc = (W.now + x.city.offset), lm = ((loc % 1440) + 1440) % 1440, rise = x.city.rise, set = x.city.set, s = Math.max(1, c.soft / 2);
      var f = W.archived ? 0 : clamp((lm - (rise - s)) / (2 * s), 0, 1) * clamp(((set + s) - lm) / (2 * s), 0, 1), t = P.slotText(x, W);
      var p = x.state === 'vote' || x.state === 'done' ? x.lead.p : null, pk = W.picked && W.pick === x, g = (x.state === 'vote' || pk) && c.green >= 3;
      return '<li class="' + P.rowCls(x, W, c, 'wl-p') + '" data-k="r' + x.i + '" style="--i:' + x.i + ';--dayf:' + r2(f * c.band) + '%">' +
        '<a class="name" href="' + esc(P.cityHref(x, c)) + '" data-city="' + x.id + '">' + esc(x.name) + '</a>' +
        '<p class="wl-meta"><span>' + (W.archived ? P.localSpan(x) : hhmm(loc) + ' local') + '</span><span>' + tz(x.city.offset) + P.you(x, c) + '</span></p>' +
        '<span class="wl-pic">' + P.pic(p) + '</span>' +
        '<p class="wl-tx' + (g ? ' g' : '') + '"><span class="slot-k">' + (g ? '<i class="gsq" data-g="1"></i>' : '') + esc(t.k) + '</span><span class="slot-a">' + esc(t.a) + '</span><span class="slot-b">' + esc(t.b) + '</span></p>' +
        '<span class="wl-ruler">' + P.ruler(x, V, c, W) + '<i class="ix-now" style="left:' + r2(V.nx) + '%"' + (W.archived ? ' hidden' : ' data-g="1"') + '></i></span>' + P.cityMark(x, W, c) + '</li>';
    }).join('');
    var draw = W.cs.map(function (x) {
      return '<li class="' + P.rowCls(x, W, c, 'dr-s') + '" data-k="d' + x.i + '"><span class="dr-c">' + esc(x.name) + '</span><span class="dr-n">' + (x.state === 'done' ? esc(x.lead.p.name) : '') + '</span><i class="dr-t" aria-hidden="true"></i></li>';
    }).join('');
    return P.masthead(W, c, 'mh-band') + '<section class="wl" aria-label="The ten cities, east to west"><ol class="wl-grid">' + panels + '</ol>' +
      '<div class="dr' + (W.allDone ? ' is-full' : '') + (W.picked ? ' is-picked' : '') + '" style="--pi:' + W.pick.i + '"><ol>' + draw + '</ol><i class="dr-bus" aria-hidden="true"></i>' + (W.picked ? '<i class="dr-bus-g" data-g="1" aria-hidden="true"></i>' : '') + P.join(W, c, 'dr-join') + '</div></section>';
  }
  function code(id) { return { sydney: 'SYD', tokyo: 'TYO', singapore: 'SIN', bengaluru: 'BLR', berlin: 'BER', lagos: 'LOS', london: 'LON', 'sao-paulo': 'SAO', 'new-york': 'NYC', 'san-francisco': 'SFO' }[id]; }
  function dial(W, c) {
    var S = W.S, A = function (m) { return (m / 1440) * 360 - 90; };
    var Pt = function (r, m) { var a = A(m) * Math.PI / 180; return [r2(Math.cos(a) * r), r2(Math.sin(a) * r)]; };
    var arc = function (r, m0, m1) { var a = Pt(r, m0), b = Pt(r, m1), large = (m1 - m0) % 1440 > 720 ? 1 : 0; return 'M' + a[0] + ' ' + a[1] + 'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + b[0] + ' ' + b[1]; };
    var R0 = 112, DR = 15, RO = R0 + 9 * DR + 16, o = [];
    o.push('<circle class="d-ring" r="' + RO + '"/><circle class="d-ring" r="' + (R0 - 14) + '"/>');
    for (var h = 0; h < 24; h++) { var a = Pt(RO, h * 60), b = Pt(RO + (h % 3 ? 5 : 10), h * 60); o.push('<line class="d-tick" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>'); if (h % 6 === 0) { var l = Pt(RO + 24, h * 60); o.push('<text class="d-lbl" x="' + l[0] + '" y="' + l[1] + '">' + hhmm(h * 60) + (h ? '' : ' UTC') + '</text>'); } }
    W.cs.forEach(function (x) {
      var r = R0 + x.i * DR, city = x.city, pk = W.picked && W.pick === x;
      o.push('<circle class="d-track" r="' + r + '"/>');
      if (c.band) for (var d = -1; d <= 1; d++) { var s0 = d * 1440 + city.rise - city.offset, s1 = d * 1440 + city.set - city.offset; if (s1 < S.winStart - 1440 || s0 > S.winEnd) continue; o.push('<path class="d-day" style="opacity:' + r2(c.band / 100) + '" d="' + arc(r, s0, s1) + '"/>'); }
      var fill = x.state === 'build' ? x.start + x.f * (x.buildEnd - x.start) : x.state === 'vote' ? x.buildEnd + x.f * (x.end - x.buildEnd) : x.state === 'done' ? x.end : x.start;
      o.push('<path class="d-bar d-next" d="' + arc(r, x.start, x.end) + '"/>');
      if (x.state === 'done') o.push('<path class="d-bar d-done" d="' + arc(r, x.start, x.end) + '"/>');
      else if (fill > x.start) o.push('<path class="d-bar d-run" d="' + arc(r, x.start, fill) + '"/>');
      var e0 = Pt(r, x.end), e1 = Pt(28, x.end), twin = x.i > 0 && W.cs[x.i - 1].start === x.start, lb = Pt(r, twin ? x.end + 16 : x.start - 16);
      o.push('<line class="d-spoke' + (x.state === 'done' ? ' on' : '') + (pk ? ' pk' : '') + '"' + (pk ? ' data-g="1"' : '') + ' x1="' + e0[0] + '" y1="' + e0[1] + '" x2="' + e1[0] + '" y2="' + e1[1] + '"/>');
      o.push('<text class="d-code' + (x.state === 'build' || x.state === 'vote' ? ' live' : '') + '" x="' + lb[0] + '" y="' + lb[1] + '">' + code(x.id) + '</text>');
    });
    o.push('<circle class="d-join' + (W.picked ? ' on' : '') + '" r="26"' + (W.picked ? ' data-g="1"' : '') + '/>');
    var nowDeg = r2((Math.min(W.now, S.winEnd) / 1440) * 360);
    var hand = W.archived ? '' : '<g class="d-hand" style="transform:rotate(' + nowDeg + 'deg)" data-g="1"><line x1="0" y1="-30" x2="0" y2="-' + (RO + 12) + '"/></g>';
    var sl = W.picked && c.seal && window.SEAL ? '<foreignObject x="-24" y="-24" width="48" height="48"><div class="d-seal">' + P.seal('merged', W.cs.map(function (x) { return x.id; }), 48) + '</div></foreignObject>' : '';
    var NS = '<svg class="dial-svg" viewBox="-320 -320 640 640" role="img" aria-label="The day as a 24-hour ring. Each city is one track; the green hand is now.">' + o.join('') + hand + sl + '</svg>';
    return '<section class="dl-hero" aria-label="The day as a dial">' + P.masthead(W, c, 'mh-dial') + '<div class="dial">' + NS + '</div></section>' + index(W, c, true);
  }

  /* ---------------- links: lab pages link to lab pages ---------------- */
  var links = {
    city: function (x, c) {
      var g = document.documentElement.dataset.ground || 'night', S = E.sched(c), u = 'city-lab.html?city=' + x.id + '&ht=' + (c.now != null ? M.tOf(c.now, S) : +c.t).toFixed(4);
      if (c.seed !== E.DEF.seed) u += '&seed=' + c.seed;
      if (g !== 'night') u += '&ground=' + g;
      if (q.get('panel') === '0') u += '&panel=0';
      return u;
    }
  };

  /* ---------------- ground "local": paper while it is day in your city ---------------- */
  function ground(c, W) {
    if (c.ground !== 'local') return c.ground;
    var you = W.cs[c.you >= 0 ? c.you : 6], lm = (((W.now + you.city.offset) % 1440) + 1440) % 1440;
    return lm >= you.city.rise && lm < you.city.set ? 'paper' : 'night';
  }

  /* ---------------- green budget meter ---------------- */
  function greenShare() {
    var page = E.page, vw = window.innerWidth, vh = window.innerHeight, sum = 0;
    page.querySelectorAll('[data-g]').forEach(function (e) {
      var r = e.getBoundingClientRect(), w = Math.max(0, Math.min(vw, r.right) - Math.max(0, r.left)), h = Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top));
      var k = e.classList.contains('now') ? 2 / Math.max(1, r.width) : 1;   /* the now line is a 2px stroke inside a strip-wide box */
      if (e.tagName === 'circle' || e.tagName === 'line' || e.tagName === 'g') k = e.tagName === 'circle' ? 0.12 : 2 / Math.max(1, Math.max(r.width, r.height)) * 1.4;
      sum += w * h * k;
    });
    return sum / (vw * vh) * 100;
  }

  /* ---------------- the panel ---------------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var cfg = function () { return E.cfg; };
  function go() { return E.go(); }
  var panel = null, ctl = {}, meter = null, momentBtns = [];
  function after(W, c) {
    var frame = document.getElementById('day');
    frame.dataset.vp = c.vp; frame.dataset.join = c.join; frame.dataset.bar = c.bar;
    frame.classList.toggle('grid-on', !!c.grid); frame.classList.toggle('rm', !!c.reduced); frame.classList.toggle('no-peek', !c.peek);
    if (!panel) return;
    Object.keys(ctl).forEach(function (k) { var x = ctl[k]; if (x.input.type === 'checkbox') x.input.checked = !!c[k]; else if (document.activeElement !== x.input || k === 't') x.input.value = c[k]; if (x.out) x.out.textContent = k === 't' ? (W.archived ? 'after' : hhmm(W.now)) : k === 'you' ? (c.you < 0 ? 'none' : D.cities[c.you].name) : c[k]; });
    var ms = E.moments(c), cur = 0; ms.forEach(function (m, i) { if (c.t >= m[2] - 0.0006) cur = i; });
    momentBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === cur)); });
    requestAnimationFrame(function () { if (meter) { var g = greenShare(); meter.textContent = 'Green: ' + g.toFixed(1) + '% of the viewport' + (g >= 5 ? ' (over budget)' : ''); meter.classList.toggle('bad', g >= 5); } });
    pickerSync();
    var u = new URL(location.href); u.searchParams.set('mode', c.mode); u.searchParams.set('t', (+c.t).toFixed(3)); history.replaceState(null, '', u);
  }
  var BOUNDS = E.BOUNDS, CHOICES = E.CHOICES;
  var LABELS = { seed: 'Seed', t: 'Time', startHour: 'Start (local)', buildMin: 'Build, min', voteMin: 'Vote, min', pickAfter: 'Pick after, min', display: 'Display size', ratio: 'Type ratio', row: 'Row height', slope: 'Cascade slope', hair: 'Hairline', band: 'Daylight band', soft: 'Band softness', green: 'Green budget', shot: 'Screenshot', you: 'Your city', speed: 'Motion speed' };
  var TOGGLES = { peek: 'Hover peek', seal: 'Seal', reduced: 'Reduced motion', grid: 'Grid overlay' };
  var SELECTS = { ground: 'Ground', moves: 'What moves', schedule: 'Schedule', bar: 'Running bar', join: 'Join', vp: 'Viewport' };
  function lab() {
    panel = el('aside', 'lab'); panel.setAttribute('aria-label', 'Day lab');
    var head = el('div', 'lab-h'); head.append(el('h2', null, 'Day lab'), el('span', 'lab-seed'));
    panel.appendChild(head);
    var mrow = el('div', 'lab-moments'); E.moments(cfg()).forEach(function (m, i) { var b = el('button', null, m[1]); b.type = 'button'; b.addEventListener('click', function () { cfg().t = E.moments(cfg())[i][2]; go(); }); momentBtns.push(b); mrow.appendChild(b); });
    panel.appendChild(mrow);
    function range(k) {
      var lb = el('label'), inp = document.createElement('input'), out = el('output'); inp.type = 'range'; inp.min = BOUNDS[k][0]; inp.max = BOUNDS[k][1]; inp.step = BOUNDS[k][2];
      inp.addEventListener('input', function () { cfg()[k] = +inp.value; go(); }); lb.append(el('span', null, LABELS[k]), inp, out); ctl[k] = { input: inp, out: out }; return lb;
    }
    function select(k) {
      var lb = el('label', 'sel'), s = document.createElement('select'); CHOICES[k].forEach(function (v) { var o = el('option', null, k === 'vp' && v !== 'fit' ? v + ' px' : v); o.value = v; s.appendChild(o); });
      s.addEventListener('change', function () { cfg()[k] = s.value; go(); }); lb.append(el('span', null, SELECTS[k]), s); ctl[k] = { input: s }; return lb;
    }
    function toggle(k) { var lb = el('label', 'tog'), i = document.createElement('input'); i.type = 'checkbox'; i.addEventListener('change', function () { cfg()[k] = i.checked ? 1 : 0; go(); }); lb.append(i, el('span', null, TOGGLES[k])); ctl[k] = { input: i }; return lb; }
    function group(name, nodes) { var f = el('fieldset'); f.appendChild(el('legend', null, name)); nodes.forEach(function (n) { f.appendChild(n); }); panel.appendChild(f); }
    group('Time', [range('t'), select('moves'), select('schedule'), range('startHour'), range('buildMin'), range('voteMin'), range('pickAfter')]);
    group('Type and grid', [range('display'), range('ratio'), range('row'), range('slope'), range('hair'), select('vp'), toggle('grid')]);
    group('Tone', [select('ground'), range('band'), range('soft'), range('green'), range('you')]);
    group('Pieces', [range('shot'), select('bar'), select('join'), toggle('peek'), toggle('seal')]);
    group('Motion', [range('speed'), toggle('reduced')]);
    var btns = el('div', 'lab-btns'), b1 = el('button', null, 'New seed'), b2 = el('button', null, 'Play the day'), b3 = el('button', null, 'Replay arrival'), b4 = el('button', null, 'Replay pick'), sv = el('button', 'pri', 'Save');
    [b1, b2, b3, b4, sv].forEach(function (b) { b.type = 'button'; btns.appendChild(b); });
    meter = el('p', 'lab-meter'); var msg = el('p', 'lab-msg'), rail = el('div', 'lab-rail');
    panel.append(btns, meter, msg, rail);
    b1.addEventListener('click', newSeed); b2.addEventListener('click', play); b3.addEventListener('click', replayArrival); b4.addEventListener('click', replayPick); sv.addEventListener('click', save);
    function snap() { try { return JSON.parse(localStorage.getItem('day-saved') || '[]'); } catch (e) { return []; } }
    function railDraw() { rail.textContent = ''; snap().forEach(function (s) { var b = el('button', null, (MODE_NAMES[s.mode] || s.mode) + ' #' + s.seed); b.type = 'button'; b.title = 'Apply this saved config'; b.addEventListener('click', function () { E.cfg = E.clampCfg(Object.assign({}, E.DEF, s)); go(); }); rail.appendChild(b); }); }
    function save() {
      var c = E.clampCfg(cfg()), out = Object.assign({}, c); delete out.now;
      var json = JSON.stringify(out, null, 2) + '\n';
      try { navigator.clipboard.writeText(json).catch(function () {}); } catch (e) { /* no clipboard */ }
      try { var l = snap().filter(function (s) { return JSON.stringify(s) !== JSON.stringify(out); }); l.unshift(out); localStorage.setItem('day-saved', JSON.stringify(l.slice(0, 10))); } catch (e) { /* storage blocked */ }
      railDraw();
      return fetch('/__save?name=day', { method: 'POST', body: json }).then(function (r) { return r.json(); }).then(function (j) { msg.textContent = 'Saved to ' + j.path + ' and copied.'; return j; }).catch(function () { msg.textContent = 'Copied. There is no dev server here to write the file.'; });
    }
    window.__daySave = save;
    railDraw();
    var tg = el('button', 'lab-toggle', 'Lab'); tg.type = 'button'; tg.setAttribute('aria-expanded', 'true'); tg.addEventListener('click', togglePanel);
    document.body.append(panel, tg);
    picker();
  }
  function togglePanel() { var open = !document.documentElement.classList.toggle('lab-closed'); var tg = document.querySelector('.lab-toggle'); if (tg) tg.setAttribute('aria-expanded', String(open)); }
  function newSeed() { cfg().seed = 1 + Math.floor(Math.random() * 9999); E.reset(); go(); }
  var playing = 0;
  function play() {
    if (playing) { cancelAnimationFrame(playing); playing = 0; return; }
    if (cfg().t >= TA - 0.001) cfg().t = 0;
    var t0 = performance.now(), from = cfg().t, len = 24000 / cfg().speed, lastR = 0;
    (function step(ts) { var k = (ts - t0) / len; cfg().t = Math.min(TA - 0.0005, from + k * TA); if (ts - lastR > 33) { lastR = ts; go(); } if (cfg().t < TA - 0.0005) playing = requestAnimationFrame(step); else { playing = 0; go(); } })(t0);
  }
  function replayArrival() { try { sessionStorage.removeItem('day-intro'); } catch (e) { /* storage blocked */ } E.arrive(true); }
  function replayPick() { var ms = E.moments(cfg()); cfg().t = ms[3][2]; go(); cfg().t = ms[4][2]; go(); }

  /* the layout picker; keys 1-4, because the arrows move time here */
  var pk = null;
  function picker() {
    pk = el('nav', 'proto-picker'); pk.setAttribute('aria-label', 'Layouts'); pk.appendChild(el('span', 'proto-picker-highlight')).setAttribute('aria-hidden', 'true');
    MODES.forEach(function (m) { var b = el('button', 'proto-picker-item', MODE_NAMES[m]); b.type = 'button'; b.dataset.m = m; b.addEventListener('click', function () { cfg().mode = m; go(); }); pk.appendChild(b); });
    pk.appendChild(el('span', 'proto-picker-divider')).setAttribute('aria-hidden', 'true');
    var rp = el('button', 'proto-picker-item proto-picker-replay', '↻'); rp.type = 'button'; rp.setAttribute('aria-label', 'Replay arrival (R)'); rp.addEventListener('click', replayArrival); pk.appendChild(rp);
    document.body.appendChild(pk); pickerSync(); requestAnimationFrame(function () { requestAnimationFrame(function () { pk.setAttribute('data-ready', ''); }); });
    window.addEventListener('resize', pickerSync);
  }
  function pickerSync() {
    if (!pk) return; var items = pk.querySelectorAll('.proto-picker-item:not(.proto-picker-replay)'), hl = pk.querySelector('.proto-picker-highlight');
    items.forEach(function (b) { var on = b.dataset.m === cfg().mode; b.toggleAttribute('data-active', on); if (on) { b.setAttribute('aria-current', 'true'); hl.style.width = b.offsetWidth + 'px'; hl.style.transform = 'translateX(' + b.offsetLeft + 'px)'; } else b.removeAttribute('aria-current'); });
    var sd = document.querySelector('.lab-seed'); if (sd) sd.textContent = 'Seed ' + cfg().seed;
  }
  function keys(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tg = e.target; if (tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) return;
    var S = E.sched(cfg()), stepT = (e.shiftKey ? 60 : 15) / (S.winEnd - S.winStart) * TA, k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); cfg().t = clamp(cfg().t + (k === 'ArrowRight' ? stepT : -stepT), 0, 1); go(); }
    else if (/^[1-4]$/.test(k)) { cfg().mode = MODES[+k - 1]; go(); }
    else if (k === 'n' || k === 'N') newSeed();
    else if (k === 'r' || k === 'R') replayArrival();
    else if (k === 'p' || k === 'P') play();
    else if (k === 'g' || k === 'G') { cfg().grid = cfg().grid ? 0 : 1; go(); }
    else if (k === 's' || k === 'S') { if (window.__daySave) window.__daySave(); }
    else if (k === '\\') togglePanel();
  }
  function clickGround(e) {
    if (e.target.closest('.lab, .lab-toggle, .proto-picker')) return;
    var a = e.target.closest('a'); if (a) { if (/^#/.test(a.getAttribute('href') || '')) e.preventDefault(); return; }   /* city rows go to the city lab; in-page anchors are stubs here */
    if (e.target.closest('button, input, select, label')) return;
    var row = e.target.closest('.row'), go2 = row && row.querySelector('a[href^="city-lab.html"]'); if (go2) { go2.click(); return; }
    newSeed();
  }

  var URL_KEYS = ['seed', 't', 'mode', 'ground', 'vp', 'join', 'bar', 'moves', 'schedule', 'display', 'row', 'grid', 'reduced', 'you', 'green', 'seal'];
  E.extend({
    base: '../',
    defaults: LAB_DEF,
    bounds: { grid: [0, 1, 1] },
    choices: { ground: ['night', 'paper', 'mint', 'local'], moves: ['line', 'day'], bar: ['solid', 'outline', 'tint'], join: ['bracket', 'funnel', 'radial'], vp: ['fit', '390', '768', '1440'] },
    modes: { index: index, wall: wall, dial: dial },
    links: links,
    ground: ground,
    configure: function (c, qq) {
      delete c.now;
      URL_KEYS.forEach(function (k) { if (qq.get(k) != null) c[k] = qq.get(k); });
      var mm = qq.get('moment'); E.clampCfg(c);
      if (mm) { var m = E.moments(c).filter(function (x) { return x[0] === mm; })[0]; if (m) c.t = m[2]; }
    },
    start: function () {
      if (q.get('panel') !== '0') lab(); else document.documentElement.classList.add('lab-closed', 'no-lab');
      go();
      document.addEventListener('keydown', keys); document.addEventListener('click', clickGround);
    },
    after: after
  });
  window.DAYLAB = { greenShare: greenShare, moments: E.moments, get cfg() { return Object.assign({}, E.cfg); }, save: function () { return window.__daySave && window.__daySave(); } };
})();
