/*
 * Arcade shared runtime: storage, synth sound effects, game shell (HUD,
 * start / game-over overlay, pause, fullscreen), canvas helpers and a
 * tiny particle system. Classic script (no modules) so every game also
 * works when opened straight from disk.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------ storage */
  var PREFIX = "ubg:";
  var store = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem(PREFIX + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* private mode */ }
    }
  };

  /* -------------------------------------------------------------- audio */
  var actx = null, master = null, muted = store.get("muted", false);
  function ac() {
    if (!actx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      actx = new C();
      master = actx.createGain();
      master.gain.value = muted ? 0 : 0.45;
      master.connect(actx.destination);
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function tone(freq, dur, type, vol, slide, delay) {
    var c = ac(); if (!c || muted) return;
    dur = dur || 0.1; vol = vol == null ? 0.2 : vol;
    var t = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  var noiseBuf = null;
  function noise(dur, vol, cutoff, delay) {
    var c = ac(); if (!c || muted) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t = c.currentTime + (delay || 0);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf;
    f.type = "lowpass"; f.frequency.value = cutoff || 1200;
    g.gain.setValueAtTime(vol == null ? 0.3 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + (dur || 0.2));
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + (dur || 0.2) + 0.05);
  }
  var sfx = {
    tone: tone,
    noise: noise,
    click: function () { tone(1400, 0.03, "square", 0.05); },
    blip: function (p) { tone(520 * (p || 1), 0.07, "square", 0.09); },
    coin: function (p) { p = p || 1; tone(880 * p, 0.07, "square", 0.09); tone(1320 * p, 0.12, "square", 0.09, 0, 0.06); },
    jump: function () { tone(260, 0.14, "triangle", 0.18, 420); },
    shoot: function () { tone(900, 0.06, "square", 0.04, -500); },
    hit: function () { noise(0.12, 0.25, 900); tone(160, 0.15, "sawtooth", 0.1, -90); },
    boom: function () { noise(0.6, 0.45, 500); tone(90, 0.5, "sine", 0.35, -60); },
    power: function () { for (var i = 0; i < 4; i++) tone(440 * Math.pow(1.26, i), 0.1, "square", 0.07, 0, i * 0.06); },
    levelup: function () { var n = [523, 659, 784, 1047]; for (var i = 0; i < n.length; i++) tone(n[i], 0.14, "triangle", 0.16, 0, i * 0.07); },
    over: function () { for (var i = 0; i < 3; i++) tone(330 / Math.pow(1.3, i), 0.28, "triangle", 0.18, 0, i * 0.17); }
  };

  /* -------------------------------------------------------------- utils */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  var ICON = {
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
  };
  var params = new URLSearchParams(location.search);

  function fmt(n) { return Math.floor(n).toLocaleString(); }

  function popup(text, x, y, color, size) {
    var p = el("div", "ub-popup", text);
    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.color = color || "#fff";
    if (size) p.style.fontSize = size + "px";
    document.body.appendChild(p);
    setTimeout(function () { p.remove(); }, 950);
  }

  /* -------------------------------------------------------------- shell */
  /**
   * opts: { id, title, howto (html), scoreLabel, onStart(), onPause(bool), pausable }
   * returns api: { playing, paused, setScore(n), addScore(n), score, gameOver(extraHtml), best }
   */
  function shell(opts) {
    var id = opts.id;
    var best = store.get("best:" + id, 0);
    var api = { playing: false, paused: false, score: 0, best: best };

    // HUD
    var hud = el("div", "ub-hud");
    var back = el("a", "ub-back", "&#9664; Arcade");
    back.href = "../../index.html";
    var title = el("div", "ub-title", opts.title);
    var spacer = el("div", "ub-spacer");
    var stats = el("div", "ub-stats");
    var scoreEl = el("div", "", (opts.scoreLabel || "SCORE") + "<b>0</b>");
    var bestEl = el("div", "ub-best", "BEST<b>" + fmt(best) + "</b>");
    stats.appendChild(scoreEl); stats.appendChild(bestEl);
    var pauseBtn = el("button", "ub-btn", ICON.pause); pauseBtn.title = "Pause (P)";
    var muteBtn = el("button", "ub-btn", muted ? ICON.mute : ICON.sound); muteBtn.title = "Sound (M)";
    var fsBtn = el("button", "ub-btn", ICON.full); fsBtn.title = "Fullscreen (F)";
    [back, title, spacer, stats].forEach(function (n) { hud.appendChild(n); });
    if (opts.pausable !== false) hud.appendChild(pauseBtn);
    hud.appendChild(muteBtn); hud.appendChild(fsBtn);
    document.body.appendChild(hud);

    var scoreB = scoreEl.querySelector("b"), bestB = bestEl.querySelector("b");

    // Overlay
    var overlay = el("div", "ub-overlay");
    var panel = el("div", "ub-panel");
    var h1 = el("h1", "", opts.title);
    var howto = el("p", "ub-howto", opts.howto || "");
    var result = el("div", "ub-result");
    var play = el("button", "ub-play", "PLAY");
    var hint = el("small", "ub-hint", "Press <b>Space</b> or <b>Enter</b>");
    [h1, result, howto, play, hint].forEach(function (n) { panel.appendChild(n); });
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    var pausedEl = el("div", "ub-paused", "<div>PAUSED<small>Press P or tap to resume</small></div>");
    document.body.appendChild(pausedEl);

    var lockUntil = 0;
    function start() {
      if (api.playing || performance.now() < lockUntil) return;
      ac(); sfx.click();
      overlay.classList.add("hidden");
      api.playing = true; api.paused = false;
      api.score = 0; scoreB.textContent = "0";
      store.set("plays:" + id, store.get("plays:" + id, 0) + 1);
      store.set("last:" + id, Date.now());
      opts.onStart && opts.onStart();
    }
    play.addEventListener("click", function (e) { e.stopPropagation(); start(); });
    overlay.addEventListener("pointerdown", function (e) { e.stopPropagation(); });

    function setPaused(p) {
      if (!api.playing || opts.pausable === false) return;
      if (api.paused === p) return;
      api.paused = p;
      pausedEl.classList.toggle("show", p);
      opts.onPause && opts.onPause(p);
    }
    pauseBtn.addEventListener("click", function (e) { e.stopPropagation(); setPaused(!api.paused); });
    pausedEl.addEventListener("pointerdown", function (e) { e.stopPropagation(); setPaused(false); });

    function toggleMute() {
      muted = !muted;
      store.set("muted", muted);
      if (master) master.gain.value = muted ? 0 : 0.45;
      muteBtn.innerHTML = muted ? ICON.mute : ICON.sound;
    }
    muteBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMute(); });

    function toggleFs() {
      var d = document;
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        var r = d.documentElement;
        (r.requestFullscreen || r.webkitRequestFullscreen || function () {}).call(r);
      } else {
        (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
      }
    }
    fsBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleFs(); });
    [pauseBtn, muteBtn, fsBtn, back].forEach(function (b) {
      b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    });

    window.addEventListener("keydown", function (e) {
      var k = e.key.toLowerCase();
      if (!api.playing && (k === " " || k === "enter")) { e.preventDefault(); e.stopImmediatePropagation(); start(); return; }
      if (k === "p" || k === "escape") setPaused(!api.paused);
      else if (k === "m") toggleMute();
      else if (k === "f") toggleFs();
      if (api.playing && (k === " " || k.indexOf("arrow") === 0)) e.preventDefault();
    });
    document.addEventListener("visibilitychange", function () { if (document.hidden) setPaused(true); });

    api.setScore = function (n) {
      if (n === api.score) return;
      api.score = n;
      scoreB.textContent = fmt(n);
    };
    api.addScore = function (n) { api.setScore(api.score + n); };
    api.setBestLive = function () {
      if (api.score > best) bestB.textContent = fmt(api.score);
    };
    api.gameOver = function (extraHtml) {
      if (!api.playing) return;
      api.playing = false; api.paused = false;
      pausedEl.classList.remove("show");
      var isNew = api.score > best;
      if (isNew) { best = api.score; api.best = best; store.set("best:" + id, best); bestB.textContent = fmt(best); }
      h1.textContent = "GAME OVER";
      result.innerHTML =
        '<div class="ub-label">' + (opts.scoreLabel || "SCORE") + "</div>" +
        '<div class="ub-big">' + fmt(api.score) + "</div>" +
        (isNew && api.score > 0 ? '<div class="ub-new">NEW BEST!</div>' : '<div class="ub-label" style="margin-top:8px">BEST ' + fmt(best) + "</div>") +
        (extraHtml || "");
      play.textContent = "PLAY AGAIN";
      lockUntil = performance.now() + 600;
      setTimeout(function () { overlay.classList.remove("hidden"); }, 650);
    };
    api.popup = popup;

    // ?autoplay starts immediately (used for thumbnails / quick restarts)
    if (params.has("autoplay")) setTimeout(start, 50);
    return api;
  }

  /* -------------------------------------------------------------- canvas */
  function fitCanvas(canvas, onResize) {
    var ctx = canvas.getContext("2d");
    var view = { w: 0, h: 0, dpr: 1, ctx: ctx };
    var ready = false;
    function resize() {
      view.dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.w = window.innerWidth;
      view.h = window.innerHeight;
      canvas.width = Math.round(view.w * view.dpr);
      canvas.height = Math.round(view.h * view.dpr);
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      if (ready && onResize) onResize(view);
    }
    window.addEventListener("resize", resize);
    resize();
    ready = true;
    return view;
  }

  function loop(fn) {
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fn(dt, now / 1000);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* glow sprite cache: a soft radial blob of a colour, drawn with "lighter" */
  var glowCache = {};
  function glow(color) {
    if (glowCache[color]) return glowCache[color];
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, color);
    grd.addColorStop(0.25, color);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 0.9;
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    glowCache[color] = c;
    return c;
  }

  /* ----------------------------------------------------------- particles */
  function Particles(max) {
    this.max = max || 600;
    this.list = [];
  }
  Particles.prototype.emit = function (x, y, o) {
    o = o || {};
    var n = o.n || 12;
    for (var i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      var a = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spread || Math.PI * 2) : Math.random() * Math.PI * 2;
      var s = (o.speed || 200) * (0.3 + Math.random() * 0.7);
      var life = (o.life || 0.6) * (0.5 + Math.random() * 0.5);
      this.list.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life, max: life, size: (o.size || 3) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : (o.color || "#fff"),
        g: o.gravity || 0, drag: o.drag == null ? 2 : o.drag
      });
    }
  };
  Particles.prototype.update = function (dt) {
    var l = this.list;
    for (var i = l.length - 1; i >= 0; i--) {
      var p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l[i] = l[l.length - 1]; l.pop(); continue; }
      var k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  };
  Particles.prototype.draw = function (ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i], t = p.life / p.max, s = p.size * (0.4 + t);
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();
  };
  Particles.prototype.clear = function () { this.list.length = 0; };

  /* screen shake helper */
  function Shake() { this.t = 0; this.mag = 0; this.x = 0; this.y = 0; }
  Shake.prototype.add = function (mag, t) { this.mag = Math.max(this.mag, mag); this.t = Math.max(this.t, t || 0.3); };
  Shake.prototype.update = function (dt) {
    if (this.t > 0) {
      this.t -= dt;
      var m = this.mag * Math.max(0, this.t) * 3;
      this.x = (Math.random() - 0.5) * m; this.y = (Math.random() - 0.5) * m;
      if (this.t <= 0) { this.mag = 0; this.x = this.y = 0; }
    }
  };

  window.Arcade = {
    store: store, sfx: sfx, shell: shell, fitCanvas: fitCanvas, loop: loop,
    glow: glow, Particles: Particles, Shake: Shake, popup: popup, fmt: fmt, params: params,
    rand: function (a, b) { return a + Math.random() * (b - a); },
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; }
  };
})();
