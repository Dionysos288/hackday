/* palette.js: the three grounds, written once as OKLCH. Load it in <head>, after brand.css and before any other
   stylesheet, so the ground is set before first paint. brand.css derives every colour role from these five values.
   Night is the default ground (Supabase's near-black, every grey on hue 157.5); paper is a neutral graphite paper;
   mint is a green-tinted paper. ?ground= previews one; the pages then apply the saved config's ground. */
(function () {
  /* On the two light grounds the brand green (L 0.762) is only 1.6:1, so lines and labels use the same hue at L 0.46
     (5.5:1, APCA Lc 69): Supabase's own button green. Contrast repairs move L only; chroma is clamped to sRGB.
     The logo keeps the fixed brand green on every ground (--brand). */
  var BRAND = [0.762, 0.154, 159.4], DEEP = [0.46, 0.105, 159.4], ONDEEP = [0.97, 0.01, 158];
  var PAL = {
    night: { ground: [0.19, 0.0025, 157.5], ink: [0.95, 0.003, 157.5], ink2: [0.79, 0.003, 157.5], green: BRAND, tagink: [0.19, 0.03, 159.4] },
    paper: { ground: [0.93, 0.003, 250], ink: [0.2, 0.003, 250], ink2: [0.37, 0.003, 250], green: DEEP, tagink: ONDEEP },
    mint: { ground: [0.93, 0.052, 158], ink: [0.17, 0.04, 160], ink2: [0.38, 0.05, 160], green: DEEP, tagink: ONDEEP }
  };
  /* each ground in sRGB hex, for the browser's own chrome (<meta name="theme-color">) */
  var HEX = { night: '#131413', paper: '#e6e8ea', mint: '#ccf3db' };
  function c(a) { return 'oklch(' + a[0] + ' ' + a[1] + ' ' + a[2] + ')'; }
  function m(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  var r = document.documentElement, cur = '';
  window.dayPalette = function (name) {
    if (name === cur) return; cur = name; var key = PAL[name] ? name : 'night', p = PAL[key];
    var v = { ground: c(p.ground), ink: c(p.ink), ink2: c(p.ink2), green: c(p.green), tagink: c(p.tagink), brand: c(BRAND), minor: c(m(p.ground, p.ink, 0.08)), major: c(m(p.ground, p.ink, 0.2)) };
    for (var k in v) r.style.setProperty('--' + k, v[k]);
    r.dataset.paper = key === 'night' ? 'night' : 'graphite'; r.dataset.ground = key;
    var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', HEX[key]);
  };
  var g = new URLSearchParams(location.search).get('ground');
  window.dayPalette(PAL[g] ? g : 'night');
  r.classList.add('preload'); requestAnimationFrame(function () { requestAnimationFrame(function () { r.classList.remove('preload'); }); });
})();
