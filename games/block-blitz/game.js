/* Block Blitz — drag-and-drop block puzzle on an 8x8 grid with combo clears */
(function () {
  "use strict";
  var A = Arcade, sfx = A.sfx;

  var S = A.shell({
    id: "block-blitz",
    title: "Block Blitz",
    pausable: false,
    howto: "Drag pieces onto the board. Fill a full <b>row</b> or <b>column</b> to blast it.<br>Clear several lines at once, or on back-to-back turns, for huge <span style='color:#ffd23f'>combo</span> points. Game ends when nothing fits.",
    onStart: reset
  });

  var canvas = document.getElementById("c");
  var view = A.fitCanvas(canvas, layout);
  var ctx = view.ctx;
  var parts = new A.Particles(900);
  var shake = new A.Shake();

  var N = 8;
  var SHAPES = [
    [[0, 0]],
    [[0, 0], [1, 0]], [[0, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [2, 0], [0, 1]], [[0, 0], [1, 0], [1, 1], [1, 2]], [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]], [[1, 0], [0, 1], [1, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]
  ];
  var COLORS = ["#ff2a8a", "#00e5ff", "#ffd23f", "#7cff6b", "#b14bff", "#ff7a2f", "#4d7cff"];

  var board, tray, combo, cellSz, BX, BY, trayY, slotW, drag, flashes, placedAnim, over;

  function layout() {
    var W = view.w, H = view.h;
    var size = Math.min(W - 24, (H - 90) * 0.66, 520);
    cellSz = Math.floor(size / N);
    BX = Math.floor((W - cellSz * N) / 2);
    BY = Math.max(70, Math.floor((H - cellSz * N - cellSz * 3.6) / 2) + 20);
    trayY = BY + cellSz * N + cellSz * 0.6;
    slotW = Math.min(W - 16, cellSz * N + 60) / 3;
  }

  function newPiece() {
    // bias towards smaller pieces when the board is crowded, so runs last longer
    var filled = 0;
    if (board) for (var i = 0; i < N * N; i++) if (board[i]) filled++;
    var shape;
    for (var tries = 0; tries < 4; tries++) {
      shape = SHAPES[(Math.random() * SHAPES.length) | 0];
      if (shape.length <= 4 || Math.random() > filled / (N * N) * 1.2) break;
    }
    var w = 0, h = 0;
    shape.forEach(function (c) { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); });
    return { cells: shape, w: w, h: h, color: COLORS[(Math.random() * COLORS.length) | 0], used: false, pop: 0 };
  }

  function refill() {
    tray = [newPiece(), newPiece(), newPiece()];
    tray.forEach(function (p, i) { p.pop = -i * 0.08; });
  }

  function reset() {
    layout();
    board = new Array(N * N).fill(null);
    combo = 0; flashes = []; placedAnim = []; over = false; drag = null;
    parts.clear();
    refill();
  }

  function fits(piece, gx, gy) {
    for (var i = 0; i < piece.cells.length; i++) {
      var x = gx + piece.cells[i][0], y = gy + piece.cells[i][1];
      if (x < 0 || y < 0 || x >= N || y >= N || board[y * N + x]) return false;
    }
    return true;
  }
  function canPlaceAnywhere(piece) {
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (fits(piece, x, y)) return true;
    return false;
  }

  function slotCenter(i) {
    var total = slotW * 3;
    return { x: (view.w - total) / 2 + slotW * (i + 0.5), y: trayY + cellSz * 1.5 };
  }
  var TRAY_SCALE = 0.55;

  function pieceAt(x, y) {
    for (var i = 0; i < 3; i++) {
      var p = tray[i];
      if (!p || p.used) continue;
      var c = slotCenter(i);
      if (Math.abs(x - c.x) < slotW / 2 && Math.abs(y - c.y) < cellSz * 1.6) return i;
    }
    return -1;
  }

  function dropTarget() {
    if (!drag) return null;
    var p = tray[drag.i];
    var left = drag.x - (p.w * cellSz) / 2, top = drag.y - drag.lift - (p.h * cellSz) / 2;
    var gx = Math.round((left - BX) / cellSz), gy = Math.round((top - BY) / cellSz);
    return fits(p, gx, gy) ? { x: gx, y: gy } : null;
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (!S.playing || over) return;
    var i = pieceAt(e.clientX, e.clientY);
    if (i < 0) return;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    drag = { i: i, x: e.clientX, y: e.clientY, lift: e.pointerType === "touch" ? cellSz * 1.8 : cellSz * 0.4, id: e.pointerId };
    sfx.click();
  });
  canvas.addEventListener("pointermove", function (e) {
    if (drag && e.pointerId === drag.id) { drag.x = e.clientX; drag.y = e.clientY; }
  });
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var tgt = dropTarget();
    if (tgt) place(drag.i, tgt.x, tgt.y);
    else sfx.tone(180, 0.06, "square", 0.05);
    drag = null;
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", function () { drag = null; });

  function place(i, gx, gy) {
    var p = tray[i];
    p.cells.forEach(function (c) {
      var idx = (gy + c[1]) * N + gx + c[0];
      board[idx] = p.color;
      placedAnim.push({ idx: idx, t: 0 });
    });
    p.used = true;
    var pts = p.cells.length;
    sfx.tone(320 + Math.random() * 60, 0.06, "triangle", 0.15);

    // find full lines
    var rows = [], colsF = [];
    for (var y = 0; y < N; y++) { var full = true; for (var x = 0; x < N; x++) if (!board[y * N + x]) { full = false; break; } if (full) rows.push(y); }
    for (var x2 = 0; x2 < N; x2++) { var fullc = true; for (var y2 = 0; y2 < N; y2++) if (!board[y2 * N + x2]) { fullc = false; break; } if (fullc) colsF.push(x2); }
    var lines = rows.length + colsF.length;
    if (lines) {
      combo++;
      var clearSet = {};
      rows.forEach(function (r) { for (var x = 0; x < N; x++) clearSet[r * N + x] = 1; });
      colsF.forEach(function (c) { for (var y = 0; y < N; y++) clearSet[y * N + c] = 1; });
      var k = 0;
      for (var key in clearSet) {
        var id = +key, cx = BX + (id % N + 0.5) * cellSz, cy = BY + (((id / N) | 0) + 0.5) * cellSz;
        flashes.push({ x: cx, y: cy, color: board[id], t: 0, delay: k * 0.012 });
        parts.emit(cx, cy, { n: 6, color: [board[id], "#fff"], speed: 260, life: 0.7, size: 5, gravity: 500 });
        board[id] = null;
        k++;
      }
      var gain = lines * 10 * lines + (combo > 1 ? combo * 10 : 0);
      pts += gain;
      shake.add(3 + lines * 3, 0.25);
      for (var n = 0; n < Math.min(lines, 4); n++) sfx.tone(523 * Math.pow(1.26, n + Math.min(combo, 6) * 0.5), 0.15, "square", 0.1, 0, n * 0.06);
      sfx.noise(0.25, 0.2, 3000);
      var label = lines >= 3 ? "MEGA BLAST!" : lines === 2 ? "DOUBLE!" : "CLEAR!";
      A.popup(label + " +" + gain, view.w / 2, BY + cellSz * N / 2, lines >= 2 ? "#ffd23f" : "#7cffcb", 22 + lines * 4);
      if (combo > 1) setTimeout(function () { A.popup("COMBO x" + combo, view.w / 2, BY + cellSz * N / 2 + 40, "#ff7ad9", 22); }, 200);
      if (board.every(function (b) { return !b; })) {
        pts += 300;
        setTimeout(function () { A.popup("BOARD CLEAR +300", view.w / 2, BY + cellSz * 2, "#00f0ff", 28); sfx.levelup(); }, 350);
      }
    } else combo = 0;

    S.addScore(pts);
    S.setBestLive();

    if (tray.every(function (q) { return q.used; })) refill();
    var any = tray.some(function (q) { return !q.used && canPlaceAnywhere(q); });
    if (!any) {
      over = true;
      setTimeout(function () {
        sfx.over();
        // grey out the board for drama
        for (var i2 = 0; i2 < N * N; i2++) if (board[i2]) board[i2] = "#3a2f55";
        S.gameOver();
      }, 600);
    }
  }

  function bevel(x, y, s, color, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    var r = s * 0.16, pad = s * 0.05;
    x += pad; y += pad; s -= pad * 2;
    var g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, color);
    g.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = g;
    roundRect(x, y, s, s, r); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(x + s * 0.12, y + s * 0.08, s * 0.76, s * 0.22, r * 0.6); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1;
    roundRect(x + 0.5, y + 0.5, s - 1, s - 1, r); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  var shadeCache = {};
  function shade(hex, amt) {
    var k = hex + amt;
    if (shadeCache[k]) return shadeCache[k];
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.round(Math.max(0, Math.min(255, amt < 0 ? c * (1 + amt) : c + (255 - c) * amt))); };
    return (shadeCache[k] = "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")");
  }

  var t = 0;
  function draw(dt) {
    var W = view.w, H = view.h;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a0838"); bg.addColorStop(1, "#070214");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.translate(shake.x, shake.y);

    // board frame
    var BW = cellSz * N;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(BX - 10, BY - 10, BW + 20, BW + 20, 16); ctx.fill();
    ctx.strokeStyle = "rgba(177,75,255,0.5)"; ctx.lineWidth = 2;
    ctx.shadowColor = "#b14bff"; ctx.shadowBlur = 24;
    roundRect(BX - 10, BY - 10, BW + 20, BW + 20, 16); ctx.stroke();
    ctx.shadowBlur = 0;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      ctx.fillStyle = (x + y) % 2 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.07)";
      roundRect(BX + x * cellSz + 2, BY + y * cellSz + 2, cellSz - 4, cellSz - 4, cellSz * 0.14); ctx.fill();
    }

    if (!board) return;

    // ghost + line highlight
    var tgt = dropTarget();
    var hiRows = {}, hiCols = {};
    if (tgt) {
      var p = tray[drag.i];
      var tmp = board.slice();
      p.cells.forEach(function (c) { tmp[(tgt.y + c[1]) * N + tgt.x + c[0]] = 1; });
      for (var r = 0; r < N; r++) { var f = true; for (var c2 = 0; c2 < N; c2++) if (!tmp[r * N + c2]) f = false; if (f) hiRows[r] = 1; }
      for (var c3 = 0; c3 < N; c3++) { var f2 = true; for (var r2 = 0; r2 < N; r2++) if (!tmp[r2 * N + c3]) f2 = false; if (f2) hiCols[c3] = 1; }
    }

    // placed blocks
    for (var i = 0; i < N * N; i++) {
      if (!board[i]) continue;
      var bxp = BX + (i % N) * cellSz, byp = BY + ((i / N) | 0) * cellSz;
      var color = board[i];
      if (tgt && (hiRows[(i / N) | 0] || hiCols[i % N])) color = tray[drag.i].color;
      bevel(bxp, byp, cellSz, color);
    }
    // placement pop
    for (var a = placedAnim.length - 1; a >= 0; a--) {
      var pa = placedAnim[a];
      pa.t += dt;
      if (pa.t > 0.25 || !board[pa.idx]) { placedAnim.splice(a, 1); continue; }
      var k = 1 - pa.t / 0.25;
      ctx.fillStyle = "rgba(255,255,255," + k * 0.6 + ")";
      roundRect(BX + (pa.idx % N) * cellSz + 2, BY + ((pa.idx / N) | 0) * cellSz + 2, cellSz - 4, cellSz - 4, cellSz * 0.14); ctx.fill();
    }
    if (tgt) {
      var pp = tray[drag.i];
      pp.cells.forEach(function (c) { bevel(BX + (tgt.x + c[0]) * cellSz, BY + (tgt.y + c[1]) * cellSz, cellSz, pp.color, 0.4); });
    }

    // clear flashes
    for (var fI = flashes.length - 1; fI >= 0; fI--) {
      var fl = flashes[fI];
      fl.t += dt;
      var ft = fl.t - fl.delay;
      if (ft > 0.35) { flashes.splice(fI, 1); continue; }
      if (ft < 0) { bevel(fl.x - cellSz / 2, fl.y - cellSz / 2, cellSz, fl.color); continue; }
      var sc = 1 + ft * 2, al = 1 - ft / 0.35;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = al;
      ctx.drawImage(A.glow(fl.color), fl.x - cellSz * sc, fl.y - cellSz * sc, cellSz * 2 * sc, cellSz * 2 * sc);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(255,255,255," + al + ")";
      var s2 = cellSz * (1 - ft / 0.35) * 0.9;
      roundRect(fl.x - s2 / 2, fl.y - s2 / 2, s2, s2, 4); ctx.fill();
    }

    // tray
    for (var ti = 0; ti < 3; ti++) {
      var piece = tray[ti];
      if (!piece || piece.used || (drag && drag.i === ti)) continue;
      piece.pop = Math.min(1, piece.pop + dt * 4);
      if (piece.pop <= 0) continue;
      var e = piece.pop < 1 ? 1 + Math.sin(piece.pop * Math.PI) * 0.25 : 1;
      var sc2 = TRAY_SCALE * Math.max(0.01, piece.pop) * e;
      var cc = slotCenter(ti);
      var cs = cellSz * sc2;
      var ok = canPlaceAnywhere(piece);
      piece.cells.forEach(function (c) {
        bevel(cc.x - piece.w * cs / 2 + c[0] * cs, cc.y - piece.h * cs / 2 + c[1] * cs, cs, ok ? piece.color : "#4a4060", ok ? 1 : 0.6);
      });
    }

    // dragged piece
    if (drag) {
      var dp = tray[drag.i];
      var left = drag.x - dp.w * cellSz / 2, top = drag.y - drag.lift - dp.h * cellSz / 2;
      ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
      dp.cells.forEach(function (c) { bevel(left + c[0] * cellSz, top + c[1] * cellSz, cellSz, dp.color); });
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }

    parts.draw(ctx);
  }

  reset();
  // pre-fill a decorative board for the title screen
  for (var q = 0; q < 26; q++) board[(Math.random() * N * N) | 0] = COLORS[(Math.random() * COLORS.length) | 0];

  A.loop(function (dt) {
    t += dt;
    parts.update(dt);
    shake.update(dt);
    draw(dt);
  });
})();
