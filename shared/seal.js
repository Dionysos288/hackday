/* seal.js: the city seals. Line work cut the way a rose engine or geometric lathe cuts guilloche on a banknote.
   Every seal is a pure function of (config, city id): all variation comes from mulberry32 seeded by cfg.seed and the
   city id, so the saved JSON (saved/seal.config.json) reproduces the exact drawing. No dependencies.

   Rules (fixed, never knobs): line work only (no fills, gradients, glow, shadow); one stroke weight per seal; closed
   curves only; monochrome ink (currentColor), green (--c-accent) only as the merged winner's stroke; fewer lines at
   small sizes, never thinner ones; all shape comes from the maths below, nothing is laid on top.

   Modes (one line of maths each):
     rosette    rose-engine envelope: families of r(t) = rm + a*W(L*t + psi) + offset, phase-stepped so they cross into a lattice
     band       braided bands: prolate trochoids wrapped on a circle (radial sin, tangential cos), F strands half a period apart
     medallion  a hypotrochoid core (R/r = L/q, closes after q turns) rotated into an envelope, framed by a rosette band and a band

   API: window.SEAL = { DEF, BOUNDS, CITIES, render(cfg, opts), forCity(id, opts), merged(ids, opts), load(url), clampCfg }
   opts: { size (px, default 600), detail (0..1, default from size), stroke (px, overrides cfg.weight), cfg (partial
   overrides), draw (adds pathLength and --k for the stroke-dashoffset replay), plot (export: paths only, black, mm) } */
