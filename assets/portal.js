(function () {
  "use strict";
  var GAMES = window.GAMES, CATS = window.CATEGORIES;

  function get(k, d) { try { var v = localStorage.getItem("ubg:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem("ubg:" + k, JSON.stringify(v)); } catch (e) { } }
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function url(g) { return "games/" + g.id + "/index.html"; }
  function thumb(g) { return "assets/thumbs/" + g.id + ".jpg"; }
  function fmt(n) { return Math.floor(n).toLocaleString(); }
  function ago(ts) {
    var s = (Date.now() - ts) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5 4.2 12.9a4.9 4.9 0 0 1 7-6.9l.8.8.8-.8a4.9 4.9 0 0 1 7 6.9Z"/></svg>';

  var favs = get("favs", []);

  /* ------------------------------------------------------------- hero */
  var hero = $("#hero"), featured = GAMES.filter(function (g) { return g.featured; }), heroI = 0, heroTimer = null;
  function buildHero() {
    var html = "";
    featured.forEach(function (g, i) {
      html += '<div class="slide' + (i === 0 ? " on" : "") + '"><img src="' + thumb(g) + '" alt="" loading="' + (i ? "lazy" : "eager") + '"></div>';
    });
    html += '<div class="info" id="heroInfo"></div><div class="dots">' +
      featured.map(function (g, i) { return '<button type="button" aria-label="Show ' + esc(g.title) + '" data-i="' + i + '"></button>'; }).join("") + "</div>";
    hero.innerHTML = html;
    hero.querySelectorAll(".dots button").forEach(function (b) {
      b.addEventListener("click", function () { showHero(+b.dataset.i); });
    });
    hero.addEventListener("mouseenter", function () { hero.classList.add("paused"); clearTimeout(heroTimer); });
    hero.addEventListener("mouseleave", function () { hero.classList.remove("paused"); schedule(); });
    showHero(0);
  }
  function schedule() { clearTimeout(heroTimer); heroTimer = setTimeout(function () { showHero((heroI + 1) % featured.length); }, 6000); }
  function showHero(i) {
    heroI = i;
    var g = featured[i];
    hero.querySelectorAll(".slide").forEach(function (s, k) { s.classList.toggle("on", k === i); });
    hero.querySelectorAll(".dots button").forEach(function (b, k) {
      b.classList.remove("on");
      if (k === i) { void b.offsetWidth; b.classList.add("on"); }
    });
    hero.style.setProperty("--c", g.color);
    var best = get("best:" + g.id, 0);
    $("#heroInfo").innerHTML =
      '<span class="badge hot">Featured</span> ' + (g.is3d ? '<span class="badge d3">3D</span>' : "") +
      "<h1>" + esc(g.title) + "</h1><p>" + esc(g.desc) + "</p>" +
      '<a class="play" href="' + url(g) + '">' + PLAY + "PLAY NOW</a>" +
      '<span class="meta"><span>' + esc(g.controls) + "</span>" + (best ? "<span>Best " + fmt(best) + "</span>" : "") + "</span>";
    if (!hero.classList.contains("paused")) schedule();
  }

  /* ------------------------------------------------------------ chips */
  var cat = get("cat", "all"), query = "";
  function counts(id) {
    if (id === "all") return GAMES.length;
    if (id === "favs") return favs.length;
    return GAMES.filter(function (g) { return g.cats.indexOf(id) >= 0; }).length;
  }
  function buildChips() {
    var list = CATS.slice();
    if (favs.length) list.splice(1, 0, { id: "favs", label: "♥ Favorites" });
    if (!list.some(function (c) { return c.id === cat; })) cat = "all";
    $("#chips").innerHTML = list.map(function (c) {
      return '<button type="button" role="tab" class="chip' + (c.id === cat ? " on" : "") + '" data-c="' + c.id + '">' + esc(c.label) + '<span class="n">' + counts(c.id) + "</span></button>";
    }).join("");
    $("#chips").querySelectorAll(".chip").forEach(function (b) {
      b.addEventListener("click", function () { cat = b.dataset.c; set("cat", cat); buildChips(); buildGrid(); });
    });
  }

  /* ------------------------------------------------------------- grid */
  function card(g, i) {
    var best = get("best:" + g.id, 0), plays = get("plays:" + g.id, 0), fav = favs.indexOf(g.id) >= 0;
    return '<a class="card" href="' + url(g) + '" style="--c:' + g.color + ";animation-delay:" + (i * 0.04) + 's">' +
      '<div class="thumb"><img src="' + thumb(g) + '" alt="" loading="lazy">' +
      '<div class="tags">' + (g.isNew ? '<span class="badge hot">New</span>' : "") + (g.is3d ? '<span class="badge d3">3D</span>' : "") + "</div>" +
      '<span class="playico">' + PLAY + "</span></div>" +
      '<button type="button" class="fav' + (fav ? " on" : "") + '" data-id="' + g.id + '" aria-label="Favorite ' + esc(g.title) + '" aria-pressed="' + fav + '">' + HEART + "</button>" +
      '<div class="body"><h3>' + esc(g.title) + '</h3><p class="tl">' + esc(g.tagline) + "</p>" +
      '<div class="foot2"><span>' + (plays ? plays + " play" + (plays > 1 ? "s" : "") : esc(g.controls)) + "</span>" +
      (best ? '<span class="best"><small>BEST</small>' + fmt(best) + "</span>" : "") + "</div></div></a>";
  }
  function buildGrid() {
    var q = query.trim().toLowerCase();
    var list = GAMES.filter(function (g) {
      if (cat === "favs" && favs.indexOf(g.id) < 0) return false;
      if (cat !== "all" && cat !== "favs" && g.cats.indexOf(cat) < 0) return false;
      if (q && (g.title + " " + g.tagline + " " + g.cats.join(" ")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var label = q ? 'Results for "' + query.trim() + '"' : (cat === "all" ? "All games" : cat === "favs" ? "Your favorites" : (CATS.filter(function (c) { return c.id === cat; })[0] || {}).label + " games");
    $("#gridTitle").textContent = label;
    $("#grid").innerHTML = list.map(card).join("");
    $("#empty").hidden = list.length > 0;
    $("#grid").querySelectorAll(".fav").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        var id = b.dataset.id, k = favs.indexOf(id);
        if (k >= 0) favs.splice(k, 1); else favs.push(id);
        set("favs", favs);
        b.classList.toggle("on", k < 0);
        b.setAttribute("aria-pressed", k < 0);
        buildChips();
        if (cat === "favs") buildGrid();
      });
    });
  }

  /* ----------------------------------------------------------- recent */
  function buildRecent() {
    var list = GAMES.map(function (g) { return { g: g, t: get("last:" + g.id, 0) }; })
      .filter(function (x) { return x.t; })
      .sort(function (a, b) { return b.t - a.t; })
      .slice(0, 6);
    $("#recentWrap").hidden = !list.length;
    $("#recent").innerHTML = list.map(function (x) {
      var best = get("best:" + x.g.id, 0);
      return '<a class="mini" href="' + url(x.g) + '" style="--c:' + x.g.color + '"><img src="' + thumb(x.g) + '" alt=""><div><b>' + esc(x.g.title) + "</b><span>" +
        (best ? "Best " + fmt(best) + " · " : "") + ago(x.t) + "</span></div></a>";
    }).join("");
    var total = GAMES.reduce(function (s, g) { return s + get("plays:" + g.id, 0); }, 0);
    $("#statPlays").textContent = fmt(total);
    $("#statGames").textContent = GAMES.length;
  }

  /* ----------------------------------------------------- search & random */
  $("#q").addEventListener("input", function (e) { query = e.target.value; buildGrid(); });
  window.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== $("#q")) { e.preventDefault(); $("#q").focus(); }
    if (e.key === "Escape" && document.activeElement === $("#q")) { $("#q").value = ""; query = ""; buildGrid(); $("#q").blur(); }
  });
  $("#random").addEventListener("click", function () {
    var g = GAMES[(Math.random() * GAMES.length) | 0];
    location.href = url(g);
  });

  /* ------------------------------------------------------- background fx */
  (function () {
    var c = $("#bgfx"), ctx = c.getContext("2d"), W, H, dpr, dots = [];
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      c.width = W * dpr; c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize);
    resize();
    for (var i = 0; i < 70; i++) dots.push({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, h: Math.random() < 0.5 ? 190 : 320 });
    var t = 0;
    function frame() {
      t += 0.016;
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#07020f"); g.addColorStop(1, "#12042a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // glowing blobs
      [[0.15, 0.2, "rgba(255,42,138,0.10)"], [0.85, 0.35, "rgba(0,240,255,0.08)"], [0.5, 0.95, "rgba(124,92,255,0.12)"]].forEach(function (b, k) {
        var x = W * (b[0] + Math.sin(t * 0.2 + k * 2) * 0.05), y = H * (b[1] + Math.cos(t * 0.15 + k) * 0.05), r = Math.max(W, H) * 0.45;
        var rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, b[2]); rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      });
      // perspective floor grid
      var hy = H * 0.72;
      ctx.strokeStyle = "rgba(177,75,255,0.10)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var k = -14; k <= 14; k++) { ctx.moveTo(W / 2 + k * 20, hy); ctx.lineTo(W / 2 + k * W * 0.18, H); }
      var off = (t * 0.25) % 1;
      for (var j = 0; j < 12; j++) { var p = Math.pow((j + off) / 12, 2.2); var y2 = hy + (H - hy) * p; ctx.moveTo(0, y2); ctx.lineTo(W, y2); }
      ctx.stroke();
      // drifting sparks
      for (var d = 0; d < dots.length; d++) {
        var s = dots[d];
        s.y -= 0.0004 * s.z; if (s.y < -0.02) { s.y = 1.02; s.x = Math.random(); }
        ctx.fillStyle = "hsla(" + s.h + ",100%,70%," + (0.25 + s.z * 0.4) + ")";
        ctx.fillRect(s.x * W, s.y * H, s.z * 2, s.z * 2);
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    frame();
  })();

  buildHero();
  buildChips();
  buildGrid();
  buildRecent();
  // refresh scores when returning via back/forward cache
  window.addEventListener("pageshow", function (e) { if (e.persisted) { favs = get("favs", []); buildChips(); buildGrid(); buildRecent(); } });
})();
