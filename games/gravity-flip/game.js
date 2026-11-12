/* Gravity Flip — one-button runner: flip between floor and ceiling to dodge hazards */
(function () {
  "use strict";
  var A = Arcade, sfx = A.sfx, rand = A.rand;

  var S = A.shell({
    id: "gravity-flip",
    title: "Gravity Flip",
    howto: "Tap, click or press <kbd>Space</kbd> to flip gravity.<br>Dodge <span style='color:#ff2a8a'>spikes</span> and don't fall through <b>gaps</b>. Snag <span style='color:#ffd23f'>orbs</span> mid-flip for bonus points.",
    onStart: reset
  });

  var canvas = document.getElementById("c");
  var view = A.fitCanvas(canvas, layout);
  var ctx = view.ctx;
  var parts = new A.Particles(600);
  var shake = new A.Shake();

  var LH = 420, scale = 1, LW = 800;
  var CEIL = 110, FLOOR = 340, PS = 26, SPIKE = 24;
  function layout() { scale = Math.min(view.h / LH, view.w / 320); LW = view.w / scale; }

  var city = [];
  function buildCity() {
    city = [];
    for (var layer = 0; layer < 2; layer++) {
      var x = 0, arr = [];
      while (x < 3000) { var w = rand(30, 90); arr.push({ x: x, w: w, h: rand(40, 150) * (layer ? 0.6 : 1) }); x += w + rand(0, 12); }
      city.push(arr);
    }
  }
  buildCity();

  var pl, hazards, orbs, dist, speed, nextX, buffer, alive, camX, lastSide, deadT;

  function reset() {
    layout();
    pl = { x: 0, y: FLOOR - PS, vy: 0, g: 1, grounded: true, rot: 0, trail: [] };
    hazards = []; orbs = [];
    dist = 0; bonus = 0; speed = 280; nextX = 600; buffer = 0; alive = true; camX = 0; lastSide = null; deadT = 0;
    parts.clear();
    while (nextX < 2400) gen();
  }

  function gen() {
    var diff = Math.min(1, dist / 12000);
    var side = Math.random() < 0.5 ? "floor" : "ceil";
    var kind = Math.random() < 0.35 + diff * 0.15 ? "gap" : "spike";
    var len = rand(70, 180 + diff * 160);
    var gapNeeded;
    var flipDist = speed * 0.5 + PS + 20;
    if (lastSide && lastSide !== side) gapNeeded = flipDist + rand(30, 220) * (1.2 - diff * 0.8);
    else gapNeeded = rand(50, 220) * (1.2 - diff * 0.6);
    var x = nextX + gapNeeded;
    hazards.push({ x: x, len: len, side: side, kind: kind });
    // orb in the middle of the corridor in the flip window
    if (lastSide && lastSide !== side && Math.random() < 0.6) orbs.push({ x: x - gapNeeded / 2, y: (CEIL + FLOOR) / 2, got: false, t: Math.random() * 6 });
    // occasional double hazard (same side) for rhythm
    nextX = x + len;
    lastSide = side;
  }

  function surfaceAt(side, x) {
    for (var i = 0; i < hazards.length; i++) {
      var h = hazards[i];
      if (h.kind === "gap" && h.side === side && x > h.x && x < h.x + h.len) return false;
    }
    return true;
  }

  function flip() {
    if (!S.playing || !alive) return;
    if (pl.grounded) doFlip();
    else buffer = 0.14;
  }
  function doFlip() {
    pl.g = -pl.g;
    pl.grounded = false;
    pl.vy = pl.g * 120;
    buffer = 0;
    sfx.tone(pl.g > 0 ? 520 : 780, 0.08, "triangle", 0.14, pl.g > 0 ? -200 : 200);
    parts.emit(pl.x + PS / 2, pl.g > 0 ? CEIL : FLOOR, { n: 8, color: "#00f0ff", speed: 160, life: 0.35 });
  }

  window.addEventListener("pointerdown", function (e) { if (e.button === 0 || e.pointerType !== "mouse") flip(); });
  window.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "w" || e.key === "s") flip(); });

  function die() {
    alive = false;
    deadT = 0;
    shake.add(12, 0.4);
    sfx.boom();
    setTimeout(sfx.over, 300);
    parts.emit(pl.x + PS / 2, pl.y + PS / 2, { n: 60, color: ["#00f0ff", "#fff", "#ff2a8a"], speed: 380, life: 0.9, size: 5 });
    S.gameOver('<div class="ub-label" style="margin-top:10px">' + Math.floor(dist / 10) + " m</div>");
  }

  function update(dt) {
    speed = Math.min(600, 280 + dist * 0.016);
    var dx = speed * dt;
    dist += dx;
    pl.x += dx;
    camX = pl.x - LW * 0.25;

    // physics
    var wasGrounded = pl.grounded;
    pl.vy += pl.g * 2900 * dt;
    pl.y += pl.vy * dt;
    pl.grounded = false;
    var cx = pl.x + PS / 2;
    if (pl.g > 0 && pl.y + PS >= FLOOR && pl.y + PS <= FLOOR + 30 && surfaceAt("floor", cx)) { pl.y = FLOOR - PS; pl.vy = 0; pl.grounded = true; }
    if (pl.g < 0 && pl.y <= CEIL && pl.y >= CEIL - 30 && surfaceAt("ceil", cx)) { pl.y = CEIL; pl.vy = 0; pl.grounded = true; }
    if (pl.grounded && !wasGrounded) {
      parts.emit(cx, pl.g > 0 ? FLOOR : CEIL, { n: 6, color: "#b14bff", speed: 120, life: 0.3 });
      if (buffer > 0) doFlip();
    }
    if (buffer > 0) buffer -= dt;
    var targetRot = pl.g > 0 ? 0 : Math.PI;
    pl.rot += (targetRot - pl.rot) * Math.min(1, dt * 14);

    if (pl.y > LH + 60 || pl.y < -60 - PS) { die(); return; }

    // hazards
    for (var i = 0; i < hazards.length; i++) {
      var h = hazards[i];
      if (h.kind !== "spike") continue;
      if (pl.x + PS - 4 > h.x && pl.x + 4 < h.x + h.len) {
        if (h.side === "floor" && pl.y + PS > FLOOR - SPIKE + 4) { die(); return; }
        if (h.side === "ceil" && pl.y < CEIL + SPIKE - 4) { die(); return; }
      }
    }
    // orbs
    for (var o = 0; o < orbs.length; o++) {
      var ob = orbs[o];
      ob.t += dt;
      if (!ob.got && Math.abs(ob.x - cx) < 22 && Math.abs(ob.y - (pl.y + PS / 2)) < 26) {
        ob.got = true;
        bonus += 25;
        sfx.coin(1.3);
        parts.emit(ob.x, ob.y, { n: 18, color: ["#ffd23f", "#fff"], speed: 200, life: 0.5 });
        A.popup("+25", (ob.x - camX) * scale, ob.y * scale - 20, "#ffd23f");
      }
    }

    while (hazards.length && hazards[0].x + hazards[0].len < camX - 100) hazards.shift();
    while (orbs.length && orbs[0].x < camX - 100) orbs.shift();
    while (nextX < camX + LW + 600) gen();

    pl.trail.push({ x: pl.x, y: pl.y, r: pl.rot });
    if (pl.trail.length > 12) pl.trail.shift();
    S.setScore(Math.floor(dist / 10) + bonus);
  }
  var bonus = 0;

  function draw(t) {
    var W = view.w, H = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a0322"); bg.addColorStop(0.5, "#1d0640"); bg.addColorStop(1, "#08020f");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.scale(scale, scale);
    ctx.translate(shake.x, (H / scale - LH) / 2 + shake.y);

    // parallax city
    var cols = ["rgba(90,30,160,0.35)", "rgba(40,10,90,0.6)"];
    for (var l = 0; l < 2; l++) {
      var par = l ? 0.4 : 0.15, base = l ? LH : LH - 30;
      ctx.fillStyle = cols[l];
      var off = (camX * par) % 3000;
      for (var rep = 0; rep < 2; rep++) {
        for (var b = 0; b < city[l].length; b++) {
          var bd = city[l][b], bx = bd.x - off + rep * 3000;
          if (bx > LW || bx + bd.w < 0) continue;
          ctx.fillRect(bx, base - bd.h - (l ? 0 : 60), bd.w, bd.h + 200);
        }
      }
    }

    // corridor tint
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, CEIL, LW, FLOOR - CEIL);
    // moving grid lines inside corridor
    ctx.strokeStyle = "rgba(0,240,255,0.06)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = -(camX % 40); gx < LW; gx += 40) { ctx.moveTo(gx, CEIL); ctx.lineTo(gx, FLOOR); }
    ctx.stroke();

    ctx.translate(-camX, 0);

    // surfaces (draw segments with gaps cut out)
    ["floor", "ceil"].forEach(function (side) {
      var y = side === "floor" ? FLOOR : CEIL;
      var gaps = hazards.filter(function (h) { return h.kind === "gap" && h.side === side; });
      var x0 = camX - 10, x1 = camX + LW + 10;
      ctx.strokeStyle = "#00f0ff"; ctx.lineWidth = 3;
      ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 12;
      ctx.beginPath();
      var cur = x0;
      gaps.forEach(function (gp) {
        if (gp.x + gp.len < x0 || gp.x > x1) return;
        if (gp.x > cur) { ctx.moveTo(cur, y); ctx.lineTo(gp.x, y); }
        cur = Math.max(cur, gp.x + gp.len);
      });
      if (cur < x1) { ctx.moveTo(cur, y); ctx.lineTo(x1, y); }
      ctx.stroke();
      ctx.shadowBlur = 0;
      // fill outside the corridor
      ctx.fillStyle = "rgba(0,240,255,0.06)";
      cur = x0;
      gaps.forEach(function (gp) {
        if (gp.x + gp.len < x0 || gp.x > x1) return;
        if (gp.x > cur) ctx.fillRect(cur, side === "floor" ? y : y - 400, gp.x - cur, 400);
        cur = Math.max(cur, gp.x + gp.len);
      });
      if (cur < x1) ctx.fillRect(cur, side === "floor" ? y : y - 400, x1 - cur, 400);
      // gap warning glow
      gaps.forEach(function (gp) {
        if (gp.x + gp.len < x0 || gp.x > x1) return;
        var gg = ctx.createLinearGradient(0, y, 0, side === "floor" ? y + 60 : y - 60);
        gg.addColorStop(0, "rgba(255,42,138,0.35)"); gg.addColorStop(1, "rgba(255,42,138,0)");
        ctx.fillStyle = gg;
        ctx.fillRect(gp.x, side === "floor" ? y : y - 60, gp.len, 60);
      });
    });

    // spikes
    ctx.fillStyle = "#ff2a8a";
    ctx.shadowColor = "#ff2a8a"; ctx.shadowBlur = 14;
    for (var i = 0; i < hazards.length; i++) {
      var h = hazards[i];
      if (h.kind !== "spike" || h.x > camX + LW || h.x + h.len < camX) continue;
      var n = Math.max(1, Math.round(h.len / 20)), w = h.len / n;
      ctx.beginPath();
      for (var k = 0; k < n; k++) {
        var sx = h.x + k * w;
        if (h.side === "floor") { ctx.moveTo(sx, FLOOR); ctx.lineTo(sx + w / 2, FLOOR - SPIKE); ctx.lineTo(sx + w, FLOOR); }
        else { ctx.moveTo(sx, CEIL); ctx.lineTo(sx + w / 2, CEIL + SPIKE); ctx.lineTo(sx + w, CEIL); }
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // orbs
    for (var o = 0; o < orbs.length; o++) {
      var ob = orbs[o];
      if (ob.got) continue;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(A.glow("#ffd23f"), ob.x - 22, ob.y - 22, 44, 44);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff6c2";
      ctx.beginPath(); ctx.arc(ob.x, ob.y + Math.sin(ob.t * 5) * 3, 6, 0, Math.PI * 2); ctx.fill();
    }

    // player
    if (pl && (alive || !S.playing && deadT > 1.5)) {
      ctx.globalCompositeOperation = "lighter";
      for (var tI = 0; tI < pl.trail.length; tI++) {
        var tp = pl.trail[tI], f = tI / pl.trail.length;
        ctx.globalAlpha = f * 0.3;
        ctx.fillStyle = "#00f0ff";
        ctx.fillRect(tp.x + PS * (1 - f) / 2, tp.y + PS * (1 - f) / 2, PS * f, PS * f);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(A.glow("#00f0ff"), pl.x - PS, pl.y - PS, PS * 3, PS * 3);
      ctx.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.translate(pl.x + PS / 2, pl.y + PS / 2);
      ctx.rotate(pl.rot);
      ctx.fillStyle = "#0b2a3a"; ctx.fillRect(-PS / 2, -PS / 2, PS, PS);
      ctx.strokeStyle = "#7ffcff"; ctx.lineWidth = 3; ctx.strokeRect(-PS / 2 + 1.5, -PS / 2 + 1.5, PS - 3, PS - 3);
      ctx.fillStyle = "#e8ffff"; ctx.fillRect(2, -6, 6, 6);
      ctx.restore();
    }

    parts.draw(ctx);
  }

  reset();
  A.loop(function (dt, t) {
    if (S.paused) { draw(t); return; }
    if (S.playing && alive) update(dt);
    else if (!S.playing && alive) {
      // attract mode: auto-pilot that flips just in time
      var cx = pl.x + PS / 2;
      pl.x += 260 * dt; camX = pl.x - LW * 0.25;
      var sideNow = pl.g > 0 ? "floor" : "ceil";
      var danger = hazards.some(function (h) { return h.side === sideNow && h.x - cx < 70 && h.x + h.len > cx; });
      if (danger && pl.grounded) { pl.g = -pl.g; pl.grounded = false; pl.vy = pl.g * 120; }
      pl.vy += pl.g * 2900 * dt; pl.y += pl.vy * dt;
      if (pl.g > 0 && pl.y + PS >= FLOOR) { pl.y = FLOOR - PS; pl.vy = 0; pl.grounded = true; }
      if (pl.g < 0 && pl.y <= CEIL) { pl.y = CEIL; pl.vy = 0; pl.grounded = true; }
      pl.rot += ((pl.g > 0 ? 0 : Math.PI) - pl.rot) * Math.min(1, dt * 14);
      while (hazards.length && hazards[0].x + hazards[0].len < camX - 100) hazards.shift();
      while (nextX < camX + LW + 600) gen();
      pl.trail.push({ x: pl.x, y: pl.y }); if (pl.trail.length > 12) pl.trail.shift();
    }
    if (!alive) { deadT += dt; if (!S.playing && deadT > 1.5) reset(); }
    parts.update(dt);
    shake.update(dt);
    draw(t);
  });
})();
