/* Void Swarm — survive the endless swarm, level up, build an overpowered ship */
(function () {
  "use strict";
  var A = Arcade, sfx = A.sfx, rand = A.rand;

  var S = A.shell({
    id: "void-swarm",
    title: "Void Swarm",
    howto: "Move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows &mdash; on touch, drag anywhere.<br>Your ship fires automatically. Collect <span style='color:#7cffcb'>crystals</span> to level up and stack upgrades. Survive.",
    onStart: reset
  });

  var canvas = document.getElementById("c");
  var view = A.fitCanvas(canvas);
  var ctx = view.ctx;
  var parts = new A.Particles(900);
  var shake = new A.Shake();

  var heartsEl = document.getElementById("hearts"), timeEl = document.getElementById("time");
  var lvlEl = document.getElementById("lvl"), xpEl = document.querySelector("#xp div");
  var upEl = document.getElementById("up"), cardsEl = document.getElementById("cards");

  /* --------------------------------------------------------------- stars */
  var stars = [];
  for (var i = 0; i < 160; i++) stars.push({ x: Math.random() * 2000, y: Math.random() * 2000, z: rand(0.15, 0.6), s: rand(0.6, 1.8) });

  /* ---------------------------------------------------------------- state */
  var P, bullets, enemies, gems, novas, elapsed, spawnAcc, kills, fireAcc, orbAngle, novaAcc, bossAcc, upgrading, alive, cam;

  function reset() {
    P = {
      x: 0, y: 0, vx: 0, vy: 0, r: 13, hp: 5, maxHp: 5, inv: 0, angle: -Math.PI / 2,
      speed: 230, fireRate: 2.6, dmg: 1, multi: 1, pierce: 0, bspeed: 640, magnet: 95,
      orbitals: 0, nova: 0, level: 1, xp: 0, need: 5, regen: 0, regenAcc: 0, crit: 0
    };
    bullets = []; enemies = []; gems = []; novas = [];
    elapsed = 0; spawnAcc = 0; kills = 0; fireAcc = 0; orbAngle = 0; novaAcc = 0; bossAcc = 0;
    upgrading = false; alive = true; cam = { x: 0, y: 0 }; taken = {};
    parts.clear();
    upEl.classList.remove("show");
    renderHearts(); renderXp();
  }

  function renderHearts() {
    var h = "";
    for (var i = 0; i < P.maxHp; i++) h += "<i class='" + (i < P.hp ? "" : "off") + "'></i>";
    heartsEl.innerHTML = h;
  }
  function renderXp() {
    xpEl.style.width = Math.min(100, (P.xp / P.need) * 100) + "%";
    lvlEl.textContent = "LV " + P.level;
  }

  /* ------------------------------------------------------------- enemies */
  var TYPES = {
    chaser: { r: 12, hp: 2, speed: 92, color: "#ff2a8a", xp: 1, pts: 10, sides: 3 },
    dart: { r: 9, hp: 1, speed: 165, color: "#ffd23f", xp: 1, pts: 10, sides: 4 },
    tank: { r: 22, hp: 9, speed: 55, color: "#b14bff", xp: 4, pts: 40, sides: 6 },
    splitter: { r: 16, hp: 4, speed: 80, color: "#ff7a2f", xp: 2, pts: 25, sides: 5 },
    boss: { r: 46, hp: 140, speed: 62, color: "#ff3b3b", xp: 30, pts: 500, sides: 8 }
  };

  function spawnEnemy(type, x, y) {
    var T = TYPES[type];
    if (x == null) {
      var a = Math.random() * Math.PI * 2;
      var d = Math.hypot(view.w, view.h) / 2 + 60;
      x = P.x + Math.cos(a) * d; y = P.y + Math.sin(a) * d;
    }
    var scale = 1 + elapsed / 75;
    enemies.push({
      type: type, x: x, y: y, vx: 0, vy: 0, r: T.r, hp: Math.ceil(T.hp * scale), maxHp: Math.ceil(T.hp * scale),
      speed: T.speed * (1 + Math.min(0.5, elapsed / 400)) * rand(0.9, 1.1), color: T.color, sides: T.sides,
      rot: Math.random() * 6, flash: 0, orbHit: 0, wob: Math.random() * 6
    });
  }

  function pickType() {
    var r = Math.random();
    if (elapsed > 70 && r < 0.12) return "tank";
    if (elapsed > 40 && r < 0.25) return "splitter";
    if (elapsed > 15 && r < 0.45) return "dart";
    if (elapsed > 100 && r < 0.6) return "dart";
    return "chaser";
  }

  function killEnemy(e, idx) {
    var T = TYPES[e.type];
    kills++;
    S.addScore(T.pts);
    parts.emit(e.x, e.y, { n: e.type === "boss" ? 80 : 16, color: [e.color, "#fff"], speed: e.type === "boss" ? 420 : 240, life: 0.6, size: 4 });
    var drops = T.xp;
    for (var k = 0; k < Math.min(drops, 8); k++) {
      gems.push({ x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), v: drops > 8 ? Math.ceil(drops / 8) : 1, vx: 0, vy: 0, t: Math.random() * 6 });
    }
    if (e.type === "splitter") {
      for (var s = 0; s < 3; s++) spawnEnemy("dart", e.x + rand(-12, 12), e.y + rand(-12, 12));
    }
    if (e.type === "boss") {
      shake.add(14, 0.5); sfx.boom();
      A.popup("BOSS DOWN +500", view.w / 2, view.h * 0.3, "#ffd23f", 28);
      if (P.hp < P.maxHp) { P.hp++; renderHearts(); }
    } else {
      sfx.tone(rand(160, 260), 0.08, "square", 0.05, -80);
    }
    enemies[idx] = enemies[enemies.length - 1];
    enemies.pop();
  }

  function damage(e, idx, dmg) {
    if (P.crit && Math.random() < P.crit) { dmg *= 2; parts.emit(e.x, e.y, { n: 5, color: "#fff", speed: 300, life: 0.25, size: 3 }); }
    e.hp -= dmg;
    e.flash = 0.08;
    if (e.hp <= 0) { killEnemy(e, idx); return true; }
    return false;
  }

  /* ------------------------------------------------------------- upgrades */
  var UPGRADES = [
    { id: "rate", name: "Overclock", desc: "+30% fire rate", ic: "»", c: "#00f0ff", max: 10, apply: function () { P.fireRate *= 1.3; } },
    { id: "dmg", name: "Plasma Core", desc: "+1 bullet damage", ic: "✦", c: "#ff2a8a", max: 10, apply: function () { P.dmg += 1; } },
    { id: "multi", name: "Split Barrel", desc: "+1 projectile per shot", ic: "⋔", c: "#ffd23f", max: 6, apply: function () { P.multi += 1; } },
    { id: "pierce", name: "Railgun", desc: "Bullets pierce +1 enemy", ic: "➤", c: "#7cffcb", max: 5, apply: function () { P.pierce += 1; } },
    { id: "speed", name: "Thrusters", desc: "+15% move speed", ic: "⇧", c: "#9db4ff", max: 5, apply: function () { P.speed *= 1.15; } },
    { id: "magnet", name: "Tractor Beam", desc: "+60% pickup range", ic: "◎", c: "#7cffcb", max: 5, apply: function () { P.magnet *= 1.6; } },
    { id: "hp", name: "Hull Plating", desc: "+1 max HP and full heal", ic: "♥", c: "#ff4d8d", max: 5, apply: function () { P.maxHp += 1; P.hp = P.maxHp; renderHearts(); } },
    { id: "orb", name: "Orbit Blades", desc: "+1 blade circling your ship", ic: "◌", c: "#b14bff", max: 6, apply: function () { P.orbitals += 1; } },
    { id: "nova", name: "Nova Pulse", desc: "Periodic shockwave around you", ic: "✺", c: "#ff7a2f", max: 5, apply: function () { P.nova += 1; } },
    { id: "crit", name: "Lucky Shot", desc: "+12% chance for double damage", ic: "✧", c: "#ffe76a", max: 4, apply: function () { P.crit += 0.12; } },
    { id: "regen", name: "Nanobots", desc: "Regenerate 1 HP every " + 25 + "s (faster per level)", ic: "+", c: "#5dff9a", max: 3, apply: function () { P.regen += 1; } }
  ];
  var taken = {};

  function levelUp() {
    P.level++;
    P.xp -= P.need;
    P.need = Math.floor(6 + P.level * 3.2 + Math.pow(P.level, 1.5));
    renderXp();
    sfx.levelup();
    var pool = UPGRADES.filter(function (u) { return (taken[u.id] || 0) < u.max; });
    var choices = [];
    while (choices.length < 3 && pool.length) choices.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    upgrading = true;
    cardsEl.innerHTML = "";
    choices.forEach(function (u, i) {
      var b = document.createElement("button");
      b.className = "card";
      b.style.setProperty("--c", u.c);
      b.style.animationDelay = i * 0.06 + "s";
      var lv = (taken[u.id] || 0) + 1;
      b.innerHTML = "<kbd>" + (i + 1) + "</kbd><div class='ic'>" + u.ic + "</div><b>" + u.name + "</b>" + u.desc + "<small>Level " + lv + " / " + u.max + "</small>";
      b.addEventListener("click", function () { choose(u); });
      b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      cardsEl.appendChild(b);
    });
    upEl.classList.add("show");
    upEl._choices = choices;
  }
  function choose(u) {
    if (!upgrading) return;
    taken[u.id] = (taken[u.id] || 0) + 1;
    u.apply();
    sfx.power();
    upgrading = false;
    upEl.classList.remove("show");
    keys = {};
    joy.active = false;
    if (P.xp >= P.need) setTimeout(levelUp, 150);
  }

  /* ---------------------------------------------------------------- input */
  var keys = {};
  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    keys[k] = true;
    if (upgrading && upEl._choices && "123".indexOf(k) >= 0 && k !== "") {
      var u = upEl._choices[+k - 1];
      if (u) choose(u);
    }
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
  var joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  canvas.addEventListener("pointerdown", function (e) {
    if (joy.active) return;
    joy.active = true; joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
  });
  window.addEventListener("pointermove", function (e) { if (joy.active && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
  function jup(e) { if (e.pointerId === joy.id) joy.active = false; }
  window.addEventListener("pointerup", jup);
  window.addEventListener("pointercancel", jup);

  /* ---------------------------------------------------------------- update */
  var grid = {};
  function separate() {
    grid = {};
    var C = 48, i, e, key;
    for (i = 0; i < enemies.length; i++) {
      e = enemies[i];
      key = ((e.x / C) | 0) + "," + ((e.y / C) | 0);
      (grid[key] || (grid[key] = [])).push(e);
    }
    for (key in grid) {
      var cell = grid[key];
      for (var a = 0; a < cell.length; a++) {
        for (var b = a + 1; b < cell.length; b++) {
          var p = cell[a], q = cell[b];
          var dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy, rr = p.r + q.r;
          if (d2 < rr * rr && d2 > 0.01) {
            var d = Math.sqrt(d2), push = (rr - d) * 0.5 / d;
            p.x -= dx * push; p.y -= dy * push; q.x += dx * push; q.y += dy * push;
          }
        }
      }
    }
  }

  function nearestEnemy(range) {
    var best = null, bd = range * range;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i], dx = e.x - P.x, dy = e.y - P.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function fire() {
    var target = nearestEnemy(Math.max(view.w, view.h) * 0.7);
    if (!target) return;
    var lead = Math.hypot(target.x - P.x, target.y - P.y) / P.bspeed;
    var tx = target.x + target.vx * lead, ty = target.y + target.vy * lead;
    var base = Math.atan2(ty - P.y, tx - P.x);
    P.angle = base;
    var spread = 0.13;
    for (var i = 0; i < P.multi; i++) {
      var a = base + (i - (P.multi - 1) / 2) * spread;
      bullets.push({ x: P.x + Math.cos(a) * 16, y: P.y + Math.sin(a) * 16, vx: Math.cos(a) * P.bspeed, vy: Math.sin(a) * P.bspeed, life: 1.1, pierce: P.pierce, hit: [] });
    }
    sfx.shoot();
  }

  function hurt() {
    if (P.inv > 0) return;
    P.hp--;
    P.inv = 1.1;
    renderHearts();
    shake.add(10, 0.35);
    sfx.hit();
    parts.emit(P.x, P.y, { n: 30, color: ["#ff2a8a", "#fff"], speed: 300, life: 0.5 });
    // knock everything back
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i], dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
      if (d < 160) { e.x += dx / d * (160 - d); e.y += dy / d * (160 - d); }
    }
    if (P.hp <= 0) die();
  }

  function die() {
    alive = false;
    shake.add(20, 0.6);
    sfx.boom();
    setTimeout(sfx.over, 300);
    parts.emit(P.x, P.y, { n: 120, color: ["#00f0ff", "#fff", "#7cffcb"], speed: 500, life: 1.1, size: 5 });
    var m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60);
    S.gameOver('<div class="ub-label" style="margin-top:10px">Survived ' + m + ":" + (s < 10 ? "0" : "") + s + " &middot; " + kills + " kills &middot; LV " + P.level + "</div>");
  }

  function update(dt) {
    elapsed += dt;
    var m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60);
    timeEl.textContent = m + ":" + (s < 10 ? "0" : "") + s;

    // movement
    var ix = 0, iy = 0;
    if (keys["a"] || keys["arrowleft"]) ix -= 1;
    if (keys["d"] || keys["arrowright"]) ix += 1;
    if (keys["w"] || keys["arrowup"]) iy -= 1;
    if (keys["s"] || keys["arrowdown"]) iy += 1;
    if (joy.active) {
      var jx = joy.x - joy.ox, jy = joy.y - joy.oy, jl = Math.hypot(jx, jy);
      if (jl > 6) { ix += jx / Math.max(jl, 50); iy += jy / Math.max(jl, 50); }
    }
    var il = Math.hypot(ix, iy);
    if (il > 1) { ix /= il; iy /= il; }
    P.vx += (ix * P.speed - P.vx) * Math.min(1, dt * 12);
    P.vy += (iy * P.speed - P.vy) * Math.min(1, dt * 12);
    P.x += P.vx * dt; P.y += P.vy * dt;
    if (P.inv > 0) P.inv -= dt;
    if (il > 0.1 && Math.random() < 0.6) parts.emit(P.x - ix * 14, P.y - iy * 14, { n: 1, color: "#00f0ff", speed: 60, life: 0.35, size: 3 });

    if (P.regen) {
      P.regenAcc += dt;
      if (P.regenAcc > 25 / P.regen) { P.regenAcc = 0; if (P.hp < P.maxHp) { P.hp++; renderHearts(); sfx.coin(0.8); } }
    }

    // shooting
    fireAcc += dt;
    if (fireAcc >= 1 / P.fireRate) { fireAcc = 0; fire(); }

    // spawning
    var rate = Math.min(14, 1.7 + elapsed * 0.06);
    spawnAcc += dt * rate;
    while (spawnAcc >= 1) { spawnAcc--; spawnEnemy(pickType()); }
    bossAcc += dt;
    if (bossAcc >= 60) {
      bossAcc = 0;
      spawnEnemy("boss");
      A.popup("BOSS INCOMING", view.w / 2, view.h * 0.3, "#ff3b3b", 30);
      sfx.tone(110, 0.6, "sawtooth", 0.2, -40);
    }
    // swarm ring every 45s
    if (Math.floor((elapsed - dt) / 45) < Math.floor(elapsed / 45)) {
      for (var k = 0; k < 24; k++) {
        var ang = k / 24 * Math.PI * 2, rr = Math.hypot(view.w, view.h) / 2 + 40;
        spawnEnemy("chaser", P.x + Math.cos(ang) * rr, P.y + Math.sin(ang) * rr);
      }
    }

    // bullets
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { bullets.splice(i, 1); continue; }
      for (var j = enemies.length - 1; j >= 0; j--) {
        var e = enemies[j];
        if (b.hit.indexOf(e) >= 0) continue;
        var dx = e.x - b.x, dy = e.y - b.y;
        if (dx * dx + dy * dy < (e.r + 4) * (e.r + 4)) {
          b.hit.push(e);
          e.x += b.vx * 0.012; e.y += b.vy * 0.012;
          parts.emit(b.x, b.y, { n: 3, color: e.color, speed: 160, life: 0.25, size: 3 });
          damage(e, j, P.dmg);
          if (b.pierce-- <= 0) { b.life = 0; break; }
        }
      }
      if (b.life <= 0) bullets.splice(i, 1);
    }

    // orbitals
    orbAngle += dt * 3.2;
    if (P.orbitals) {
      for (var o = 0; o < P.orbitals; o++) {
        var oa = orbAngle + o / P.orbitals * Math.PI * 2;
        var ox = P.x + Math.cos(oa) * 62, oy = P.y + Math.sin(oa) * 62;
        for (var q = enemies.length - 1; q >= 0; q--) {
          var en = enemies[q];
          if (en.orbHit > 0) continue;
          var ddx = en.x - ox, ddy = en.y - oy;
          if (ddx * ddx + ddy * ddy < (en.r + 10) * (en.r + 10)) {
            en.orbHit = 0.3;
            parts.emit(ox, oy, { n: 4, color: "#b14bff", speed: 200, life: 0.25 });
            damage(en, q, 1 + Math.floor(P.dmg / 2));
          }
        }
      }
    }

    // nova
    if (P.nova) {
      novaAcc += dt;
      if (novaAcc >= Math.max(1.4, 4.2 - P.nova * 0.55)) {
        novaAcc = 0;
        var R = 120 + P.nova * 25;
        novas.push({ x: P.x, y: P.y, r: 0, R: R, t: 0 });
        sfx.tone(200, 0.3, "sine", 0.18, 300);
        for (var n = enemies.length - 1; n >= 0; n--) {
          var ne = enemies[n], ndx = ne.x - P.x, ndy = ne.y - P.y, nd = Math.hypot(ndx, ndy) || 1;
          if (nd < R + ne.r) {
            ne.x += ndx / nd * 40; ne.y += ndy / nd * 40;
            damage(ne, n, 2 + P.nova);
          }
        }
      }
    }
    for (var v = novas.length - 1; v >= 0; v--) { novas[v].t += dt; if (novas[v].t > 0.4) novas.splice(v, 1); }

    // enemies
    for (var ei = enemies.length - 1; ei >= 0; ei--) {
      var E = enemies[ei];
      var edx = P.x - E.x, edy = P.y - E.y, ed = Math.hypot(edx, edy) || 1;
      E.wob += dt * 3;
      var wobble = E.type === "dart" ? Math.sin(E.wob) * 0.5 : 0;
      var ca = Math.atan2(edy, edx) + wobble;
      E.vx = Math.cos(ca) * E.speed; E.vy = Math.sin(ca) * E.speed;
      E.x += E.vx * dt; E.y += E.vy * dt;
      E.rot += dt * (E.type === "boss" ? 0.8 : 2);
      if (E.flash > 0) E.flash -= dt;
      if (E.orbHit > 0) E.orbHit -= dt;
      if (ed < E.r + P.r - 3) hurt();
      if (!alive) return;
      // cull very far
      if (ed > 2200) { enemies[ei] = enemies[enemies.length - 1]; enemies.pop(); }
    }
    separate();

    // gems
    for (var g = gems.length - 1; g >= 0; g--) {
      var G = gems[g];
      G.t += dt;
      var gdx = P.x - G.x, gdy = P.y - G.y, gd = Math.hypot(gdx, gdy) || 1;
      if (gd < P.magnet) {
        var pull = 900 * (1 - gd / P.magnet) + 200;
        G.vx += gdx / gd * pull * dt; G.vy += gdy / gd * pull * dt;
      }
      G.vx *= 0.92; G.vy *= 0.92;
      G.x += G.vx * dt * 10; G.y += G.vy * dt * 10;
      if (gd < P.r + 8) {
        P.xp += G.v;
        gems.splice(g, 1);
        sfx.tone(1200 + Math.random() * 300, 0.04, "sine", 0.06);
        if (P.xp >= P.need && !upgrading) levelUp();
        renderXp();
      }
    }
    if (gems.length > 400) gems.splice(0, gems.length - 400);
  }

  /* ------------------------------------------------------------------ draw */
  function poly(x, y, r, sides, rot) {
    ctx.beginPath();
    for (var i = 0; i < sides; i++) {
      var a = rot + i / sides * Math.PI * 2;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function draw(t) {
    var W = view.w, H = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = "#06020f";
    ctx.fillRect(0, 0, W, H);

    // stars (parallax)
    ctx.fillStyle = "#fff";
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sx = ((s.x - cam.x * s.z) % W + W) % W, sy = ((s.y - cam.y * s.z) % H + H) % H;
      ctx.globalAlpha = s.z * 1.3;
      ctx.fillRect(sx, sy, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    var ox = W / 2 - cam.x + shake.x, oy = H / 2 - cam.y + shake.y;
    ctx.translate(ox, oy);

    // grid
    var G = 80;
    ctx.strokeStyle = "rgba(140, 80, 255, 0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    var gx0 = Math.floor((cam.x - W / 2) / G) * G, gy0 = Math.floor((cam.y - H / 2) / G) * G;
    for (var gx = gx0; gx < cam.x + W / 2 + G; gx += G) { ctx.moveTo(gx, cam.y - H / 2 - G); ctx.lineTo(gx, cam.y + H / 2 + G); }
    for (var gy = gy0; gy < cam.y + H / 2 + G; gy += G) { ctx.moveTo(cam.x - W / 2 - G, gy); ctx.lineTo(cam.x + W / 2 + G, gy); }
    ctx.stroke();

    if (!P) return;

    // gems
    ctx.globalCompositeOperation = "lighter";
    var gg = A.glow("#00f0ff");
    for (var k = 0; k < gems.length; k++) {
      var gm = gems[k], gs = 5 + Math.sin(gm.t * 6) * 1;
      ctx.drawImage(gg, gm.x - 12, gm.y - 12, 24, 24);
      ctx.fillStyle = "#b8fff0";
      ctx.beginPath(); ctx.moveTo(gm.x, gm.y - gs); ctx.lineTo(gm.x + gs * 0.7, gm.y); ctx.lineTo(gm.x, gm.y + gs); ctx.lineTo(gm.x - gs * 0.7, gm.y); ctx.fill();
    }

    // novas
    for (var n = 0; n < novas.length; n++) {
      var nv = novas[n], p = nv.t / 0.4;
      ctx.strokeStyle = "rgba(255,122,47," + (1 - p) + ")";
      ctx.lineWidth = 6 * (1 - p) + 1;
      ctx.beginPath(); ctx.arc(nv.x, nv.y, nv.R * Math.sqrt(p), 0, Math.PI * 2); ctx.stroke();
    }

    // enemies
    for (var e = 0; e < enemies.length; e++) {
      var E = enemies[e];
      if (E.x < cam.x - W / 2 - 60 || E.x > cam.x + W / 2 + 60 || E.y < cam.y - H / 2 - 60 || E.y > cam.y + H / 2 + 60) continue;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(A.glow(E.color), E.x - E.r * 2.2, E.y - E.r * 2.2, E.r * 4.4, E.r * 4.4);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
    for (var e2 = 0; e2 < enemies.length; e2++) {
      var F = enemies[e2];
      if (F.x < cam.x - W / 2 - 60 || F.x > cam.x + W / 2 + 60 || F.y < cam.y - H / 2 - 60 || F.y > cam.y + H / 2 + 60) continue;
      poly(F.x, F.y, F.r, F.sides, F.rot);
      ctx.fillStyle = F.flash > 0 ? "#fff" : "rgba(10,2,20,0.85)";
      ctx.fill();
      ctx.lineWidth = F.type === "boss" ? 4 : 2.5;
      ctx.strokeStyle = F.flash > 0 ? "#fff" : F.color;
      ctx.stroke();
      if (F.type === "boss" || F.type === "tank") {
        poly(F.x, F.y, F.r * 0.5, F.sides, -F.rot * 1.5);
        ctx.stroke();
        if (F.hp < F.maxHp) {
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(F.x - F.r, F.y - F.r - 12, F.r * 2, 4);
          ctx.fillStyle = F.color;
          ctx.fillRect(F.x - F.r, F.y - F.r - 12, F.r * 2 * Math.max(0, F.hp / F.maxHp), 4);
        }
      }
    }

    // bullets
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "#aaffff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (var b = 0; b < bullets.length; b++) {
      var B = bullets[b];
      ctx.moveTo(B.x, B.y); ctx.lineTo(B.x - B.vx * 0.022, B.y - B.vy * 0.022);
    }
    ctx.stroke();
    var bg = A.glow("#00c8ff");
    for (var b2 = 0; b2 < bullets.length; b2++) ctx.drawImage(bg, bullets[b2].x - 9, bullets[b2].y - 9, 18, 18);

    // orbitals
    if (P.orbitals && alive) {
      for (var o = 0; o < P.orbitals; o++) {
        var oa = orbAngle + o / P.orbitals * Math.PI * 2;
        var bx = P.x + Math.cos(oa) * 62, by = P.y + Math.sin(oa) * 62;
        ctx.drawImage(A.glow("#b14bff"), bx - 20, by - 20, 40, 40);
        ctx.save(); ctx.translate(bx, by); ctx.rotate(oa * 3);
        ctx.fillStyle = "#e6c8ff"; ctx.fillRect(-9, -2, 18, 4); ctx.fillRect(-2, -9, 4, 18);
        ctx.restore();
      }
    }

    parts.draw(ctx);
    ctx.globalCompositeOperation = "source-over";

    // magnet radius hint
    if (alive) {
      ctx.strokeStyle = "rgba(124,255,203,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(P.x, P.y, P.magnet, 0, Math.PI * 2); ctx.stroke();
    }

    // player
    if (alive && !(P.inv > 0 && Math.floor(t * 20) % 2)) {
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(A.glow("#00f0ff"), P.x - 40, P.y - 40, 80, 80);
      ctx.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.translate(P.x, P.y);
      ctx.rotate(P.angle);
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(-11, -12); ctx.lineTo(-5, 0); ctx.lineTo(-11, 12); ctx.closePath();
      ctx.fillStyle = "#0b1a2a"; ctx.fill();
      ctx.strokeStyle = "#00f0ff"; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();
      ctx.fillStyle = "#e8ffff";
      ctx.beginPath(); ctx.arc(3, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    // joystick
    if (joy.active && S.playing) {
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 50, 0, Math.PI * 2); ctx.stroke();
      var jx = joy.x - joy.ox, jy = joy.y - joy.oy, jl = Math.hypot(jx, jy), lim = Math.min(jl, 50) / (jl || 1);
      ctx.fillStyle = "rgba(0,240,255,0.35)";
      ctx.beginPath(); ctx.arc(joy.ox + jx * lim, joy.oy + jy * lim, 20, 0, Math.PI * 2); ctx.fill();
    }
    // low-HP vignette
    if (alive && P.hp === 1) {
      var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      vg.addColorStop(0, "rgba(255,0,60,0)");
      vg.addColorStop(1, "rgba(255,0,60," + (0.25 + Math.sin(t * 6) * 0.1) + ")");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
  }

  reset();
  // attract mode: a few drifting enemies behind the menu
  for (var z = 0; z < 18; z++) spawnEnemy(pickType(), rand(-500, 500), rand(-400, 400));

  A.loop(function (dt, t) {
    var active = S.playing && !S.paused && !upgrading && alive;
    if (active) update(dt);
    else if (!S.playing) {
      // idle drift
      for (var i = 0; i < enemies.length; i++) { enemies[i].rot += dt; }
    }
    if (!S.paused && !upgrading) { parts.update(dt); shake.update(dt); }
    if (P && alive) {
      cam.x += (P.x - cam.x) * Math.min(1, dt * 8);
      cam.y += (P.y - cam.y) * Math.min(1, dt * 8);
    }
    draw(t);
  });
})();
