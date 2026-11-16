/* city-lab.js: the tuning page for the city page (lab/city-lab.html). It extends shared/city.js through CITY.extend:
   three more layouts (Race, Gallery, Leader), the knob panel, the layout picker and Save. Nothing in production loads it.

   The lab's clock is the config's t across the city's window (an hour before it starts to half an hour after the
   pick), played forward at the Live clock rate. ?ht= takes the home lab's clock instead, so a link from the home lab
   lands on the same moment. Save writes the whole config to saved/city.config.json (node tools/serve.mjs).

   Keys (besides the page's J, K, V, Enter and Escape): 1-4 layouts, left/right move time 5 min (shift: 30), N new
   seed, R replay arrival, G grid, S save, \ panel. */
(function () {
  'use strict';
  var E = window.CITY, P = E.parts, D = window.DAY, M = D.calc;
  var esc = P.esc, r2 = P.r2, clamp = P.clamp, fmtN = P.fmtN, local = P.local, win = P.win, tAt = P.tAt;
  var sheetRows = P.sheetRows, placeholder = P.placeholder, liAttr = P.liAttr, rowCls = P.rowCls, nameLink = P.nameLink, slot = P.slot, voteBtn = P.voteBtn;
  var tie = P.tie, sealMark = P.sealMark, cut = P.cut, cutText = P.cutText, sheetHead = P.sheetHead, foot = P.foot, view = P.view, trace = P.trace;
  var flashTick = P.flashTick, slotText = P.slotText, pic = P.pic, sheetLabel = P.sheetLabel;
  var MODES = ['tower', 'race', 'gallery', 'leader'];
  var MODE_NAMES = { tower: 'Tower', race: 'Race', gallery: 'Gallery', leader: 'Leader' };
  var q = new URLSearchParams(location.search), STILL = q.get('still') === '1';

  /* ---------------- the other three layouts ---------------- */
  function race(W, c, opts) {
    var V = view(W), list = sheetRows(W, c, c.top, opts), max = W.lead ? Math.max(1, W.lead.v) : 1;
    var rows = list.map(function (o, j) {
      if (!o) return placeholder(W, j);
      var w = W.votesOn ? Math.round(o.v / max * 1000) / 1000 : 0;
      var inner = W.votesOn ? '<i class="rc-bar" style="--w:' + w + '"' + (o === W.lead ? ' data-g="1"' : '') + '></i><span class="rc-n" style="--w:' + w + '">' + fmtN(o.v) + '</span>'
        : '<span class="rc-arr">Arrived ' + local(W, o.arrive) + '</span>';
      return '<li' + liAttr(W, o, rowCls(W, o, 'rc-row'), j) + '>' + nameLink(W, o) +
        '<span class="cl-strip rc-track">' + inner + '</span>' + slot(W, o, c) + voteBtn(W, o) + tie(W, o) + sealMark(W, o, c) + cut(W, c, j) + '</li>';
    }).join('');
    return '<section class="cl-sheet cl-race" id="sheet" aria-label="' + esc(sheetLabel(W, c)) + '">' + sheetHead(W, V, c) +
      '<ol class="cl-rows">' + rows + '</ol>' + foot(W, c) + '</section>';
  }
  function gallery(W, c, opts) {
    var list = sheetRows(W, c, c.top, opts);
    var tiles = list.map(function (o, j) {
      var big = j === 0;
      if (!o) return '<li class="gl-t is-empty' + (big ? ' gl-big' : '') + '" data-k="e' + j + '"><span class="gl-pic"><i class="pic pic-empty"></i></span><span class="gl-tx"><span class="gl-k"></span><span class="gl-n"></span><span class="gl-v"></span><span class="gl-b"></span></span></li>';
      var t = slotText(W, o);
      return '<li' + liAttr(W, o, 'gl-t' + (big ? ' gl-big' : '') + (o === W.lead ? ' is-lead' : '') + (c.you === o.k ? ' is-you' : ''), j) + '>' +
        '<span class="gl-pic">' + pic(o.p) + '</span><span class="gl-tx"><span class="gl-k slot-k' + (o === W.lead ? ' g' : '') + '">' + (o === W.lead ? '<i class="gsq" data-g="1"></i>' : '') + esc(t.k) + '</span>' +
        nameLink(W, o, 'gl-n') + '<span class="gl-v">' + (W.votesOn ? '<b>' + fmtN(o.v) + '</b> ' + (o.v === 1 ? 'vote' : 'votes') : esc(t.a)) + '</span><span class="gl-b">' + esc(t.b) + '</span>' + voteBtn(W, o) + '</span>' + sealMark(W, o, c) + '</li>';
    }).join('');
    return '<section class="cl-sheet cl-gallery" id="sheet" aria-label="' + esc(sheetLabel(W, c)) + '">' + (W.votesOn && cutText(W, c) ? '<p class="gl-cut">' + esc(cutText(W, c)) + '</p>' : '<p class="gl-cut"></p>') +
      '<ol class="gl-grid" style="--n:' + c.top + '">' + tiles + '</ol>' + foot(W, c) + '</section>';
  }
  function leader(W, c, opts) {
    var V = view(W), list = sheetRows(W, c, c.top, opts), first = list[0], rest = list.slice(1), t = slotText(W, first);
    var poster = first ? '<div' + liAttr(W, first, 'ld-poster' + (first === W.lead ? ' is-lead' : '')) + '><span class="ld-pic">' + pic(first.p) + '</span>' +
      '<p class="ld-k slot-k' + (first === W.lead ? ' g' : '') + '">' + (first === W.lead ? '<i class="gsq" data-g="1"></i>' : '') + esc(W.votesOn ? t.k : W.state === 'build' ? 'Newest entry' : '') + '</p>' +
      nameLink(W, first, 'ld-n') + '<p class="ld-v">' + (W.votesOn ? '<b>' + fmtN(first.v) + '</b> ' + (first.v === 1 ? 'vote' : 'votes') : esc(t.a)) + '</p><p class="ld-b">' + esc(W.votesOn ? t.b : '@' + first.p.handle) + '</p>' + voteBtn(W, first) + sealMark(W, first, c) + '</div>'
      : '<div class="ld-poster is-empty" data-k="e0"><span class="ld-pic"><i class="pic pic-empty"></i></span><p class="ld-k slot-k"></p><span class="ld-n"></span><p class="ld-v"></p><p class="ld-b"></p></div>';
    var rows = rest.map(function (o, j) {
      if (!o) return placeholder(W, j + 1);
      return '<li' + liAttr(W, o, rowCls(W, o, 'ld-row'), j + 1) + '>' + nameLink(W, o) +
        '<span class="cl-strip">' + trace(W, V, o, c) + flashTick(o, W, V) + '</span><span class="ld-c">' + esc(W.votesOn ? fmtN(o.v) : local(W, o.arrive)) + '</span>' + voteBtn(W, o) + '</li>';
    }).join('');
    return '<section class="cl-sheet cl-leader" id="sheet" aria-label="' + esc(sheetLabel(W, c)) + '">' + poster +
      '<div class="ld-side">' + (W.votesOn && cutText(W, c) ? '<p class="ld-cut">' + esc(cutText(W, c)) + '</p>' : '<p class="ld-cut"></p>') + '<ol class="cl-rows">' + rows + '</ol></div>' + foot(W, c) + '</section>';
  }

  /* ---------------- links: lab pages link to lab pages ---------------- */
  var links = {
    city: function (W, id) {
      var c = W.c, u = 'city-lab.html?city=' + id + '&ht=' + M.tOf(W.now, W.S).toFixed(4);
      if (c.seed !== E.DEF.seed) u += '&seed=' + c.seed;
      if (c.ground !== 'night') u += '&ground=' + c.ground;
      if (q.get('panel') === '0') u += '&panel=0';
      return u;
    },
    home: function (W, hash) {
      var c = W.c, u = 'day-lab.html?mode=timetable&t=' + M.tOf(W.now, W.S).toFixed(4) + '&from=' + W.city.id;
      if (c.seed !== E.DEF.seed) u += '&seed=' + c.seed;
      if (c.ground !== 'night') u += '&ground=' + c.ground;
      if (q.get('panel') === '0') u += '&panel=0';
      return u + (hash || '');
    }
  };

  /* a home-lab clock earlier than this city's window (the city starts hours later) is held as that minute, so the
     countdown matches the home row; any change of time lets it go */
  var held = null;
  function go(opts) {
    var c = E.cfg;
    if (held && (c.t !== held.t || c.city !== held.city)) { held = null; delete c.now; }
    return E.go(opts);
  }

  /* ---------------- green budget meter ---------------- */
  function greenShare() {
    var page = E.page, vw = window.innerWidth, vh = window.innerHeight, sum = 0;
    page.querySelectorAll('[data-g]').forEach(function (e) {
      var r = e.getBoundingClientRect(), w = Math.max(0, Math.min(vw, r.right) - Math.max(0, r.left)), h = Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top));
      var k = e.classList.contains('now') ? 2 / Math.max(1, r.width) : 1;
      if (e.classList.contains('ft-pick') || e.classList.contains('you')) k = 0.25;   /* green text: ink covers about a quarter of its box */
      sum += w * h * k;
    });
    return sum / (vw * vh) * 100;
  }

  /* ---------------- panel ---------------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var panel = null, ctl = {}, meter = null, momentBtns = [], urlT = 0;
  function after(W, c, opts) {
    var frame = document.getElementById('city');
    frame.dataset.vp = c.vp; frame.classList.toggle('grid-on', !!c.grid); frame.classList.toggle('rm', !!c.reduced); frame.classList.toggle('no-peek', !c.peek);
    if (c.t < 0) c.t = E.moments(c)[2][2];
    if (panel) {
      Object.keys(ctl).forEach(function (k) {
        var x = ctl[k]; if (x.input.type === 'checkbox') x.input.checked = !!c[k]; else if (document.activeElement !== x.input || k === 't') x.input.value = c[k];
        if (x.out) x.out.textContent = k === 't' ? local(W, W.now) : k === 'you' ? (c.you < 0 ? 'none' : '#' + (c.you + 1)) : k === 'rate' ? (c.rate ? c.rate + '×' : 'off') : k === 'reorder' ? c.reorder + ' s' : c[k];
      });
      var ms = E.moments(c), cur = -1; ms.forEach(function (m, i) { if (Math.abs(c.t - m[2]) < 0.0008) cur = i; });
      momentBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === cur)); });
      if (!opts || !opts.live) requestAnimationFrame(function () { if (meter) { var g = greenShare(); meter.textContent = 'Green: ' + g.toFixed(1) + '% of the viewport' + (g >= 5 ? ' (over budget)' : ''); meter.classList.toggle('bad', g >= 5); } });
    }
    pickerSync();
    var tn = performance.now();
    if (!opts || !opts.live || tn - urlT > 2000) {
      urlT = tn; var u = new URL(location.href); u.searchParams.delete('ht'); u.searchParams.delete('moment');
      u.searchParams.set('city', c.city); u.searchParams.set('mode', c.mode); u.searchParams.set('t', (+c.t).toFixed(4));
      history.replaceState(null, '', u);
    }
  }
  var BOUNDS = E.BOUNDS, CHOICES = E.CHOICES;
  var LABELS = { seed: 'Seed', t: 'Time', rate: 'Live clock', reorder: 'Reorder every', you: 'Your entry', top: 'Top count', row: 'Row height', nameSize: 'Name size', disp: 'City size', pic: 'Picture', trace: 'Trace weight', table: 'Table row', speed: 'Motion speed', startHour: 'Start (local)', buildMin: 'Build, min', voteMin: 'Vote, min', pickAfter: 'Pick after, min' };
  var TOGGLES = { peek: 'Hover peek', seal: 'Seal', reduced: 'Reduced motion', grid: 'Grid overlay' };
  var SELECTS = { city: 'City', ground: 'Ground', title: 'Title', strip: 'Strip shows', cut: 'Cut line', ledger: 'Latest votes', mini: 'Mini day', vp: 'Viewport', schedule: 'Schedule' };
  function lab() {
    panel = el('aside', 'lab'); panel.setAttribute('aria-label', 'City lab');
    var head = el('div', 'lab-h'); head.append(el('h2', null, 'City lab'), el('span', 'lab-seed')); panel.appendChild(head);
    var mrow = el('div', 'lab-moments'); E.moments(E.cfg).forEach(function (m, i) { var b = el('button', null, m[1]); b.type = 'button'; b.addEventListener('click', function () { E.cfg.t = E.moments(E.cfg)[i][2]; go(); }); momentBtns.push(b); mrow.appendChild(b); });
    panel.appendChild(mrow);
    function range(k) {
      var lb = el('label'), inp = document.createElement('input'), out = el('output'); inp.type = 'range'; inp.min = BOUNDS[k][0]; inp.max = BOUNDS[k][1]; inp.step = BOUNDS[k][2];
      inp.addEventListener('input', function () { E.cfg[k] = +inp.value; go(); }); lb.append(el('span', null, LABELS[k]), inp, out); ctl[k] = { input: inp, out: out }; return lb;
    }
    function select(k) {
      var lb = el('label', 'sel'), s = document.createElement('select');
      CHOICES[k].forEach(function (v) { var o = el('option', null, k === 'vp' && v !== 'fit' ? v + ' px' : k === 'city' ? D.cities.filter(function (x) { return x.id === v; })[0].name : v); o.value = v; s.appendChild(o); });
      s.addEventListener('change', function () { var keepT = k === 'city' && E.last ? M.tOf(E.last.now, E.last.S) : null; E.cfg[k] = s.value; if (keepT != null) E.cfg.t = tAt(M.nowOf(keepT, win(E.cfg).S), win(E.cfg)); E.resetShown(); go(); });
      lb.append(el('span', null, SELECTS[k]), s); ctl[k] = { input: s }; return lb;
    }
    function toggle(k) { var lb = el('label', 'tog'), i = document.createElement('input'); i.type = 'checkbox'; i.addEventListener('change', function () { E.cfg[k] = i.checked ? 1 : 0; go(); }); lb.append(i, el('span', null, TOGGLES[k])); ctl[k] = { input: i }; return lb; }
    function group(name, nodes) { var f = el('fieldset'); f.appendChild(el('legend', null, name)); nodes.forEach(function (n) { f.appendChild(n); }); panel.appendChild(f); }
    group('Time', [range('t'), range('rate'), range('reorder'), select('schedule'), range('startHour'), range('buildMin'), range('voteMin'), range('pickAfter')]);
    group('City', [select('city'), range('you'), select('ground')]);
    group('Type and grid', [range('top'), range('row'), range('nameSize'), range('disp'), select('title'), range('table'), select('vp'), toggle('grid')]);
    group('Pieces', [select('strip'), range('trace'), select('cut'), select('ledger'), range('pic'), toggle('peek'), select('mini'), toggle('seal')]);
    group('Motion', [range('speed'), toggle('reduced')]);
    var btns = el('div', 'lab-btns'), b1 = el('button', null, 'New seed'), b3 = el('button', null, 'Replay arrival'), sv = el('button', 'pri', 'Save');
    [b1, b3, sv].forEach(function (b) { b.type = 'button'; btns.appendChild(b); });
    meter = el('p', 'lab-meter'); var msg = el('p', 'lab-msg'), rail = el('div', 'lab-rail');
    panel.append(btns, meter, msg, rail);
    b1.addEventListener('click', newSeed); b3.addEventListener('click', function () { arrive(true); }); sv.addEventListener('click', save);
    function snap() { try { return JSON.parse(localStorage.getItem('city-saved') || '[]'); } catch (e) { return []; } }
    function railDraw() { rail.textContent = ''; snap().forEach(function (s) { var b = el('button', null, MODE_NAMES[s.mode] + ' ' + s.city + ' #' + s.seed); b.type = 'button'; b.title = 'Apply this saved config'; b.addEventListener('click', function () { E.cfg = E.clampCfg(Object.assign({}, E.DEF, s)); E.resetShown(); go(); }); rail.appendChild(b); }); }
    function save() {
      E.clampCfg(E.cfg); var json = JSON.stringify(E.cfg, null, 2) + '\n';
      try { navigator.clipboard.writeText(json).catch(function () {}); } catch (e) { /* no clipboard */ }
      try { var l = snap().filter(function (s) { return JSON.stringify(s) !== JSON.stringify(E.cfg); }); l.unshift(Object.assign({}, E.cfg)); localStorage.setItem('city-saved', JSON.stringify(l.slice(0, 10))); } catch (e) { /* storage blocked */ }
      railDraw();
      return fetch('/__save?name=city', { method: 'POST', body: json }).then(function (r) { return r.json(); }).then(function (j) { msg.textContent = 'Saved to ' + j.path + ' and copied.'; return j; }).catch(function () { msg.textContent = 'Copied. There is no dev server here to write the file.'; });
    }
    window.__citySave = save;
    railDraw();
    var tg = el('button', 'lab-toggle', 'Lab'); tg.type = 'button'; tg.setAttribute('aria-expanded', 'true'); tg.addEventListener('click', togglePanel);
    document.body.append(panel, tg);
    picker();
  }
  function togglePanel() { var open = !document.documentElement.classList.toggle('lab-closed'); var tg = document.querySelector('.lab-toggle'); if (tg) tg.setAttribute('aria-expanded', String(open)); }
  function newSeed() { E.cfg.seed = 1 + Math.floor(Math.random() * 9999); E.reset(); go(); }
  function arrive(force) { E.arrive(force); }
  var pk = null;
  function picker() {
    pk = el('nav', 'proto-picker'); pk.setAttribute('aria-label', 'Directions'); pk.appendChild(el('span', 'proto-picker-highlight')).setAttribute('aria-hidden', 'true');
    MODES.forEach(function (m) { var b = el('button', 'proto-picker-item', MODE_NAMES[m]); b.type = 'button'; b.dataset.m = m; b.addEventListener('click', function () { E.cfg.mode = m; E.resetShown(); go(); }); pk.appendChild(b); });
    pk.appendChild(el('span', 'proto-picker-divider')).setAttribute('aria-hidden', 'true');
    var rp = el('button', 'proto-picker-item proto-picker-replay', '↻'); rp.type = 'button'; rp.setAttribute('aria-label', 'Replay arrival (R)'); rp.addEventListener('click', function () { arrive(true); }); pk.appendChild(rp);
    document.body.appendChild(pk); pickerSync(); requestAnimationFrame(function () { requestAnimationFrame(function () { pk.setAttribute('data-ready', ''); }); });
    window.addEventListener('resize', pickerSync);
  }
  function pickerSync() {
    if (!pk) return; var items = pk.querySelectorAll('.proto-picker-item:not(.proto-picker-replay)'), hl = pk.querySelector('.proto-picker-highlight');
    items.forEach(function (b) { var on = b.dataset.m === E.cfg.mode; b.toggleAttribute('data-active', on); if (on) { b.setAttribute('aria-current', 'true'); hl.style.width = b.offsetWidth + 'px'; hl.style.transform = 'translateX(' + b.offsetLeft + 'px)'; } else b.removeAttribute('aria-current'); });
    var sd = document.querySelector('.lab-seed'); if (sd) sd.textContent = 'Seed ' + E.cfg.seed;
  }

  /* ---------------- keys and clicks the page does not have ---------------- */
  function keys(e) {
    var k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft') {
      e.preventDefault(); var Wn = win(E.cfg), step = (e.shiftKey ? 30 : 5) / (Wn.w1 - Wn.w0);
      E.cfg.t = clamp(E.cfg.t + (k === 'ArrowRight' ? step : -step), 0, 1); go();
    } else if (/^[1-4]$/.test(k)) { E.cfg.mode = MODES[+k - 1]; E.resetShown(); go(); }
    else if (k === 'n' || k === 'N') newSeed();
    else if (k === 'r' || k === 'R') arrive(true);
    else if (k === 'g' || k === 'G') { E.cfg.grid = E.cfg.grid ? 0 : 1; go(); }
    else if (k === 's' || k === 'S') { if (window.__citySave) window.__citySave(); }
    else if (k === '\\') togglePanel();
  }
  function click(e) {
    if (e.target.closest('.lab, .lab-toggle, .proto-picker')) return true;
    var a = e.target.closest('a'); if (a && /^#(?!sheet)/.test(a.getAttribute('href') || '') && !a.hasAttribute('data-row')) { e.preventDefault(); return true; }   /* in-page anchors are stubs here */
    return false;
  }

  /* the live clock: other people's votes are the shared data played forward at the rate, so this page and the home
     lab keep agreeing. Runs while building and voting, never in stills. */
  var tickT = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    var W = E.last, c = E.cfg;
    if (!c.rate || STILL || document.hidden || !W || (W.state !== 'vote' && W.state !== 'build')) { tickT = ts; return; }
    if (ts - tickT < 250) return;
    var dt = Math.min(1000, ts - tickT) / 60000 * c.rate, Wn = win(c); tickT = ts;
    c.t = clamp(c.t + dt / (Wn.w1 - Wn.w0), 0, 1); go({ live: true });
  }

  var URL_KEYS = ['seed', 't', 'city', 'mode', 'ground', 'vp', 'grid', 'reduced', 'you', 'top', 'row', 'title', 'strip', 'cut', 'ledger', 'mini', 'rate', 'sort', 'q', 'seal', 'peek', 'pic', 'nameSize', 'disp', 'trace', 'table', 'reorder'];
  E.extend({
    base: '../',
    defaults: { title: 'band', mini: 'cascade', grid: 0, vp: 'fit', you: 12 },
    bounds: { grid: [0, 1, 1] },
    choices: { title: ['band', 'poster'], mini: ['cascade', 'ticks'], vp: ['fit', '390', '768', '1440'] },
    modes: { race: race, gallery: gallery, leader: leader },
    links: links,
    configure: function (c, qq) {
      delete c.now;
      URL_KEYS.forEach(function (k) { if (qq.get(k) != null) c[k] = qq.get(k); });
      if (STILL) c.rate = 0;
      E.clampCfg(c);
      var ht = qq.get('ht'), mm = qq.get('moment');
      held = null;
      if (ht != null && isFinite(+ht)) { var Wn = win(c), hm = M.nowOf(+ht, Wn.S); c.t = +ht >= M.TA ? 1 : tAt(hm, Wn); if (+ht < M.TA && hm < Wn.w0) { held = { t: c.t, city: c.city }; c.now = hm; } }
      if (mm) { var m = E.moments(c).filter(function (x) { return x[0] === mm; })[0]; if (m) c.t = m[2]; }
      if (c.t < 0) c.t = E.moments(c)[2][2];
    },
    start: function () {
      if (q.get('panel') !== '0') lab(); else document.documentElement.classList.add('lab-closed', 'no-lab');
      go();
      requestAnimationFrame(loop);
    },
    after: after,
    keys: keys,
    click: click,
    empty: function () { newSeed(); }
  });
  window.CITYLAB = { greenShare: greenShare, moments: E.moments, world: E.world, get cfg() { return Object.assign({}, E.cfg); }, set: function (c) { Object.assign(E.cfg, c); E.resetShown(); go(); }, vote: E.vote, save: function () { return window.__citySave && window.__citySave(); } };
})();