(function () {
  'use strict';
  var MODES = ['rosette', 'band', 'medallion'];
  var KNOBS = ['lobes', 'rings', 'amp', 'inner', 'drift', 'density', 'interlace', 'harmonic', 'loop', 'gap', 'rails'];
  var DEF = {
    seed: 1207, mode: 'rosette', weight: 1, startMark: true, continuous: false,
    rosette: { lobes: 13, rings: 2, amp: 45, inner: 30, drift: 55, density: 16, interlace: 2, harmonic: 20, loop: 40, gap: 14, rails: 2 },
    band: { lobes: 17, rings: 2, amp: 55, inner: 46, drift: 8, density: 8, interlace: 2, harmonic: 0, loop: 62, gap: 18, rails: 2 },
    medallion: { lobes: 11, rings: 2, amp: 50, inner: 44, drift: 45, density: 12, interlace: 2, harmonic: 15, loop: 40, gap: 14, rails: 2 }
  };
  /* [min, max, step]. Each bound was rendered alone and all-min / all-max together at 200 and 440px in all three modes (shots/seal/ext-*). */
  var BOUNDS = {
    seed: [1, 99999, 1], weight: [0.5, 1.5, 0.25],
    lobes: [8, 28, 1], rings: [1, 4, 1], amp: [15, 85, 1], inner: [16, 60, 1], drift: [0, 100, 1], density: [6, 28, 1],
    interlace: [1, 4, 1], harmonic: [0, 60, 1], loop: [0, 100, 1], gap: [0, 30, 1], rails: [0, 3, 1]
  };
  var CITIES = ['sydney', 'tokyo', 'singapore', 'bengaluru', 'berlin', 'lagos', 'london', 'sao-paulo', 'new-york', 'san-francisco'];
  var SAVED = null;
  var TAU = Math.PI * 2;

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function fnv(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function num(v, k, d) { var b = BOUNDS[k], n = +v; if (v === '' || v == null || !isFinite(n)) n = d; n = Math.round(n / b[2]) * b[2]; return clamp(+n.toFixed(4), b[0], b[1]); }
  function clampCfg(c) {
    c = c || {}; var o = { seed: num(c.seed, 'seed', DEF.seed), mode: MODES.indexOf(c.mode) < 0 ? DEF.mode : c.mode, weight: num(c.weight, 'weight', DEF.weight),
      startMark: c.startMark == null ? DEF.startMark : !!c.startMark, continuous: c.continuous == null ? DEF.continuous : !!c.continuous };
    MODES.forEach(function (m) { var src = c[m] || {}, d = DEF[m]; o[m] = {}; KNOBS.forEach(function (k) { o[m][k] = num(src[k], k, d[k]); }); });
    return o;
  }
  function mergeCfg(base, over) {
    var o = JSON.parse(JSON.stringify(base)); if (!over) return clampCfg(o);
    Object.keys(over).forEach(function (k) { if (MODES.indexOf(k) >= 0 && over[k] && typeof over[k] === 'object') Object.assign(o[k] = o[k] || {}, over[k]); else o[k] = over[k]; });
    return clampCfg(o);
  }

  /* ---- path writing: sampled closed curves become Catmull-Rom cubics ---- */
  function Pen(dec) { this.p = Math.pow(10, dec); this.paths = []; }
  Pen.prototype.f = function (n) { return String(Math.round(n * this.p) / this.p); };
  Pen.prototype.curve = function (pts, k) { this.paths.push({ pts: pts, k: k }); };
  function cubic(pen, pts, join) {
    var n = pts.length, f = function (v) { return pen.f(v); }, s = (join ? 'L' : 'M') + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      s += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return join ? s : s + 'Z';
  }
  var START = -Math.PI / 2;   /* every curve starts at 12 o'clock, so a continuous pen only steps radially between curves */
  function circle(r, n) { var pts = []; for (var i = 0; i < n; i++) { var t = START + TAU * i / n; pts.push([r * Math.cos(t), r * Math.sin(t)]); } return pts; }

  /* one annulus [r0, r1] cut with F interlaced families of c curves each */
  function band(pen, b, kbase, kspan) {
    var rm = (b.r0 + b.r1) / 2, hw = (b.r1 - b.r0) / 2, L = b.L, F = b.F, c = b.c;
    var a = Math.min(hw * b.amp, (b.guard || 0.8) * rm / L);   /* slope guard: a wave never steeper than 0.8 (1.3 for the few lines of a row marker), so no knob makes a hairball */
    var spread = Math.max(0, hw - a), rho = b.loop * 2.1, S = b.kind === 'loop' ? 13 : 7, N = L * S, total = F * c, idx = 0;
    if (b.kind === 'loop') { a = Math.min(hw * 0.92, a + spread * 0.5); spread = hw - a; }
    if (b.px) c = Math.min(c, 1 + Math.floor(2 * spread * (b.kind === 'loop' ? 0.55 : 1) * b.px / 3));   /* parallel lines in a strand at least ~3px apart */
    total = F * c;
    for (var f = 0; f < F; f++) for (var j = 0; j < c; j++) {
      var t = c > 1 ? j / (c - 1) - 0.5 : 0, off = t * 2 * spread * (b.kind === 'loop' ? 0.55 : 1);
      var psi = b.psi + f * TAU / F + b.drift * Math.PI * t * 2 * b.lean, pts = [];
      for (var i = 0; i < N; i++) {
        var th = START + TAU * i / N, x = L * (th - START) + psi, r, tt;
        if (b.kind === 'loop') { r = rm + off + a * Math.sin(x); tt = th + b.lean * (rho / L) * Math.cos(x); }
        else { r = rm + off + a * (Math.sin(x) + b.h * Math.sin(2 * x + b.hp)) / (1 + b.h); tt = th; }
        pts.push([r * Math.cos(tt), r * Math.sin(tt)]);
      }
      pen.curve(pts, kbase + kspan * (idx++ / Math.max(1, total)));
    }
  }
  /* hypotrochoid core: R/r = L/q in lowest terms, so it closes after q turns with L lobes; rotated copies make the envelope */
  function core(pen, b, kbase, kspan) {
    var q = Math.max(1, b.q), L = Math.min(b.L, Math.floor(56 / q)); while (q > 1 && gcd(L, q) !== 1) q--;   /* lobes x turns capped, or the core fills in */
    var Rr = L - q, d = q * (0.35 + b.amp * 1.1), sc = b.r / (Rr + d), w = Rr / q, N = Math.round(L * 12 * Math.min(q, 3) + 60), total, idx = 0;
    var cc = Math.max(1, Math.min(b.c, Math.floor(10 / (q * b.F)))); total = b.F * cc;
    for (var f = 0; f < b.F; f++) for (var j = 0; j < cc; j++) {
      var rot = b.psi / L + f * TAU / (L * b.F) + (cc > 1 ? (j / (cc - 1) - 0.5) : 0) * b.drift * (TAU / L) * b.lean, pts = [];
      var shrink = cc > 1 ? 1 - 0.18 * j / (cc - 1) * (1 - b.drift) : 1;
      for (var i = 0; i < N; i++) {
        var t = TAU * q * i / N, x = Rr * Math.cos(t) + d * Math.cos(w * t), y = Rr * Math.sin(t) - d * Math.sin(w * t);
        var ang = Math.atan2(y, x) + rot + START, rad = Math.sqrt(x * x + y * y) * sc * shrink;
        pts.push([rad * Math.cos(ang), rad * Math.sin(ang)]);
      }
      pen.curve(pts, kbase + kspan * (idx++ / Math.max(1, total)));
    }
  }

  /* the city's genes: lobe count (distinct for each of the ten under one seed), phase, lean, harmonic phase, ring multipliers */
  function genes(seed, city) {
    var i = city == null ? -1 : CITIES.indexOf(city), R = mulberry32((seed * 2654435761) ^ (city == null ? 0 : fnv(city))), P = mulberry32(seed * 7919 + 13);
    var offs = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5]; for (var k = offs.length - 1; k > 0; k--) { var s = Math.floor(P() * (k + 1)), tmp = offs[k]; offs[k] = offs[s]; offs[s] = tmp; }
    var dl = city == null ? 0 : i >= 0 ? offs[i] : (fnv(city) % 10) - 4;
    return { dl: dl, psi: R() * TAU, lean: R() < 0.5 ? -1 : 1, hp: R() * TAU, mult: [1, R() < 0.5 ? 2 : 1, R() < 0.4 ? 0.5 : 1, R() < 0.5 ? 2 : 1], fShift: R() < 0.5 ? 0 : 1, qShift: Math.floor(R() * 2) };
  }

  function levels(o) {
    var size = o.size || 600, d = o.detail != null ? clamp(+o.detail, 0, 1) : clamp((size - 16) / 480, 0, 1);
    return { size: size, d: d, tiny: d < 0.06, dec: o.plot || o.draw ? 2 : 1 };
  }
  function lines(c, F, L) { var per = Math.max(1, Math.round(c / F)); return L.tiny ? 1 : Math.max(1, Math.round(per * (0.22 + 0.78 * L.d))); }

  /* lay out one seal into the pen. k is the replay order (0 = first stroke). */
  function draw(pen, cfg, city, L) {
    var m = cfg[cfg.mode], g = genes(cfg.seed, city), RO = 94, i;
    var rails = L.tiny ? Math.min(1, m.rails) : m.rails, railGap = 2.2, Rb = RO - (rails ? rails * railGap + 1.6 : 0);
    for (i = 0; i < rails; i++) pen.curve(circle(RO - i * railGap, 96), 0);
    var sigL = L.tiny ? Math.max(4, Math.round((m.lobes + g.dl) / 2.2)) : m.lobes + g.dl, F = Math.max(1, Math.min(4, m.interlace + (L.tiny ? 0 : g.fShift * (m.interlace < 4 && m.interlace > 1 ? 1 : 0)))), base = { amp: m.amp / 100, drift: m.drift / 100, h: m.harmonic / 100, hp: g.hp, lean: g.lean, loop: m.loop / 100 };
    if (L.tiny) F = Math.min(F, 2);
    var Ri = Rb * m.inner / 100, n = L.tiny ? 1 : Math.max(1, Math.min(m.rings, Math.round(m.rings * (0.45 + 0.55 * L.d) + 0.2)));
    if (cfg.mode === 'medallion') {
      var ringsM = L.tiny ? 0 : n, gapU = (Rb - Ri) * m.gap / 100 / Math.max(1, ringsM);
      core(pen, Object.assign({}, base, { r: L.tiny ? Rb * 0.9 : Ri - gapU * 0.5, L: sigL, q: 1 + Math.round(m.loop / 50) + g.qShift, F: L.tiny ? 1 : F, c: L.tiny ? 1 : Math.max(1, Math.min(Math.round(lines(m.density, F, L) * 0.6), Math.floor((6 + 14 * L.d) / F))), psi: g.psi }), 0.55, 0.45);
      if (!ringsM) return;
      Ri += gapU * 0.5;
    }
    var cB = lines(m.density, F, L), budget = Math.round(10 + 40 * L.d);   /* line budget: the whole seal never holds more curves than its size can carry */
    if (n * F * cB > budget) cB = Math.max(1, Math.floor(budget / (n * F)));
    var span = Rb - Ri, wn = span / n, gp = wn * m.gap / 100, w = wn - gp * (n - 1) / n;
    cB = Math.min(cB, Math.max(1, Math.floor(Math.min(w, Rb * 0.42) * L.size / 200 / 2.6 / F)));   /* and never closer than about 2.6px apart on average */
    for (var k = 0; k < n; k++) {
      var r1 = Rb - k * (w + gp), r0 = r1 - Math.min(w, Rb * 0.42),   /* a band wider than this stops reading as a band */ rmk = (r0 + r1) / 2, mult = g.mult[k % 4], Lk = k === 0 ? sigL : Math.max(5, Math.round(sigL * mult * Math.pow(rmk / (Rb - w / 2), 0.85)));
      var kind = cfg.mode === 'band' ? 'loop' : cfg.mode === 'medallion' ? (k % 2 ? 'loop' : 'mesh') : 'mesh';
      if (L.tiny && cfg.mode === 'band') { r0 = Rb * 0.42; r1 = Rb; }
      if (L.tiny && cfg.mode === 'rosette') { r0 = Rb * 0.3; r1 = Rb; }
      if (k > 0 && gp > 3.2 && rails && !L.tiny) pen.curve(circle(r1 + gp / 2, 96), 0.02 + k * 0.05);
      band(pen, Object.assign({}, base, { r0: r0, r1: r1, L: Lk, F: F, kind: kind, guard: L.tiny ? 1.3 : 0.8 + 0.5 * (1 - L.d), psi: g.psi + k * Math.PI / Lk, c: cB, px: L.size / 200 }), 0.05 + k * 0.5 / n, 0.5);
    }
  }

  function svg(pen, cfg, L, o, extra) {
    var size = L.size, wpx = o.stroke != null ? +o.stroke : cfg.weight, cont = !!cfg.continuous, plot = !!o.plot, body = [], i;
    pen.paths.sort(function (a, b) { return a.k - b.k; });
    /* weight is in px at the rendered size. Drawable seals carry it in user units instead of non-scaling-stroke, because
       Chrome measures dashes in screen space under non-scaling-stroke and the replay would break up. */
    var user = plot || o.draw, sw = user ? pen.f(wpx * 200 / (plot ? 600 : size)) : String(wpx), ve = user ? '' : ' vector-effect="non-scaling-stroke"', pl = o.draw ? ' pathLength="1"' : '';
    if (cont) {
      var d = ''; for (i = 0; i < pen.paths.length; i++) d += cubic(pen, pen.paths[i].pts, i > 0);
      body.push('<path d="' + d + '"' + ve + pl + (o.draw ? ' style="--k:0"' : '') + '/>');
    } else for (i = 0; i < pen.paths.length; i++) body.push('<path d="' + cubic(pen, pen.paths[i].pts, false) + '"' + ve + pl + (o.draw ? ' style="--k:' + pen.f(pen.paths[i].k) + '"' : '') + '/>');
    if (cfg.startMark && !L.tiny && size >= 200 && pen.paths.length) {   /* the pen's start: a small closed circle around the first point */
      var p = pen.paths[0].pts[0], rr = 5 * 200 / size;
      var m = circle(rr, 24).map(function (q) { return [q[0] + p[0], q[1] + p[1]]; });
      body.push('<path class="seal-start" d="' + cubic(pen, m, false) + '"' + ve + (o.draw ? pl + ' style="--k:0"' : '') + '/>');
    }
    var color = plot ? 'stroke="#000"' : 'stroke="currentColor"', dim = plot ? 'width="150mm" height="150mm"' : 'width="' + size + '" height="' + size + '"';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200" ' + dim + ' fill="none" ' + color + ' stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + body.join('') + '</svg>';
  }

  function base(o) { return mergeCfg(SAVED || DEF, o && o.cfg); }
  function render(cfg, o) { o = o || {}; cfg = clampCfg(cfg); var L = levels(o), pen = new Pen(L.dec); draw(pen, cfg, o.city == null ? null : o.city, L); return svg(pen, cfg, L, o, o.city ? ' class="seal" data-city="' + o.city + '" role="img" aria-label="Seal of ' + o.city + '"' : ' class="seal" role="img" aria-label="Seal"'); }
  function forCity(id, o) { o = Object.assign({}, o || {}); var cfg = base(o); o.city = String(id); return render(cfg, o); }

  /* the winner: the ten city seals interlaced. Each city's own seal (the same genes, cut at the smaller size it gets here)
     sits on a ring in the given order, clockwise from 12 o'clock, turned to face out, overlapping its neighbours the way
     a geometric lathe repeats one rosette around a centre. Shared rails hold the ring. Green, stroke only.
     opts.only = a city id keeps that city's seal and the rails only (for hover or a reveal). */
  function merged(ids, o) {
    o = o || {}; ids = (ids && ids.length ? ids : CITIES).slice(0, 12).map(String);
    var cfg = base(o), L = levels(o), pen = new Pen(L.dec), RO = 94, n = ids.length, i;
    var sub = Math.min(0.36, 2.75 / n) * RO, rho = RO - 3.4 - sub, subL = levels({ size: Math.max(8, L.size * sub / 100), detail: o.detail != null ? o.detail * 0.3 : null });
    var bare = L.size < 48;   /* at row-marker size each city keeps one wave line, no rail, or the ten fill in */
    pen.curve(circle(RO, 120), 0); if (!L.tiny) pen.curve(circle(RO - 2, 120), 0);
    if (!bare) pen.curve(circle(rho - sub - 2.2, 96), 0.02);
    for (i = 0; i < n; i++) {
      if (o.only && o.only !== ids[i]) continue;
      var sp = new Pen(L.dec), sc = cfg; if (bare) { sc = JSON.parse(JSON.stringify(cfg)); sc[cfg.mode].rails = 0; sc[cfg.mode].interlace = 1; }
      draw(sp, sc, ids[i], subL);
      var phi = START + TAU * i / n, cx = rho * Math.cos(phi), cy = rho * Math.sin(phi), rot = phi - START, cs = Math.cos(rot), sn = Math.sin(rot), s = sub / RO;
      sp.paths.forEach(function (p) {
        pen.curve(p.pts.map(function (q) { var x = q[0] * s, y = q[1] * s; return [cx + x * cs - y * sn, cy + x * sn + y * cs]; }), 0.05 + 0.95 * (i + p.k * 0.9) / n);
      });
    }
    return svg(pen, cfg, L, o, ' class="seal seal-merged" style="color: var(--c-accent)" role="img" aria-label="Winner seal: ' + n + ' city seals interlaced"');
  }

  function load(url) {
    return fetch(url || 'saved/seal.config.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (j) { SAVED = j ? clampCfg(j) : null; return SAVED || clampCfg(DEF); });
  }

  window.SEAL = { DEF: DEF, BOUNDS: BOUNDS, KNOBS: KNOBS, MODES: MODES, CITIES: CITIES, clampCfg: clampCfg, mulberry32: mulberry32, render: render, forCity: forCity, merged: merged, load: load };
})();
