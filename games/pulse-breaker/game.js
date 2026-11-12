/* Pulse Breaker — neon brick breaker with power-ups and endless procedural levels */
(function () {
  "use strict";
  var A = Arcade, sfx = A.sfx, rand = A.rand;

  var S = A.shell({
    id: "pulse-breaker",
    title: "Pulse Breaker",
    howto: "Move the paddle with your <b>mouse</b>, finger, or <kbd>&larr;</kbd><kbd>&rarr;</kbd>. Click / <kbd>Space</kbd> to launch.<br>Catch power-ups: <span style='color:#00f0ff'>multi-ball</span>, <span style='color:#7cff6b'>wide</span>, <span style='color:#ffd23f'>fireball</span>, <span style='color:#ff4d8d'>extra life</span>.",
    onStart: reset
  });

  var canvas = document.getElementById("c");
  var view = A.fitCanvas(canvas, layout);
  var ctx = view.ctx;
  var parts = new A.Particles(800);
  var shake = new A.Shake();

  // logical play-field; scaled to fit the screen
  var LW = 480, LH = 720, scale = 1, ox = 0, oy = 0;
  function layout() {
    scale = Math.min(view.w / LW, (view.h - 56) / LH);
    ox = (view.w - LW * scale) / 2;
    oy = 56 + (view.h - 56 - LH * scale) / 2;
  }

  var COLS = 10, BW = 44, BH = 18, GAP = 4, TOP = 70;
  var ROW_COLORS = ["#ff2a8a", "#ff7a2f", "#ffd23f", "#7cff6b", "#00e5ff", "#4d7cff", "#b14bff"];

  var paddle, balls, bricks, drops, lives, level, stuck, fireT, wideT, combo, keys = {};

  function makeLevel(n) {
    bricks = [];
    var rows = Math.min(9, 5 + Math.floor(n / 2));
    var pattern = n % 5;
    var x0 = (LW - (COLS * BW + (COLS - 1) * GAP)) / 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < COLS; c++) {
        var keep = true;
        if (pattern === 1) keep = (r + c) % 2 === 0 || r < 2;
        else if (pattern === 2) keep = Math.abs(c - 4.5) < r * 0.7 + 1;
        else if (pattern === 3) keep = !(c >= 3 && c <= 6 && r >= 2 && r <= rows - 2);
        else if (pattern === 4) keep = Math.random() < 0.78;
        if (!keep) continue;
        var hp = 1 + (r < Math.floor(n / 2) ? 1 : 0) + (n > 3 && Math.random() < 0.12 ? 1 : 0);
        var steel = n > 2 && Math.random() < 0.04;
        bricks.push({ x: x0 + c * (BW + GAP), y: TOP + r * (BH + GAP), w: BW, h: BH, hp: steel ? 999 : hp, max: hp, color: ROW_COLORS[r % ROW_COLORS.length], steel: steel, hit: 0 });
      }
    }
  }

  function newBall(x, y, vx, vy) {
    return { x: x, y: y, vx: vx, vy: vy, r: 7, trail: [] };
  }

  function baseSpeed() { return 420 + level * 22; }

  function serve() {
    stuck = true;
    balls = [newBall(paddle.x, paddle.y - 14, 0, 0)];
  }

  function reset() {
    paddle = { x: LW / 2, y: LH - 50, w: 92, h: 14, target: LW / 2 };
    lives = 3; level = 1; drops = []; fireT = 0; wideT = 0; combo = 0;
    parts.clear();
    makeLevel(level);
    serve();
  }

  function launch() {
    if (!S.playing || !stuck) return;
    stuck = false;
    var a = -Math.PI / 2 + rand(-0.35, 0.35);
    balls[0].vx = Math.cos(a) * baseSpeed();
    balls[0].vy = Math.sin(a) * baseSpeed();
    sfx.jump();
  }

  function toLogical(cx) { return (cx - ox) / scale; }
  window.addEventListener("pointermove", function (e) { if (S.playing) paddle.target = toLogical(e.clientX); });
  window.addEventListener("pointerdown", function (e) { if (S.playing) { paddle.target = toLogical(e.clientX); launch(); } });
  window.addEventListener("keydown", function (e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === " " || e.key === "ArrowUp") launch();
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });

  function spawnDrop(x, y) {
    var r = Math.random();
    var type = r < 0.35 ? "multi" : r < 0.65 ? "wide" : r < 0.88 ? "fire" : "life";
    drops.push({ x: x, y: y, type: type, vy: 140 });
  }
  var DROP_COLOR = { multi: "#00f0ff", wide: "#7cff6b", fire: "#ffd23f", life: "#ff4d8d" };
  var DROP_LABEL = { multi: "3", wide: "↔", fire: "✹", life: "♥" };

  function hitBrick(b, ball) {
    if (b.steel && fireT <= 0) { b.hit = 0.15; sfx.tone(1800, 0.04, "square", 0.05); return; }
    b.hp -= fireT > 0 ? 99 : 1;
    b.hit = 0.12;
    combo++;
    if (b.hp <= 0) {
      b.dead = true;
      var pts = (b.steel ? 50 : 10 * b.max) * Math.min(8, 1 + Math.floor(combo / 4));
      S.addScore(pts);
      S.setBestLive();
      parts.emit(b.x + b.w / 2, b.y + b.h / 2, { n: 14, color: [b.color, "#fff"], speed: 260, life: 0.55, size: 4, gravity: 600 });
      sfx.tone(300 + Math.min(combo, 24) * 40, 0.08, "square", 0.08);
      if (Math.random() < 0.13) spawnDrop(b.x + b.w / 2, b.y + b.h / 2);
      if (combo > 0 && combo % 8 === 0) A.popup("COMBO x" + combo, ox + (b.x + b.w / 2) * scale, oy + b.y * scale, "#ffd23f");
    } else {
      sfx.tone(600, 0.04, "triangle", 0.08);
    }
  }

  function collideBall(ball) {
    // walls
    if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); sfx.blip(0.7); }
    if (ball.x > LW - ball.r) { ball.x = LW - ball.r; ball.vx = -Math.abs(ball.vx); sfx.blip(0.7); }
    if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); sfx.blip(0.7); }

    // paddle
    var pw = paddle.w / 2;
    if (ball.vy > 0 && ball.y + ball.r > paddle.y - paddle.h / 2 && ball.y - ball.r < paddle.y + paddle.h / 2 && Math.abs(ball.x - paddle.x) < pw + ball.r) {
      var off = (ball.x - paddle.x) / pw; // -1..1
      off = A.clamp(off, -1, 1);
      var a = -Math.PI / 2 + off * 1.05;
      var sp = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp;
      ball.y = paddle.y - paddle.h / 2 - ball.r;
      combo = 0;
      sfx.tone(220, 0.07, "square", 0.1, 120);
      parts.emit(ball.x, ball.y + ball.r, { n: 6, color: "#00f0ff", speed: 120, life: 0.3, angle: -Math.PI / 2, spread: 2 });
    }

    // bricks
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (b.dead) continue;
      var cx = A.clamp(ball.x, b.x, b.x + b.w), cy = A.clamp(ball.y, b.y, b.y + b.h);
      var dx = ball.x - cx, dy = ball.y - cy;
      if (dx * dx + dy * dy < ball.r * ball.r) {
        hitBrick(b, ball);
        if (fireT > 0 && !b.steel) continue; // fireball plows through
        if (fireT > 0 && b.steel && b.dead) continue;
        // resolve along the axis of least penetration
        var overX = ball.vx > 0 ? ball.x + ball.r - b.x : b.x + b.w - (ball.x - ball.r);
        var overY = ball.vy > 0 ? ball.y + ball.r - b.y : b.y + b.h - (ball.y - ball.r);
        if (overX < overY) { ball.vx = -ball.vx; ball.x += ball.vx > 0 ? overX : -overX; }
        else { ball.vy = -ball.vy; ball.y += ball.vy > 0 ? overY : -overY; }
        break;
      }
    }
  }

  function loseLife() {
    lives--;
    combo = 0;
    shake.add(10, 0.35);
    sfx.hit();
    fireT = 0; wideT = 0;
    if (lives <= 0) {
      sfx.over();
      S.gameOver('<div class="ub-label" style="margin-top:10px">Reached level ' + level + "</div>");
      return;
    }
    serve();
  }

  function update(dt) {
    // paddle
    if (keys["arrowleft"] || keys["a"]) paddle.target -= 700 * dt;
    if (keys["arrowright"] || keys["d"]) paddle.target += 700 * dt;
    var targetW = wideT > 0 ? 150 : 92;
    paddle.w += (targetW - paddle.w) * Math.min(1, dt * 10);
    paddle.target = A.clamp(paddle.target, paddle.w / 2, LW - paddle.w / 2);
    paddle.x += (paddle.target - paddle.x) * Math.min(1, dt * 22);
    if (fireT > 0) fireT -= dt;
    if (wideT > 0) wideT -= dt;

    if (stuck) { balls[0].x = paddle.x; balls[0].y = paddle.y - paddle.h / 2 - balls[0].r - 1; }
    else {
      var sp = baseSpeed();
      for (var i = balls.length - 1; i >= 0; i--) {
        var ball = balls[i];
        // keep speed constant and avoid near-horizontal trajectories
        var cur = Math.hypot(ball.vx, ball.vy) || 1;
        ball.vx = ball.vx / cur * sp; ball.vy = ball.vy / cur * sp;
        if (Math.abs(ball.vy) < sp * 0.25) { ball.vy = (ball.vy < 0 ? -1 : 1) * sp * 0.25; }
        var steps = Math.ceil(sp * dt / 4);
        for (var s = 0; s < steps; s++) {
          ball.x += ball.vx * dt / steps;
          ball.y += ball.vy * dt / steps;
          collideBall(ball);
        }
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 10) ball.trail.shift();
        if (fireT > 0) parts.emit(ball.x, ball.y, { n: 1, color: ["#ffd23f", "#ff7a2f"], speed: 50, life: 0.35, size: 5 });
        if (ball.y > LH + 30) balls.splice(i, 1);
      }
      if (!balls.length) { loseLife(); return; }
    }

    bricks = bricks.filter(function (b) { if (b.hit > 0) b.hit -= dt; return !b.dead; });
    if (!bricks.some(function (b) { return !b.steel; })) {
      level++;
      S.addScore(250);
      A.popup("LEVEL " + level, view.w / 2, view.h * 0.45, "#00f0ff", 34);
      sfx.levelup();
      makeLevel(level);
      drops = [];
      serve();
    }

    for (var d = drops.length - 1; d >= 0; d--) {
      var dr = drops[d];
      dr.y += dr.vy * dt;
      if (dr.y > paddle.y - 14 && dr.y < paddle.y + 14 && Math.abs(dr.x - paddle.x) < paddle.w / 2 + 12) {
        drops.splice(d, 1);
        sfx.power();
        A.popup({ multi: "MULTI-BALL", wide: "WIDE PADDLE", fire: "FIREBALL", life: "+1 LIFE" }[dr.type], ox + dr.x * scale, oy + (paddle.y - 30) * scale, DROP_COLOR[dr.type]);
        if (dr.type === "multi") {
          var src = balls.slice(0, 3);
          src.forEach(function (b) {
            for (var k = 0; k < 2; k++) {
              var a = Math.atan2(b.vy, b.vx) + (k ? 0.4 : -0.4);
              balls.push(newBall(b.x, b.y, Math.cos(a) * 400, Math.sin(a) * 400));
            }
          });
          if (stuck) launch();
        } else if (dr.type === "wide") wideT = 14;
        else if (dr.type === "fire") fireT = 7;
        else if (dr.type === "life") lives = Math.min(6, lives + 1);
        continue;
      }
      if (dr.y > LH + 20) drops.splice(d, 1);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  var t = 0;
  function draw() {
    var W = view.w, H = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = "#05010d"; ctx.fillRect(0, 0, W, H);
    ctx.translate(ox + shake.x, oy + shake.y);
    ctx.scale(scale, scale);

    // arena
    var g = ctx.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, "#150535"); g.addColorStop(1, "#0a0220");
    ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
    ctx.strokeStyle = "rgba(140,80,255,0.09)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 0; gx <= LW; gx += 40) { ctx.moveTo(gx, 0); ctx.lineTo(gx, LH); }
    for (var gy = 0; gy <= LH; gy += 40) { ctx.moveTo(0, gy); ctx.lineTo(LW, gy); }
    ctx.stroke();
    ctx.strokeStyle = "#00f0ff"; ctx.lineWidth = 2;
    ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 14;
    ctx.strokeRect(0, 0, LW, LH);
    ctx.shadowBlur = 0;

    if (!bricks) return;

    // bricks
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      ctx.globalAlpha = 0.25;
      ctx.drawImage(A.glow(b.steel ? "#9aa3c7" : b.color), b.x - 10, b.y - 14, b.w + 20, b.h + 28);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    for (var j = 0; j < bricks.length; j++) {
      var br = bricks[j];
      var col = br.steel ? "#8890b0" : br.color;
      ctx.fillStyle = br.hit > 0 ? "#fff" : col;
      ctx.globalAlpha = br.steel ? 1 : 0.35 + 0.65 * (br.hp / br.max);
      roundRect(br.x, br.y, br.w, br.h, 4); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(br.x + 4, br.y + 3, br.w - 8, 3);
      if (br.steel) { ctx.strokeStyle = "#dfe6ff"; ctx.lineWidth = 1.5; roundRect(br.x + 1, br.y + 1, br.w - 2, br.h - 2, 4); ctx.stroke(); }
      else if (br.max > 1 && br.hp > 1) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.font = "800 12px 'Exo 2', sans-serif"; ctx.textAlign = "center"; ctx.fillText(br.hp, br.x + br.w / 2, br.y + 14); }
    }

    // drops
    for (var d = 0; d < drops.length; d++) {
      var dr = drops[d], c = DROP_COLOR[dr.type];
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(A.glow(c), dr.x - 24, dr.y - 24, 48, 48);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = c;
      roundRect(dr.x - 14, dr.y - 9, 28, 18, 9); ctx.fill();
      ctx.fillStyle = "#08010f"; ctx.font = "900 12px Orbitron, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(DROP_LABEL[dr.type], dr.x, dr.y + 4.5);
    }

    // paddle
    var pc = fireT > 0 ? "#ffd23f" : wideT > 0 ? "#7cff6b" : "#00f0ff";
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.6;
    ctx.drawImage(A.glow(pc), paddle.x - paddle.w * 0.8, paddle.y - 30, paddle.w * 1.6, 60);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    var pg = ctx.createLinearGradient(0, paddle.y - 7, 0, paddle.y + 7);
    pg.addColorStop(0, "#fff"); pg.addColorStop(0.4, pc); pg.addColorStop(1, "#063a4a");
    ctx.fillStyle = pg;
    roundRect(paddle.x - paddle.w / 2, paddle.y - paddle.h / 2, paddle.w, paddle.h, 7); ctx.fill();

    // balls
    for (var k = 0; k < balls.length; k++) {
      var bl = balls[k];
      ctx.globalCompositeOperation = "lighter";
      for (var tr = 0; tr < bl.trail.length; tr++) {
        var tp = bl.trail[tr], f = tr / bl.trail.length;
        ctx.globalAlpha = f * 0.35;
        ctx.fillStyle = fireT > 0 ? "#ff9f43" : "#7ffcff";
        ctx.beginPath(); ctx.arc(tp.x, tp.y, bl.r * f, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(A.glow(fireT > 0 ? "#ff9f43" : "#00f0ff"), bl.x - 22, bl.y - 22, 44, 44);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(bl.x, bl.y, bl.r, 0, Math.PI * 2); ctx.fill();
    }

    parts.draw(ctx);

    // lives / level
    ctx.font = "800 15px 'Exo 2', sans-serif"; ctx.textAlign = "left";
    ctx.fillStyle = "#ff4d8d";
    var hearts = ""; for (var l = 0; l < lives; l++) hearts += "♥ ";
    ctx.fillText(hearts, 12, LH - 14);
    ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("LEVEL " + level, LW - 12, LH - 14);
    if (stuck && S.playing) {
      ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255," + (0.5 + Math.sin(t * 5) * 0.3) + ")";
      ctx.font = "700 16px Orbitron, sans-serif";
      ctx.fillText("CLICK / SPACE TO LAUNCH", LW / 2, LH * 0.62);
    }
  }

  layout();
  reset();
  A.loop(function (dt) {
    t += dt;
    if (S.paused) { draw(); return; }
    if (S.playing) update(dt);
    else if (paddle) {
      // attract: paddle drifts
      paddle.x = LW / 2 + Math.sin(t) * 120;
      if (stuck) { balls[0].x = paddle.x; }
    }
    parts.update(dt);
    shake.update(dt);
    draw();
  });
})();
