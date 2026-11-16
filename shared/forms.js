/* forms.js: the sheets that collect something from a person. Sign-in, the email step for voting, submit an entry,
   remind me, and share a project. Load after brand.css, palette.js and forms.css (and seal.js, for the share card).

   API: window.FORMS = { signIn(), ensureVoter(), submit({ city, cityName, deadline }), remind({ city, cityName, when }),
   share(project), signOut(), state, on('change', fn), off('change', fn) }

   There is no server yet. `store` below stands in for it: it is the only code that reads or writes localStorage, and the
   only code that waits on the "network". Swap its methods for real calls and nothing else changes. */
(function () {
  'use strict';

  /* ================= the stand-in server ================= */
  var store = {
    LATENCY: 600,                         /* a round trip, so busy states show */
    PREFIX: 'hackday:',
    read: function (k, d) { try { var v = localStorage.getItem(this.PREFIX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    write: function (k, v) { try { if (v == null) localStorage.removeItem(this.PREFIX + k); else localStorage.setItem(this.PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    wait: function (v) { var ms = this.LATENCY; return new Promise(function (r) { setTimeout(function () { r(v); }, ms); }); },

    /* who is here: { email, handle, voter } or null */
    session: function () { return this.read('session', null); },
    lastEmail: function () { return this.read('last-email', ''); },
    sendCode: function (email) { this.write('last-email', email); this.write('code', { email: email, at: Date.now() }); return this.wait({ ok: true }); },
    codeSent: function () { return this.read('code', null); },
    forgetCode: function () { this.write('code', null); },
    /* the stand-in accepts any six digits */
    verifyCode: function (email, code) {
      var self = this;
      return this.wait().then(function () {
        if (!/^\d{6}$/.test(code)) return { ok: false };
        var s = { email: email, handle: handleOf(email), voter: true };
        self.write('session', s); self.write('code', null); return { ok: true, session: s };
      });
    },
    signOut: function () { this.write('session', null); this.write('code', null); return Promise.resolve(); },

    /* one entry per person, keyed by handle */
    entryFor: function (handle) { if (!handle) return null; return (this.read('entries', {}))[handle] || null; },
    saveEntry: function (handle, fields, file, keepPicture) {
      var self = this;
      return Promise.all([file ? shrinkPicture(file) : Promise.resolve(null), this.wait()]).then(function (r) {
        var all = self.read('entries', {}), old = all[handle], now = new Date().toISOString();
        var e = Object.assign({}, fields, {
          id: old ? old.id : 'e' + Date.now().toString(36), handle: handle,
          slug: old ? old.slug : slugOf(fields.name) + '-' + handle,
          picture: r[0] || (keepPicture && old ? old.picture : null),
          createdAt: old ? old.createdAt : now, updatedAt: now
        });
        all[handle] = e;
        if (!self.write('entries', all)) { e.picture = null; all[handle] = e; self.write('entries', all); }   /* storage full: keep the entry, drop the picture */
        return e;
      });
    },

    reminders: function () { return this.read('reminders', {}); },
    remind: function (email, city) { var r = this.reminders(); r[city] = email; this.write('reminders', r); this.write('last-email', email); return this.wait(true); },

    reset: function () { var drop = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(this.PREFIX) === 0) drop.push(k); } drop.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} }
  };

  /* ================= helpers ================= */
  var MAX_PIC = 5 * 1024 * 1024, PIC_TYPES = ['image/jpeg', 'image/png', 'image/webp'], RESEND_S = 30;
  var ICON_X = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>';
  var ICON_ERR = '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="6"/><path d="M7 3.8v3.8M7 9.9v.2"/></svg>';
  var ICON_OUT = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M5 3h6v6M11 3 3 11"/></svg>';
  var TOUCH = window.matchMedia('(pointer: coarse)').matches;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function handleOf(email) { return String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15) || 'builder'; }
  function slugOf(s) { return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'entry'; }
  function emailOK(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()); }
  function withScheme(v) { v = String(v).trim(); return v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? 'https://' + v : v; }
  function urlOK(v) { try { var u = new URL(withScheme(v)); return (u.protocol === 'https:' || u.protocol === 'http:') && /\.[a-z]{2,}$/i.test(u.hostname); } catch (e) { return false; } }
  function githubOK(v) { try { var u = new URL(withScheme(v)); return /^(www\.)?github\.com$/i.test(u.hostname) && /^\/[\w.-]+\/[\w.-]+/.test(u.pathname); } catch (e) { return false; } }
  function utc(d) { d = d instanceof Date ? d : new Date(d); if (isNaN(d)) return ''; return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') + ' UTC'; }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function votes(n) { return Number(n).toLocaleString('en-US') + (n === 1 ? ' vote' : ' votes'); }
  function cityLabel(id) { return String(id || '').split('-').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' '); }
  /* WAAPI and timers cannot read CSS variables: durations are read from the tokens at the moment they are needed */
  function token(name) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); var n = parseFloat(v) || 0; return /ms$/.test(v) ? n : n * 1000; }
  function shrinkPicture(file) {
    /* the stand-in keeps a 1280-wide JPEG so it fits in localStorage; a real API uploads the file itself */
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = Math.min(1280, img.naturalWidth), h = Math.round(w * 9 / 16), c = document.createElement('canvas'), x = c.getContext('2d');
        c.width = w; c.height = h; var s = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }

  /* ================= events and state ================= */
  var subs = [];
  function snapshot() {
    var s = store.session();
    return Object.freeze({ signedIn: !!s, handle: s ? s.handle : null, email: s ? s.email : null, voter: !!(s && s.voter), entry: s ? store.entryFor(s.handle) : null });
  }
  function emit() { var st = snapshot(); subs.slice().forEach(function (fn) { try { fn(st); } catch (e) { console.error(e); } }); }
  window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf(store.PREFIX) === 0) emit(); });

  /* ================= the sheet: one <dialog>, opened with showModal() ================= */
  var openCount = 0;
  function lockPage(on) { openCount += on ? 1 : -1; document.documentElement.classList.toggle('fm-lock', openCount > 0); }
  /* on a phone the sheet sits on the bottom edge of the visual viewport, so the keyboard never covers it */
  function fitKeyboard(dlg) {
    var vv = window.visualViewport; if (!vv) return function () {};
    var fit = function () { var kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); dlg.style.setProperty('--fm-kb', kb + 'px'); dlg.style.setProperty('--fm-vh', vv.height + 'px'); };
    fit(); vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    return function () { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); };
  }

  function sheet(o) {
    var dlg = document.createElement('dialog'), id = 'fm-' + Math.random().toString(36).slice(2, 8);
    dlg.className = 'fm' + (o.wide ? ' is-wide' : '');
    dlg.setAttribute('aria-labelledby', id + '-h');
    dlg.innerHTML = '<div class="fm-in"><div class="fm-top"><p class="fm-k" data-k></p><button class="fm-x" type="button" data-close aria-label="Close">' + ICON_X + '</button></div><div data-body></div></div>';
    document.body.appendChild(dlg);
    var opener = document.activeElement, unfit = null, closing = false, closeTm = 0, done = false;
    var api = {
      el: dlg, id: id,
      body: dlg.querySelector('[data-body]'),
      label: function (t) { dlg.querySelector('[data-k]').textContent = t; },
      /* close(): animate out, then dialog.close(). The 'close' event does the clean-up, so Escape pressed twice still ends well. */
      close: function () {
        if (closing || !dlg.open) return; closing = true; dlg.dataset.state = 'closing';
        closeTm = setTimeout(finish, token('--dur-panel-exit'));
      },
      busy: false
    };
    /* Escape. Chrome makes a second Escape (or one with no user activation) uncancelable and closes at once: then only clean up. */
    dlg.addEventListener('cancel', function (e) { if (!e.cancelable) { setTimeout(finish, 0); return; } e.preventDefault(); if (!api.busy) api.close(); });
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { api.close(); return; }
      /* a press on the backdrop (the dialog box itself, outside its content) dismisses */
      if (e.target === dlg && !api.busy) { var r = dlg.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) api.close(); }
    });
    /* Tab stays inside the sheet: from the last control it wraps to the first, and back */
    dlg.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(dlg.querySelectorAll('a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'), function (n) { return !n.disabled && !n.closest('[hidden]') && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden'; });
      if (!f.length) return; var first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || a === dlg || !dlg.contains(a))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !dlg.contains(a))) { e.preventDefault(); first.focus(); }
    });
    /* one clean-up, whichever way the sheet ends: the exit timer, the 'close' event, or an uncancelable Escape */
    function finish() {
      if (done) return; done = true; clearTimeout(closeTm); if (unfit) unfit(); lockPage(false);
      if (dlg.open) dlg.close();
      dlg.remove();
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
      if (o.onClose) o.onClose();
    }
    dlg.addEventListener('close', finish);
    api.open = function (focusEl) {
      dlg.dataset.state = 'closed'; dlg.showModal(); lockPage(true); unfit = fitKeyboard(dlg);
      /* commit the closed pose (a style read forces it), then transition to open. No rAF: it stalls in a background tab. */
      void getComputedStyle(dlg).transform; void getComputedStyle(dlg, '::backdrop').opacity; dlg.dataset.state = 'open';
      api.focus(focusEl);
    };
    /* modals take focus: the first field on a pointer device; the heading on touch, so the keyboard does not jump up */
    api.focus = function (el) {
      var h = dlg.querySelector('.fm-h');
      if (el && !TOUCH) el.focus({ preventScroll: true }); else if (h) h.focus({ preventScroll: true }); else dlg.focus();
    };
    return api;
  }

  function errBox(id) { return '<p class="fm-err" id="' + id + '" hidden>' + ICON_ERR + '<span></span></p>'; }
  function setErr(input, box, msg) {
    if (box) { box.hidden = !msg; box.querySelector('span').textContent = msg || ''; }
    if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }
  function setBusy(btn, on, text) {
    if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = text; }
    else { btn.disabled = false; btn.removeAttribute('aria-busy'); if (btn.dataset.label) btn.textContent = btn.dataset.label; }
  }

  /* ================= sign-in: email, then six digits ================= */
  var signInRun = null;
  function signIn() { return emailStep({}); }
  function emailStep(o) {
    var s = store.session(); if (s) return Promise.resolve({ handle: s.handle, email: s.email });
    if (signInRun) return signInRun;
    signInRun = new Promise(function (resolve) {
      var result = null, cool = 0, email = '', sh = sheet({ onClose: function () { clearInterval(cool); signInRun = null; resolve(result); } });
      var id = sh.id;
      sh.label(o.label || 'Sign in');
      sh.body.innerHTML =
        '<h2 class="fm-h" id="' + id + '-h" tabindex="-1"></h2><p class="fm-p" id="' + id + '-p"></p>' +
        '<form class="fm-form" data-step="email" novalidate>' +
          '<div class="fm-f"><label class="fm-l" for="' + id + '-em">Email</label>' +
          '<input class="fm-i" id="' + id + '-em" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="send" placeholder="you@example.com" aria-describedby="' + id + '-ee">' +
          errBox(id + '-ee') + '</div>' +
          '<button class="fm-b g wide" type="submit">Send code</button>' +
        '</form>' +
        '<form class="fm-form" data-step="code" hidden novalidate>' +
          '<fieldset class="fm-code" id="' + id + '-cd" aria-describedby="' + id + '-ce"><legend class="fm-vh">Six-digit code</legend>' +
          [0, 1, 2, 3, 4, 5].map(function (i) { return '<input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="' + (i ? 'off' : 'one-time-code') + '" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Digit ' + (i + 1) + ' of 6" data-1p-ignore data-lpignore="true">'; }).join('') +
          '</fieldset>' + errBox(id + '-ce') +
          '<p class="fm-vh" role="status" id="' + id + '-st"></p>' +
          '<button class="fm-b g wide" type="submit">' + (o.verb || 'Sign in') + '</button>' +
          '<div class="fm-act"><button class="fm-t" type="button" data-resend disabled></button><span aria-hidden="true">&nbsp;</span><button class="fm-t" type="button" data-back>Use a different email</button></div>' +
        '</form>';
      var h = sh.body.querySelector('.fm-h'), p = sh.body.querySelector('.fm-p');
      var fe = sh.body.querySelector('[data-step="email"]'), fc = sh.body.querySelector('[data-step="code"]');
      var em = fe.email, ee = sh.body.querySelector('#' + id + '-ee'), eBtn = fe.querySelector('[type="submit"]');
      var ins = Array.prototype.slice.call(fc.querySelectorAll('input')), ce = sh.body.querySelector('#' + id + '-ce'), cBtn = fc.querySelector('[type="submit"]');
      var resend = fc.querySelector('[data-resend]'), status = sh.body.querySelector('#' + id + '-st');

      function show(step) {
        fe.hidden = step !== 'email'; fc.hidden = step !== 'code';
        if (step === 'email') { h.textContent = o.title || 'Sign in with your email'; p.innerHTML = esc(o.reason ? o.reason + ' ' : '') + 'We email you a six-digit code. No password.'; }
        else { h.textContent = 'Enter the code'; p.innerHTML = 'We sent a six-digit code to <b>' + esc(email) + '</b>.'; ins.forEach(function (x) { x.value = ''; x.removeAttribute('aria-invalid'); }); setErr(null, ce, ''); startCool(); }
      }
      function startCool() {
        clearInterval(cool); var sent = store.codeSent(), end = (sent ? sent.at : Date.now()) + RESEND_S * 1000;
        var tick = function () { var n = Math.ceil((end - Date.now()) / 1000); resend.disabled = n > 0; resend.textContent = n > 0 ? 'Send a new code in ' + n + ' s' : 'Send a new code'; if (n <= 0) clearInterval(cool); };
        tick(); cool = setInterval(tick, 1000);
      }
      /* email: checked on submit and on blur; once wrong, it clears the moment it is right */
      function checkEmail() { var v = em.value.trim(); var m = !v ? 'Enter your email so we can send the code.' : emailOK(v) ? '' : 'Check the email. It needs an @ and a domain.'; setErr(em, ee, m); return !m; }
      em.addEventListener('blur', function () { if (em.value.trim()) checkEmail(); });
      em.addEventListener('input', function () { if (em.getAttribute('aria-invalid')) checkEmail(); });
      fe.addEventListener('submit', function (e) {
        e.preventDefault(); if (sh.busy) return;
        if (!checkEmail()) { em.focus(); return; }
        sh.busy = true; setBusy(eBtn, true, 'Sending code…'); em.readOnly = true;
        email = em.value.trim();
        store.sendCode(email).then(function () {
          sh.busy = false; setBusy(eBtn, false); em.readOnly = false; if (!sh.el.open) return;
          show('code'); ins[0].focus();
        });
      });
      /* code: one digit per box, auto-advance; a paste or the keyboard's suggested code fills all six */
      var code = function () { return ins.map(function (x) { return x.value; }).join(''); };
      function fill(from, digits) { digits.slice(0, 6 - from).split('').forEach(function (ch, k) { ins[from + k].value = ch; }); ins[Math.min(5, from + digits.length)].focus(); }
      function verify() {
        if (sh.busy) return;
        if (code().length < 6) { ins.forEach(function (x) { if (!x.value) x.setAttribute('aria-invalid', 'true'); }); setErr(null, ce, 'Enter all six digits from the email.'); (ins.find(function (x) { return !x.value; }) || ins[0]).focus(); return; }
        sh.busy = true; ins.forEach(function (x) { x.readOnly = true; }); fc.querySelector('.fm-code').setAttribute('aria-busy', 'true'); setBusy(cBtn, true, 'Checking code…');
        store.verifyCode(email, code()).then(function (r) {
          sh.busy = false; ins.forEach(function (x) { x.readOnly = false; }); fc.querySelector('.fm-code').removeAttribute('aria-busy'); setBusy(cBtn, false);
          if (!r.ok) { ins.forEach(function (x) { x.value = ''; x.setAttribute('aria-invalid', 'true'); }); setErr(null, ce, 'That code does not match. Check the email and try again, or send a new code.'); ins[0].focus(); return; }
          result = { handle: r.session.handle, email: r.session.email }; emit(); sh.close();
        });
      }
      ins.forEach(function (inp, i) {
        inp.addEventListener('input', function () {
          if (sh.busy) return;
          var d = inp.value.replace(/\D/g, ''); ins.forEach(function (x) { x.removeAttribute('aria-invalid'); }); setErr(null, ce, '');
          if (d.length > 1) fill(i, d); else { inp.value = d; if (d && i < 5) ins[i + 1].focus(); }
          if (code().length === 6) verify();
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Backspace' && !inp.value && i > 0) { e.preventDefault(); ins[i - 1].value = ''; ins[i - 1].focus(); }
          else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); ins[i - 1].focus(); }
          else if (e.key === 'ArrowRight' && i < 5) { e.preventDefault(); ins[i + 1].focus(); }
        });
        inp.addEventListener('paste', function (e) {
          var d = ((e.clipboardData && e.clipboardData.getData('text')) || '').replace(/\D/g, ''); if (!d) return;
          e.preventDefault(); if (sh.busy) return; ins.forEach(function (x) { x.removeAttribute('aria-invalid'); }); setErr(null, ce, '');
          fill(d.length >= 6 ? 0 : i, d); if (code().length === 6) verify();
        });
        inp.addEventListener('focus', function () { inp.select(); });
      });
      fc.addEventListener('submit', function (e) { e.preventDefault(); verify(); });
      resend.addEventListener('click', function () {
        if (sh.busy || resend.disabled) return; resend.disabled = true;
        store.sendCode(email).then(function () { if (!sh.el.open) return; ins.forEach(function (x) { x.value = ''; x.removeAttribute('aria-invalid'); }); setErr(null, ce, ''); status.textContent = 'We sent a new code to ' + email + '.'; startCool(); ins[0].focus(); });
      });
      fc.querySelector('[data-back]').addEventListener('click', function () { if (sh.busy) return; clearInterval(cool); store.forgetCode(); show('email'); em.focus(); em.select(); });

      /* a code sent in the last ten minutes picks up where the person left off */
      var sent = store.codeSent();
      if (sent && Date.now() - sent.at < 600000) { email = sent.email; em.value = email; show('code'); sh.open(ins[0]); }
      else { em.value = store.lastEmail() || ''; show('email'); sh.open(em); }
    });
    return signInRun;
  }

  function ensureVoter() {
    var s = store.session(); if (s && s.voter) return Promise.resolve(true);
    return emailStep({ label: 'Vote', title: 'Confirm your email to vote', reason: 'One vote per project, so we need an email.', verb: 'Confirm email' }).then(function (r) { return !!r; });
  }

  /* ================= submit ================= */
  var submitRun = null;
  function submit(o) {
    o = o || {};
    if (submitRun) return submitRun;
    submitRun = signIn().then(function (who) {
      if (!who) return null;
      return new Promise(function (resolve) { submitSheet(o, who, resolve); });
    }).then(function (r) { submitRun = null; return r; });
    return submitRun;
  }
  function submitSheet(o, who, resolve) {
    var mine = store.entryFor(who.handle), edit = !!mine, saved = null, picFile = null, picKeep = !!(mine && mine.picture), picURL = '';
    var city = edit ? mine.city : o.city, cityName = edit ? (mine.cityName || cityLabel(mine.city)) : (o.cityName || cityLabel(o.city));
    var deadline = edit ? (mine.deadline || o.deadline) : o.deadline, until = deadline ? utc(deadline) : '';
    var sh = sheet({ wide: true, onClose: function () { if (picURL) URL.revokeObjectURL(picURL); resolve(saved); } }), id = sh.id;
    var otherCity = edit && o.city && mine.city !== o.city;
    sh.label(cityName ? 'Entry · ' + cityName : 'Entry');

    var field = function (n, label, input, hint) { return '<div class="fm-f"><label class="fm-l" for="' + id + '-' + n + '"><span>' + label + '</span>' + (hint || '') + '</label>' + input + errBox(id + '-e-' + n) + '</div>'; };
    var attrs = function (n, extra) { return 'class="fm-i" id="' + id + '-' + n + '" name="' + n + '" aria-describedby="' + id + '-e-' + n + '" ' + extra; };
    sh.body.innerHTML =
      '<h2 class="fm-h" id="' + id + '-h" tabindex="-1">' + (edit ? 'Edit your project' : 'Submit your project') + '</h2>' +
      '<p class="fm-p">' + (otherCity ? 'You already have an entry in ' + esc(cityName) + '. One entry per person, so this edits it. ' : '') +
        'Entering as <b>@' + esc(who.handle) + '</b>. One entry per person.' + (until ? ' You can edit it until ' + until + '.' : '') + '</p>' +
      '<form class="fm-form" novalidate>' +
        field('name', 'Project name', '<input ' + attrs('name', 'type="text" maxlength="40" autocomplete="off" spellcheck="false" enterkeyhint="next"') + '>') +
        field('pitch', 'One-line pitch', '<input ' + attrs('pitch', 'type="text" maxlength="100" autocomplete="off" spellcheck="true" enterkeyhint="next"') + '>', '<span class="fm-ct" id="' + id + '-ct" aria-hidden="true">0/100</span>') +
        field('repo', 'GitHub repo', '<input ' + attrs('repo', 'type="url" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://github.com/you/project" enterkeyhint="next"') + '>') +
        field('demo', 'Demo link', '<input ' + attrs('demo', 'type="url" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://" enterkeyhint="next"') + '>', '<small>Optional</small>') +
        field('video', 'Video link', '<input ' + attrs('video', 'type="url" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://" enterkeyhint="next"') + '>', '<small>Optional</small>') +
        '<div class="fm-f"><span class="fm-l" id="' + id + '-pl"><span>Picture</span><small>Optional</small></span><div class="fm-picrow">' +
          '<label class="fm-pic" data-pic><input type="file" name="picture" accept="image/jpeg,image/png,image/webp" aria-labelledby="' + id + '-pl" aria-describedby="' + id + '-ph ' + id + '-e-picture">' +
          '<span class="fm-pic-t" data-pic-t><b>Add a picture</b><span>Drop it here or choose a file</span></span></label>' +
          '<div class="fm-pic-side"><p class="fm-note" id="' + id + '-ph">Shown at 16:9 in the list and on your project page. JPEG, PNG or WebP, up to 5\u00a0MB.</p>' +
          '<div class="fm-pic-a" data-pic-a hidden><button class="fm-t" type="button" data-pic-change>Change picture</button><button class="fm-t" type="button" data-pic-remove>Remove picture</button></div></div></div>' +
          errBox(id + '-e-picture') + '</div>' +
        '<div class="fm-f"><label class="fm-chk"><input type="checkbox" name="rules" aria-describedby="' + id + '-e-rules"><span>I built this during the hackathon and I have read the rules.</span></label>' + errBox(id + '-e-rules') + '</div>' +
        '<div class="fm-act"><button class="fm-b g" type="submit">' + (edit ? 'Save changes' : 'Submit project') + '</button></div>' +
      '</form>';

    var form = sh.body.querySelector('form'), btn = form.querySelector('[type="submit"]'), ct = sh.body.querySelector('#' + id + '-ct');
    var pic = form.querySelector('[data-pic]'), picT = form.querySelector('[data-pic-t]'), picA = form.querySelector('[data-pic-a]'), fileIn = form.picture;
    var box = function (n) { return sh.body.querySelector('#' + id + '-e-' + n); };
    var V = {
      name: function (v) { return v.trim() ? '' : 'Add a project name.'; },
      pitch: function (v) { return v.trim() ? '' : 'Add a one-line pitch. Say what it does in one sentence.'; },
      repo: function (v) { return !v.trim() ? 'Add the link to the GitHub repo.' : githubOK(v) ? '' : 'Use the GitHub link to the repo, like https://github.com/you/project.'; },
      demo: function (v) { return !v.trim() || urlOK(v) ? '' : 'Check the demo link. Use a full address, like https://demo.example.com.'; },
      video: function (v) { return !v.trim() || urlOK(v) ? '' : 'Check the video link. Use a full address, like https://youtu.be/abc123.'; },
      rules: function (v) { return v ? '' : 'Check the box to confirm you built this during the hackathon and read the rules.'; }
    };
    var shown = {};
    function check(n) { var el = form.elements[n], m = V[n](el.type === 'checkbox' ? el.checked : el.value); setErr(el, box(n), m); shown[n] = !!m; return !m; }
    function count() { var n = form.pitch.value.length; ct.textContent = n + '/100'; ct.classList.toggle('is-full', n >= 100); }
    form.addEventListener('focusout', function (e) { var n = e.target.name; if (V[n] && e.target.type !== 'checkbox' && (e.target.value.trim() || shown[n])) check(n); });
    form.addEventListener('input', function (e) { var n = e.target.name; if (n === 'pitch') count(); if (shown[n]) check(n); });
    form.addEventListener('change', function (e) { if (e.target.name === 'rules' && shown.rules) check('rules'); });

    /* the picture */
    function showPic(src) {
      var img = pic.querySelector('img'); if (!src) { if (img) img.remove(); pic.classList.remove('has-img'); picT.hidden = false; picA.hidden = true; return; }
      if (!img) { img = document.createElement('img'); img.alt = 'Picture preview'; pic.insertBefore(img, picT); }
      img.src = src; pic.classList.add('has-img'); picT.hidden = true; picA.hidden = false;
    }
    function takeFile(f) {
      if (!f) return;
      var m = PIC_TYPES.indexOf(f.type) < 0 ? 'Use a JPEG, PNG or WebP picture.' : f.size > MAX_PIC ? 'That picture is ' + (f.size / 1048576).toFixed(1) + ' MB. Use one under 5 MB.' : '';
      setErr(fileIn, box('picture'), m); if (m) { fileIn.value = ''; return; }
      if (picURL) URL.revokeObjectURL(picURL); picURL = URL.createObjectURL(f); picFile = f; picKeep = false; showPic(picURL);
    }
    fileIn.addEventListener('change', function () { takeFile(fileIn.files && fileIn.files[0]); });
    pic.addEventListener('dragover', function (e) { e.preventDefault(); pic.classList.add('is-over'); });
    pic.addEventListener('dragleave', function () { pic.classList.remove('is-over'); });
    pic.addEventListener('drop', function (e) { e.preventDefault(); pic.classList.remove('is-over'); takeFile(e.dataTransfer.files && e.dataTransfer.files[0]); });
    form.querySelector('[data-pic-change]').addEventListener('click', function () { fileIn.click(); });
    form.querySelector('[data-pic-remove]').addEventListener('click', function () { picFile = null; picKeep = false; fileIn.value = ''; if (picURL) URL.revokeObjectURL(picURL); picURL = ''; setErr(fileIn, box('picture'), ''); showPic(null); fileIn.focus(); });

    if (edit) {
      form.name.value = mine.name || ''; form.pitch.value = mine.pitch || ''; form.repo.value = mine.repo || ''; form.demo.value = mine.demo || ''; form.video.value = mine.video || ''; form.rules.checked = true;
      if (mine.picture) showPic(mine.picture);
    }
    count();

    form.addEventListener('submit', function (e) {
      e.preventDefault(); if (sh.busy) return;
      var first = null; Object.keys(V).forEach(function (n) { if (!check(n) && !first) first = form.elements[n]; });
      if (fileIn.getAttribute('aria-invalid') && !first) first = fileIn;
      if (first) { first.focus(); return; }
      if (deadline && Date.now() > new Date(deadline).getTime()) {
        sh.body.querySelector('.fm-p').textContent = 'Submissions for ' + cityName + ' closed at ' + until + '. Your entry was not saved.';
        sh.body.querySelector('.fm-h').focus(); btn.disabled = true; return;
      }
      sh.busy = true; setBusy(btn, true, edit ? 'Saving changes…' : 'Submitting project…');
      var fields = { name: form.name.value.trim(), pitch: form.pitch.value.trim(), repo: withScheme(form.repo.value), demo: form.demo.value.trim() ? withScheme(form.demo.value) : '', video: form.video.value.trim() ? withScheme(form.video.value) : '',
        city: city || '', cityName: cityName || '', deadline: deadline ? new Date(deadline).toISOString() : '' };
      store.saveEntry(who.handle, fields, picFile, picKeep).then(function (entry) {
        sh.busy = false; saved = entry; emit(); if (!sh.el.open) return; doneView(entry);
      });
    });

    function doneView(entry) {
      sh.label(edit ? 'Saved' : 'Submitted');
      sh.body.innerHTML =
        '<h2 class="fm-h" id="' + id + '-h" tabindex="-1">' + (edit ? 'Changes saved.' : esc(entry.name) + ' is in.') + '</h2>' +
        '<p class="fm-p" role="status">' + (edit ? 'Your entry is up to date' : 'Your entry is in the ' + esc(cityName || 'city') + ' list') + (until ? '. You can edit it until ' + until + '.' : '.') + '</p>' +
        '<div class="fm-done"><div class="fm-act"><button class="fm-b g" type="button" data-share>Share entry</button><button class="fm-b" type="button" data-again>Edit entry</button><button class="fm-b" type="button" data-close>Done</button></div></div>';
      sh.body.querySelector('[data-share]').addEventListener('click', function () { share(projectOf(entry)); });
      sh.body.querySelector('[data-again]').addEventListener('click', function () { sh.close(); setTimeout(function () { submit(o); }, token('--dur-panel-exit')); });
      sh.body.querySelector('.fm-h').focus();
    }
    sh.open(form.name);
  }
  function projectOf(e) { return { name: e.name, pitch: e.pitch, handle: e.handle, city: e.city, cityName: e.cityName, slug: e.slug }; }

  /* ================= remind me ================= */
  function remind(o) {
    o = o || {};
    return new Promise(function (resolve) {
      var ok = false, s = store.session(), cityName = o.cityName || cityLabel(o.city), already = store.reminders()[o.city];
      var sh = sheet({ onClose: function () { resolve(ok); } }), id = sh.id, when = o.when ? utc(o.when) : '';
      sh.label('Remind me');
      sh.body.innerHTML =
        '<h2 class="fm-h" id="' + id + '-h" tabindex="-1">' + esc(cityName) + (when ? ' starts at ' + when + '.' : ' starts soon.') + '</h2>' +
        '<p class="fm-p">We will email you when ' + esc(cityName) + ' starts.' + (already ? ' You are already on the list as <b>' + esc(already) + '</b>.' : '') + '</p>' +
        '<form class="fm-form" novalidate><div class="fm-f"><label class="fm-l" for="' + id + '-em">Email</label>' +
        '<input class="fm-i" id="' + id + '-em" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="send" placeholder="you@example.com" aria-describedby="' + id + '-ee">' +
        errBox(id + '-ee') + '</div><button class="fm-b g wide" type="submit">Remind me</button></form>';
      var form = sh.body.querySelector('form'), em = form.email, ee = sh.body.querySelector('#' + id + '-ee'), btn = form.querySelector('[type="submit"]');
      em.value = (s && s.email) || already || store.lastEmail() || '';
      function checkEmail() { var v = em.value.trim(); var m = !v ? 'Enter your email so we can remind you.' : emailOK(v) ? '' : 'Check the email. It needs an @ and a domain.'; setErr(em, ee, m); return !m; }
      em.addEventListener('blur', function () { if (em.value.trim()) checkEmail(); });
      em.addEventListener('input', function () { if (em.getAttribute('aria-invalid')) checkEmail(); });
      form.addEventListener('submit', function (e) {
        e.preventDefault(); if (sh.busy) return; if (!checkEmail()) { em.focus(); return; }
        sh.busy = true; setBusy(btn, true, 'Saving reminder…'); em.readOnly = true;
        var addr = em.value.trim();
        store.remind(addr, o.city).then(function () {
          sh.busy = false; ok = true; emit(); if (!sh.el.open) return;
          sh.body.innerHTML = '<h2 class="fm-h" id="' + id + '-h" tabindex="-1">You are on the list.</h2>' +
            '<p class="fm-p" role="status">We will email <b>' + esc(addr) + '</b> when ' + esc(cityName) + ' starts' + (when ? ' at ' + when : '') + '.</p>' +
            '<div class="fm-done"><div class="fm-act"><button class="fm-b" type="button" data-close>Done</button></div></div>';
          sh.body.querySelector('.fm-h').focus();
        });
      });
      sh.open(em);
    });
  }

  /* ================= share ================= */
  function projectURL(p) { return p.url || 'https://supabase.com/hackathon/p/' + (p.slug || slugOf(p.name)); }
  function shareText(p) {
    var me = snapshot().handle && p.handle === snapshot().handle, where = p.cityName || cityLabel(p.city);
    if (p.rank) return p.name + ' is ' + ordinal(p.rank) + ' in ' + where + ' at the Supabase Hackathon' + (p.votes != null ? ', with ' + votes(p.votes) : '') + '.';
    return me ? 'I built ' + p.name + ' at the Supabase Hackathon in ' + where + '.' : p.name + ', built at the Supabase Hackathon in ' + where + '.';
  }
  function share(p) {
    p = p || {};
    return new Promise(function (resolve) {
      var url = projectURL(p), card = cardSVG(p), cardURL = URL.createObjectURL(new Blob([card], { type: 'image/svg+xml' })), copyTm = 0;
      var sh = sheet({ wide: true, onClose: function () { clearTimeout(copyTm); URL.revokeObjectURL(cardURL); resolve(); } }), id = sh.id;
      var x = 'https://x.com/intent/post?text=' + encodeURIComponent(shareText(p)) + '&url=' + encodeURIComponent(url);
      sh.label('Share');
      sh.body.innerHTML =
        '<h2 class="fm-h" id="' + id + '-h" tabindex="-1">Share ' + esc(p.name || 'this project') + '</h2>' +
        (p.pitch ? '<p class="fm-p">' + esc(p.pitch) + '</p>' : '') +
        '<img class="fm-card" src="' + cardURL + '" alt="Share card: ' + esc(p.name) + ', ' + esc(p.cityName || cityLabel(p.city)) + (p.rank ? ', ' + ordinal(p.rank) : '') + (p.votes != null ? ', ' + votes(p.votes) : '') + '." width="1200" height="630">' +
        '<div class="fm-share">' +
          '<a class="fm-b g" href="' + esc(x) + '" target="_blank" rel="noopener">Share on X ' + ICON_OUT + '</a>' +
          '<button class="fm-b" type="button" data-copy aria-live="polite">Copy link</button>' +
          '<button class="fm-b" type="button" data-svg>Download share card</button>' +
        '</div><p class="fm-url">' + esc(url.replace(/^https:\/\//, '')) + '</p>';
      var copy = sh.body.querySelector('[data-copy]');
      copy.addEventListener('click', function () {
        var done = function (ok) { copy.textContent = ok ? 'Link copied' : 'Copy failed. Select the link below.'; clearTimeout(copyTm); copyTm = setTimeout(function () { copy.textContent = 'Copy link'; }, token('--dur-flash')); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(fallbackCopy(url)); });
        else done(fallbackCopy(url));
      });
      sh.body.querySelector('[data-svg]').addEventListener('click', function () {
        var a = document.createElement('a'); a.href = cardURL; a.download = 'supabase-hackathon-' + (p.slug || slugOf(p.name)) + '.svg';
        document.body.appendChild(a); a.click(); a.remove();
      });
      sh.open(sh.body.querySelector('.fm-share a'));
    });
  }
  function fallbackCopy(text) {
    var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    var host = document.querySelector('dialog[open]') || document.body; host.appendChild(t); t.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} t.remove(); return ok;
  }

  /* the share card: 1200×630, on the night ground, drawn as one standalone SVG file. Colours come from the --fm-card-*
     tokens in forms.css, turned into hex so any viewer can open the file. */
  function hexOf(css) {
    var c = document.createElement('canvas'); c.width = c.height = 1; var x = c.getContext('2d'); x.fillStyle = 'transparent'; x.fillStyle = css; x.fillRect(0, 0, 1, 1);
    var d = x.getImageData(0, 0, 1, 1).data, h = function (n) { return n.toString(16).padStart(2, '0'); };
    return '#' + h(d[0]) + h(d[1]) + h(d[2]) + (d[3] < 255 ? h(d[3]) : '');
  }
  function cardColours() {
    var cs = getComputedStyle(document.documentElement), g = function (n) { return hexOf(cs.getPropertyValue(n).trim()); };
    return { ground: g('--fm-card-ground'), ink: g('--fm-card-ink'), ink2: g('--fm-card-ink-2'), line: g('--fm-card-line'), green: g('--fm-card-green') };
  }
  function wrap(text, size, maxW, maxLines) {
    var cw = size * 0.52, per = Math.max(4, Math.floor(maxW / cw)), words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (t.length > per && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
    return lines.map(function (l) { return l.length > per ? l.slice(0, per - 1) + '…' : l; });
  }
  function cardSVG(p) {
    var C = cardColours(), W = 1200, H = 630, M = 56, where = p.cityName || cityLabel(p.city), name = p.name || 'Untitled';
    /* the name as large as it fits: one or two lines, a size step down until nothing is cut */
    var size, lines, sizes = [112, 96, 80, 64, 56];
    for (var si = 0; si < sizes.length; si++) { size = sizes[si]; lines = wrap(name, size, 780, 2); if (lines.join(' ').slice(-1) !== '…' || si === sizes.length - 1) break; }
    var mono = "font-family=\"'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace\" font-weight=\"500\" letter-spacing=\"0.9\"";
    var sans = "font-family=\"Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif\"";
    var o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">');
    o.push('<title>' + esc(name) + ' · Supabase Hackathon ' + esc(where) + '</title>');
    o.push('<rect width="' + W + '" height="' + H + '" fill="' + C.ground + '"/>');
    /* the drawing's grid: columns every 100, a frame, a title-block rule */
    var g = []; for (var gx = M + 100; gx < W - M; gx += 100) g.push('M' + gx + ' ' + M + 'V' + (H - M));
    o.push('<path d="' + g.join('') + '" stroke="' + C.line + '" stroke-width="1" fill="none"/>');
    o.push('<rect x="' + M + '.5" y="' + M + '.5" width="' + (W - 2 * M - 1) + '" height="' + (H - 2 * M - 1) + '" stroke="' + C.ink2 + '" stroke-opacity="0.5" stroke-width="1" fill="none"/>');
    o.push('<path d="M' + M + ' ' + (H - M - 72) + 'H' + (W - M) + '" stroke="' + C.ink2 + '" stroke-opacity="0.5" stroke-width="1"/>');
    o.push('<text x="' + (M + 24) + '" y="' + (M + 40) + '" fill="' + C.ink2 + '" ' + mono + ' font-size="15">SUPABASE HACKATHON · ' + esc(where.toUpperCase()) + '</text>');
    var top = M + 40 + 40 + size * 0.9;
    lines.forEach(function (l, i) { o.push('<text x="' + (M + 20) + '" y="' + Math.round(top + i * size * 1.02) + '" fill="' + C.ink + '" ' + sans + ' font-weight="400" font-size="' + size + '" letter-spacing="' + (-size * 0.03).toFixed(1) + '">' + esc(l) + '</text>'); });
    if (p.pitch) { var pl = wrap(p.pitch, 26, 700, 2), py = Math.round(top + (lines.length - 1) * size * 1.02 + 56); pl.forEach(function (l, i) { o.push('<text x="' + (M + 24) + '" y="' + (py + i * 36) + '" fill="' + C.ink2 + '" ' + sans + ' font-size="26">' + esc(l) + '</text>'); }); }
    /* the title block along the bottom: handle, rank, votes */
    var by = H - M - 28, cells = [];
    if (p.handle) cells.push(['BY', '@' + p.handle]);
    if (p.rank) cells.push(['RANK', ordinal(p.rank)]);
    if (p.votes != null) cells.push(['VOTES', Number(p.votes).toLocaleString('en-US')]);
    cells.forEach(function (c, i) {
      var cx = M + 24 + i * 240;
      if (i) o.push('<path d="M' + (cx - 24) + ' ' + (H - M - 72) + 'V' + (H - M) + '" stroke="' + C.ink2 + '" stroke-opacity="0.5" stroke-width="1"/>');
      o.push('<text x="' + cx + '" y="' + (by - 18) + '" fill="' + C.ink2 + '" ' + mono + ' font-size="12">' + c[0] + '</text>');
      o.push('<text x="' + cx + '" y="' + (by + 10) + '" fill="' + (c[0] === 'RANK' && p.rank === 1 ? C.green : C.ink) + '" ' + sans + ' font-weight="500" font-size="24">' + esc(c[1]) + '</text>');
    });
    o.push('<text x="' + (W - M - 24) + '" y="' + (by + 10) + '" text-anchor="end" fill="' + C.ink2 + '" ' + sans + ' font-size="20">' + esc(projectURL(p).replace(/^https:\/\//, '')) + '</text>');
    /* the city's seal, top right */
    if (window.SEAL && p.city) {
      try {
        var s = window.SEAL.forCity(p.city, { size: 200 }).replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
        o.push('<g transform="translate(' + (W - M - 24 - 200) + ' ' + (M + 24) + ')"><svg x="0" y="0" width="200" height="200" viewBox="-100 -100 200 200" fill="none" stroke="' + (p.rank === 1 ? C.green : C.ink) + '" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">' + s + '</svg></g>');
      } catch (e) { /* no seal: the card still reads */ }
    }
    o.push('</svg>');
    return o.join('');
  }

  /* ================= the API ================= */
  window.FORMS = Object.freeze({
    signIn: signIn,
    ensureVoter: ensureVoter,
    submit: submit,
    remind: remind,
    share: share,
    signOut: function () { return store.signOut().then(emit); },
    get state() { return snapshot(); },
    on: function (ev, fn) { if (ev === 'change' && typeof fn === 'function' && subs.indexOf(fn) < 0) subs.push(fn); },
    off: function (ev, fn) { if (ev === 'change') subs = subs.filter(function (f) { return f !== fn; }); },
    /* for the lab: forget everything this layer stored */
    _reset: function () { store.reset(); emit(); }
  });
})();
