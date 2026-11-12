/* Glow Serpent — neon snake with smooth movement, golden bonuses and speed ramp */
(function () {
  "use strict";
  var A = Arcade, sfx = A.sfx;

  var S = A.shell({
    id: "glow-serpent",
    title: "Glow Serpent",
    howto: "Steer with <kbd>&larr;</kbd><kbd>&uarr;</kbd><kbd>&darr;</kbd><kbd>&rarr;</kbd> or <kbd>WASD</kbd> &mdash; swipe on touch.<br>Eat orbs to grow. <span style='color:#ffd23f'>Golden orbs</span> are worth 5&times; but vanish fast. Don't bite yourself or the walls.",
    onStart: reset
  });

  var canvas = document.getElementById("c");
  var view = A.fitCanvas(canvas, function () { if (!S.playing) layout(); });
  var ctx = view.ctx;
  var parts = new A.Particles(600);
  var shake = new A.Shake();

  var cell, cols, rows, bx, by;
  function layout() {
    var W = view.w, H = view.h - 70;
    cell = Math.max(16, Math.min(34, Math.floor(Math.min(W, H) / 19)));
    cols = Math.min(32, Math.floor((W - 20) / cell));
    rows = Math.min(24, Math.floor((H - 20) / cell));
    bx = Math.floor((W - cols * cell) / 2);
    by = 60 + Math.floor((H - rows * cell) / 2);
  }
  layout();

  var snake, prev, dir, queue, food, gold, stepT, acc, eaten, alive, growBy, deathT, foodPulse;

  function reset() {
    layout();
    var cx = Math.floor(cols / 2) - 3, cy = Math.floor(rows / 2);
    snake = [{ x: cx + 2, y: cy }, { x: cx + 1, y: cy }, { x: cx, y: cy }];
    prev = snake.map(function (s) { return { x: s.x - 1, y: s.y }; });
    dir = { x: 1, y: 0 }; queue = [];
    stepT = 0.115; acc = 0; eaten = 0; alive = true; growBy = 0; gold = null; deathT = 0;
    parts.clear();
    placeFood();
  }

  function free(x, y) {
    for (var i = 0; i < snake.length; i++) if (snake[i].x === x && snake[i].y === y) return false;
    if (food && food.x === x && food.y === y) return false;
    if (gold && gold.x === x && gold.y === y) return false;
    return true;
  }
  function randFree() {
    for (var tries = 0; tries < 500; tries++) {
      var x = (Math.random() * cols) | 0, y = (Math.random() * rows) | 0;
      if (free(x, y)) return { x: x, y: y };
    }
    return { x: 0, y: 0 };
  }
  function placeFood() { food = null; food = randFree(); foodPulse = 0; }

  function turn(x, y) {
    if (!S.playing || !alive) return;
    var last = queue.length ? queue[queue.length - 1] : dir;
    if ((x === -last.x && y === -last.y) || (x === last.x && y === last.y)) return;
    if (queue.length < 3) queue.push({ x: x, y: y });
  }

  window.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    if (k === "arrowup" || k === "w") turn(0, -1);
    else if (k === "arrowdown" || k === "s") turn(0, 1);
    else if (k === "arrowleft" || k === "a") turn(-1, 0);
    else if (k === "arrowright" || k === "d") turn(1, 0);
  });
  var sw = null;
  window.addEventListener("pointerdown", function (e) { sw = { x: e.clientX, y: e.clientY }; });
  window.addEventListener("pointermove", function (e) {
    if (!sw) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0); else turn(0, dy > 0 ? 1 : -1);
    sw = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("pointerup", function () { sw = null; });

  function px(c) { return bx + c * cell + cell / 2; }
  function py(c) { return by + c * cell + cell / 2; }

  function step() {
    if (queue.length) dir = queue.shift();
    var head = snake[0];
    var nx = head.x + dir.x, ny = head.y + dir.y;
    // self collision ignores the tail tip when it is about to move away
    var hitSelf = false;
    for (var i = 0; i < snake.length - (growBy > 0 ? 0 : 1); i++) if (snake[i].x === nx && snake[i].y === ny) hitSelf = true;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || hitSelf) { die(); return; }

    prev = snake.map(function (s) { return { x: s.x, y: s.y }; });
    snake.unshift({ x: nx, y: ny });
    if (growBy > 0) growBy--; else snake.pop();

    if (food && nx === food.x && ny === food.y) {
      eaten++;
      growBy += 1;
      S.addScore(10);
      sfx.coin(1 + Math.min(eaten, 40) * 0.015);
      parts.emit(px(nx), py(ny), { n: 18, color: ["#ff2a8a", "#ff9ad5", "#fff"], speed: 220, life: 0.5 });
      stepT = Math.max(0.055, 0.115 - eaten * 0.0015);
      placeFood();
      if (eaten % 5 === 0 && !gold) {
        var g = randFree();
        gold = { x: g.x, y: g.y, life: 5.5, max: 5.5 };
        sfx.power();
      }
    }
    if (gold && nx === gold.x && ny === gold.y) {
      growBy += 3;
      S.addScore(50);
      sfx.levelup();
      A.popup("+50", px(nx), py(ny) - 20, "#ffd23f", 26);
      parts.emit(px(nx), py(ny), { n: 36, color: ["#ffd23f", "#fff", "#ff9f43"], speed: 300, life: 0.7 });
      shake.add(4, 0.2);
      gold = null;
    }
  }

  function die() {
    alive = false;
    deathT = 0;
    shake.add(10, 0.4);
    sfx.boom();
    setTimeout(sfx.over, 300);
    snake.forEach(function (s, i) {
      parts.emit(px(s.x), py(s.y), { n: 6, color: ["hsl(" + ((180 + i * 6) % 360) + ",100%,65%)", "#fff"], speed: 260, life: 0.8 });
    });
    S.gameOver('<div class="ub-label" style="margin-top:10px">Length ' + snake.length + "</div>");
  }

  var t = 0;
  function draw() {
    var W = view.w, H = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    var bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, "#160631"); bg.addColorStop(1, "#05010d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.translate(shake.x, shake.y);

    // board
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    ctx.fillRect(bx, by, cols * cell, rows * cell);
    ctx.fillStyle = "rgba(160,120,255,0.18)";
    for (var gx = 0; gx <= cols; gx++) for (var gy = 0; gy <= rows; gy++) ctx.fillRect(bx + gx * cell - 1, by + gy * cell - 1, 2, 2);
    ctx.strokeStyle = "rgba(0,240,255,0.7)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 16;
    ctx.strokeRect(bx - 3, by - 3, cols * cell + 6, rows * cell + 6);
    ctx.shadowBlur = 0;

    if (!snake) return;

    // food
    foodPulse += 0.016;
    var fx = px(food.x), fy = py(food.y), fs = cell * (0.32 + Math.sin(t * 6) * 0.04);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(A.glow("#ff2a8a"), fx - cell * 1.2, fy - cell * 1.2, cell * 2.4, cell * 2.4);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffd0ea";
    ctx.beginPath(); ctx.arc(fx, fy, fs, 0, Math.PI * 2); ctx.fill();

    if (gold) {
      var gxp = px(gold.x), gyp = py(gold.y);
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(A.glow("#ffd23f"), gxp - cell * 1.6, gyp - cell * 1.6, cell * 3.2, cell * 3.2);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff3b0";
      ctx.save(); ctx.translate(gxp, gyp); ctx.rotate(t * 2);
      ctx.fillRect(-cell * 0.25, -cell * 0.25, cell * 0.5, cell * 0.5);
      ctx.restore();
      ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(gxp, gyp, cell * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (gold.life / gold.max)); ctx.stroke();
    }

    // snake (interpolated)
    var f = alive ? Math.min(1, acc / stepT) : 1;
    var pts = [];
    for (var i = 0; i < snake.length; i++) {
      var c = snake[i], p = prev[i] || prev[prev.length - 1] || c;
      pts.push({ x: A.lerp(px(p.x), px(c.x), f), y: A.lerp(py(p.y), py(c.y), f) });
    }
    if (alive || deathT < 0.15) {
      ctx.globalCompositeOperation = "lighter";
      for (var g = pts.length - 1; g >= 0; g -= 2) {
        ctx.globalAlpha = 0.35;
        ctx.drawImage(A.glow("hsl(" + ((180 + g * 6) % 360) + ",100%,55%)"), pts[g].x - cell, pts[g].y - cell, cell * 2, cell * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (var s = pts.length - 1; s > 0; s--) {
        ctx.strokeStyle = "hsl(" + ((180 + s * 6) % 360) + ",100%," + (62 - Math.min(20, s * 0.4)) + "%)";
        ctx.lineWidth = cell * (0.78 - Math.min(0.3, s * 0.008));
        ctx.beginPath(); ctx.moveTo(pts[s].x, pts[s].y); ctx.lineTo(pts[s - 1].x, pts[s - 1].y); ctx.stroke();
      }
      // head
      var h = pts[0];
      ctx.fillStyle = "#d9ffff";
      ctx.beginPath(); ctx.arc(h.x, h.y, cell * 0.44, 0, Math.PI * 2); ctx.fill();
      var ex = dir.y !== 0 ? 1 : 0, ey = dir.x !== 0 ? 1 : 0;
      ctx.fillStyle = "#14002a";
      [-1, 1].forEach(function (sgn) {
        ctx.beginPath();
        ctx.arc(h.x + dir.x * cell * 0.15 + ex * sgn * cell * 0.18, h.y + dir.y * cell * 0.15 + ey * sgn * cell * 0.18, cell * 0.08, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    parts.draw(ctx);
  }

  reset();
  A.loop(function (dt) {
    t += dt;
    if (S.paused) { draw(); return; }
    if (S.playing && alive) {
      acc += dt;
      while (acc >= stepT && alive) { acc -= stepT; step(); }
      if (gold) { gold.life -= dt; if (gold.life <= 0) gold = null; }
    } else if (!S.playing && alive) {
      // attract mode: a simple AI chases the food
      acc += dt;
      if (acc >= 0.12) {
        acc = 0;
        var hd = snake[0], opts = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
        var best = null, bd = 1e9;
        opts.forEach(function (o) {
          if (o.x === -dir.x && o.y === -dir.y) return;
          var nx = hd.x + o.x, ny = hd.y + o.y;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
          for (var i = 0; i < snake.length - 1; i++) if (snake[i].x === nx && snake[i].y === ny) return;
          var d = Math.abs(nx - food.x) + Math.abs(ny - food.y) + Math.random() * 0.5;
          if (d < bd) { bd = d; best = o; }
        });
        if (!best) { reset(); return; }
        dir = best;
        prev = snake.map(function (s) { return { x: s.x, y: s.y }; });
        snake.unshift({ x: hd.x + dir.x, y: hd.y + dir.y });
        if (snake[0].x === food.x && snake[0].y === food.y) { placeFood(); if (snake.length > 28) snake.length = 10; } else snake.pop();
        acc = 0;
      }
    }
    if (!alive) deathT += dt;
    if (!S.playing && !alive && deathT > 2.5) reset();
    parts.update(dt);
    shake.update(dt);
    draw();
  });
})();
