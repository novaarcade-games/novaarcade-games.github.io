/* Orbit Hop — slingshot from planet to planet up into deep space */
(function () {
  "use strict";
  var A = Arcade, sfx = A.sfx, rand = A.rand;

  var S = A.shell({
    id: "orbit-hop",
    title: "Orbit Hop",
    howto: "Tap, click or press <kbd>Space</kbd> to launch off your orbit.<br>Fly straight into the next planet's orbit to get caught. Miss and you drift into the void. Launch fast for <b>QUICK</b> bonuses.",
    onStart: reset
  });

  var canvas = document.getElementById("c");
  var bgCanvas = document.createElement("canvas");
  var view = A.fitCanvas(canvas, buildBg);
  var ctx = view.ctx;
  buildBg(view);
  var parts = new A.Particles(500);
  var shake = new A.Shake();

  function buildBg(v) {
    bgCanvas.width = v.w; bgCanvas.height = v.h;
    var g = bgCanvas.getContext("2d");
    var grd = g.createLinearGradient(0, 0, 0, v.h);
    grd.addColorStop(0, "#030010"); grd.addColorStop(1, "#140430");
    g.fillStyle = grd; g.fillRect(0, 0, v.w, v.h);
    var cols = ["rgba(120,40,255,0.18)", "rgba(255,42,138,0.12)", "rgba(0,200,255,0.12)"];
    for (var i = 0; i < 6; i++) {
      var x = Math.random() * v.w, y = Math.random() * v.h, r = rand(150, 380);
      var n = g.createRadialGradient(x, y, 0, x, y, r);
      n.addColorStop(0, cols[i % 3]); n.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = n; g.fillRect(0, 0, v.w, v.h);
    }
  }

  var stars = [];
  for (var i = 0; i < 180; i++) stars.push({ x: Math.random(), y: Math.random() * 3000, z: rand(0.05, 0.4), s: rand(0.5, 2) });

  var HUES = [190, 320, 270, 30, 150, 50, 0];
  var WW = 520, offX = 0;
  var planets, player, camY, hops, stars2, maxIdx, lastCapT, nextY, idxCounter, dead, flightT;

  function worldW() { WW = Math.min(view.w, 560); offX = (view.w - WW) / 2; }

  function addPlanet() {
    var level = idxCounter;
    var r = rand(16, 32);
    var p = {
      idx: idxCounter++, x: rand(70, WW - 70), y: nextY, r: r, orbit: r + rand(30, 42),
      w: rand(1.9, 2.6) + Math.min(1.4, level * 0.03), dir: Math.random() < 0.5 ? 1 : -1,
      hue: HUES[(Math.random() * HUES.length) | 0], ring: Math.random() < 0.35,
      mx: level > 8 && Math.random() < 0.4 ? rand(40, 110) : 0, mt: Math.random() * 6, ms: rand(0.6, 1.3), bx: 0, spin: Math.random() * 6
    };
    p.bx = p.mx ? A.clamp(p.x, 70 + p.mx, WW - 70 - p.mx) : p.x;
    if (p.mx && WW - 140 < p.mx * 2) p.mx = 0;
    planets.push(p);
    // star pickup between this and previous planet
    if (planets.length > 1 && Math.random() < 0.6) {
      var q = planets[planets.length - 2];
      stars2.push({ x: (p.x + q.x) / 2 + rand(-40, 40), y: (p.y + q.y) / 2, t: Math.random() * 6, got: false });
    }
    nextY -= rand(185, 250) + Math.min(60, level * 1.5);
  }

  function reset() {
    worldW();
    planets = []; stars2 = []; parts.clear();
    idxCounter = 0; nextY = view.h * 0.72;
    for (var i = 0; i < 8; i++) addPlanet();
    planets[0].x = planets[0].bx = WW / 2; planets[0].mx = 0;
    player = { state: "orbit", p: planets[0], a: -Math.PI / 2, rad: planets[0].orbit, x: 0, y: 0, vx: 0, vy: 0, trail: [], left: null };
    camY = planets[0].y - view.h * 0.72;
    hops = 0; maxIdx = 0; lastCapT = 0; dead = false; flightT = 0;
  }

  function planetPos(p, t) {
    if (p.mx) p.x = p.bx + Math.sin(t * p.ms + p.mt) * p.mx;
  }

  function launch() {
    if (!S.playing || dead || player.state !== "orbit") return;
    var p = player.p, a = player.a, d = p.dir;
    var sp = 560 + Math.min(200, hops * 4);
    player.vx = -Math.sin(a) * d * sp;
    player.vy = Math.cos(a) * d * sp;
    player.left = p;
    player.state = "fly";
    flightT = 0;
    sfx.jump();
    parts.emit(player.x, player.y, { n: 14, color: ["#fff", "hsl(" + p.hue + ",100%,70%)"], speed: 200, life: 0.4, angle: Math.atan2(-player.vy, -player.vx), spread: 1.2 });
    if (now - lastCapT < 0.55 && hops > 0) {
      S.addScore(5);
      A.popup("QUICK +5", player.x + offX, player.y - camY - 30, "#ffe76a");
      sfx.coin(1.4);
    }
  }

  function capture(p) {
    var rx = player.x - p.x, ry = player.y - p.y;
    var cross = rx * player.vy - ry * player.vx;
    p.dir = cross >= 0 ? 1 : -1;
    player.state = "orbit";
    player.p = p;
    player.a = Math.atan2(ry, rx);
    player.rad = Math.hypot(rx, ry);
    lastCapT = now;
    if (p.idx > maxIdx) {
      var gained = p.idx - maxIdx;
      maxIdx = p.idx;
      hops++;
      S.addScore(10 * gained);
      if (gained > 1) A.popup("SKIP x" + gained + "!", p.x + offX, p.y - camY - p.orbit - 20, "#ff7ad9", 24);
      sfx.coin(1 + Math.min(hops, 30) * 0.02);
      parts.emit(player.x, player.y, { n: 20, color: ["hsl(" + p.hue + ",100%,70%)", "#fff"], speed: 220, life: 0.6 });
    } else sfx.blip(0.8);
    while (planets.length < maxIdx - planets[0].idx + 9) addPlanet();
  }

  function die() {
    dead = true;
    shake.add(8, 0.3);
    sfx.hit();
    setTimeout(sfx.over, 250);
    S.gameOver('<div class="ub-label" style="margin-top:10px">' + hops + " planets reached</div>");
  }

  window.addEventListener("pointerdown", function (e) { if (e.button === 0 || e.pointerType !== "mouse") launch(); });
  window.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp") launch(); });

  var now = 0;
  function update(dt) {
    for (var i = 0; i < planets.length; i++) { planetPos(planets[i], now); planets[i].spin += dt * 0.4; }

    if (player.state === "orbit") {
      var p = player.p;
      player.a += p.dir * p.w * dt;
      player.rad += (p.orbit - player.rad) * Math.min(1, dt * 8);
      player.x = p.x + Math.cos(player.a) * player.rad;
      player.y = p.y + Math.sin(player.a) * player.rad;
    } else if (player.state === "fly") {
      flightT += dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      if (Math.random() < 0.8) parts.emit(player.x, player.y, { n: 1, color: "#9ffcff", speed: 30, life: 0.4, size: 3 });
      for (var j = 0; j < planets.length; j++) {
        var q = planets[j];
        var d = Math.hypot(player.x - q.x, player.y - q.y);
        if (q === player.left) {
          if (d > q.orbit + 10) player.left = null;
          continue;
        }
        if (d < q.r + 6) { die(); return; }
        if (d < q.orbit + 6) { capture(q); break; }
      }
      if (player.state === "fly" && (player.x < -40 || player.x > WW + 40 || player.y > camY + view.h + 40 || player.y < camY - 200 || flightT > 2.4)) { die(); return; }
    }

    // stars
    for (var s = 0; s < stars2.length; s++) {
      var st = stars2[s];
      st.t += dt;
      if (!st.got && Math.hypot(player.x - st.x, player.y - st.y) < 22) {
        st.got = true;
        S.addScore(5);
        sfx.coin(1.6);
        A.popup("+5", st.x + offX, st.y - camY - 20, "#ffe76a");
        parts.emit(st.x, st.y, { n: 16, color: ["#ffe76a", "#fff"], speed: 180, life: 0.5 });
      }
    }

    // trail
    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > 22) player.trail.shift();

    // camera follows the highest reached planet
    var focus = player.state === "orbit" ? player.p.y : Math.min(player.y, player.left ? player.left.y : player.y);
    var target = focus - view.h * 0.68;
    if (target < camY) camY += (target - camY) * Math.min(1, dt * 3);
    else camY += (target - camY) * Math.min(1, dt * 1.5);

    // cull
    while (planets.length && planets[0].y > camY + view.h + 300 && planets[0] !== player.p) planets.shift();
    while (stars2.length && stars2[0].y > camY + view.h + 300) stars2.shift();
  }

  function drawPlanet(p) {
    var x = p.x, y = p.y;
    // orbit path
    ctx.strokeStyle = "hsla(" + p.hue + ",100%,70%,0.25)";
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, p.orbit, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // glow
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    ctx.drawImage(A.glow("hsl(" + p.hue + ",100%,60%)"), x - p.r * 2.6, y - p.r * 2.6, p.r * 5.2, p.r * 5.2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (p.ring) {
      ctx.strokeStyle = "hsla(" + ((p.hue + 40) % 360) + ",90%,75%,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, p.r * 1.8, p.r * 0.45, -0.35, Math.PI, Math.PI * 2); ctx.stroke();
    }
    var g = ctx.createRadialGradient(x - p.r * 0.4, y - p.r * 0.4, p.r * 0.1, x, y, p.r);
    g.addColorStop(0, "hsl(" + p.hue + ",100%,82%)");
    g.addColorStop(0.6, "hsl(" + p.hue + ",80%,52%)");
    g.addColorStop(1, "hsl(" + ((p.hue + 30) % 360) + ",80%,22%)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
    // bands
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = p.r * 0.18;
    for (var b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(p.spin) * 3, y + b * p.r * 0.45, p.r * 1.2, p.r * 0.12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    if (p.ring) {
      ctx.strokeStyle = "hsla(" + ((p.hue + 40) % 360) + ",90%,75%,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, p.r * 1.8, p.r * 0.45, -0.35, 0, Math.PI); ctx.stroke();
    }
    if (p.idx > maxIdx && player && player.state === "orbit" && p.idx === maxIdx + 1) {
      // next target marker
      ctx.strokeStyle = "rgba(255,255,255," + (0.25 + Math.sin(now * 5) * 0.15) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, p.orbit + 6 + Math.sin(now * 5) * 3, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function draw() {
    var W = view.w, H = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.fillStyle = "#fff";
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sy = ((s.y - camY * s.z) % H + H) % H;
      ctx.globalAlpha = 0.3 + s.z * 1.5;
      ctx.fillRect(s.x * W, sy, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    if (!planets) return;

    ctx.translate(offX + shake.x, -camY + shake.y);

    for (var p = 0; p < planets.length; p++) drawPlanet(planets[p]);

    // star pickups
    for (var k = 0; k < stars2.length; k++) {
      var st = stars2[k];
      if (st.got) continue;
      var sc = 1 + Math.sin(st.t * 5) * 0.15;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(A.glow("#ffd23f"), st.x - 20, st.y - 20, 40, 40);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      for (var q = 0; q < 10; q++) {
        var a = q / 10 * Math.PI * 2 - Math.PI / 2 + st.t, r = (q % 2 ? 4 : 9) * sc;
        ctx.lineTo(st.x + Math.cos(a) * r, st.y + Math.sin(a) * r);
      }
      ctx.fill();
    }

    // trail
    if (player && !dead) {
      ctx.globalCompositeOperation = "lighter";
      for (var tI = 0; tI < player.trail.length; tI++) {
        var tp = player.trail[tI], f = tI / player.trail.length;
        ctx.globalAlpha = f * 0.6;
        ctx.fillStyle = "#7ffcff";
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 2 + f * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(A.glow("#00f0ff"), player.x - 26, player.y - 26, 52, 52);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(player.x, player.y, 7, 0, Math.PI * 2); ctx.fill();
      // aim hint: short tangent line while orbiting
      if (player.state === "orbit" && S.playing) {
        var pp = player.p, tx = -Math.sin(player.a) * pp.dir, ty = Math.cos(player.a) * pp.dir;
        var grd = ctx.createLinearGradient(player.x, player.y, player.x + tx * 90, player.y + ty * 90);
        grd.addColorStop(0, "rgba(255,255,255,0.5)"); grd.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = grd; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.x + tx * 90, player.y + ty * 90); ctx.stroke();
      }
    }

    parts.draw(ctx);
  }

  reset();
  A.loop(function (dt) {
    if (S.paused) { draw(); return; }
    now += dt;
    if (S.playing && !dead) update(dt);
    else if (!S.playing && !dead) {
      // attract mode: orbit the first planet
      player.a += player.p.dir * player.p.w * dt;
      player.x = player.p.x + Math.cos(player.a) * player.rad;
      player.y = player.p.y + Math.sin(player.a) * player.rad;
      player.trail.push({ x: player.x, y: player.y });
      if (player.trail.length > 22) player.trail.shift();
    }
    parts.update(dt);
    shake.update(dt);
    draw();
  });
  window.addEventListener("resize", function () { if (!S.playing) reset(); else worldW(); });
})();
