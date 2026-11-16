/* Redline Highway — procedural car models (no external assets).
 * Each body is "lofted": a rounded cross-section is swept from tail to nose while
 * its width, shoulder line, roof line and roof width follow smooth curves. That
 * gives tapered noses, curved roofs, tumblehome and real wheel-arch cut-outs. */
(function () {
  "use strict";
  var RL = (window.RL = window.RL || {});

  // smooth curve through keyframes [[x, value], ...]
  function curve(keys) {
    return function (x) {
      if (x <= keys[0][0]) return keys[0][1];
      for (var i = 1; i < keys.length; i++) {
        if (x <= keys[i][0]) {
          var a = keys[i - 1], b = keys[i], t = (x - a[0]) / (b[0] - a[0]);
          t = t * t * (3 - 2 * t);
          return a[1] + (b[1] - a[1]) * t;
        }
      }
      return keys[keys.length - 1][1];
    };
  }

  // x runs rear (-) to front (+), in metres. hw = half width, belt = shoulder line,
  // top = roof/hood/boot line, wt = half width of the top surface, yb = underside.
  var SPECS = {
    sports: {
      L: 4.5, W: 1.96, H: 1.18, wheelR: 0.34, wheelW: 0.29, wb: 2.66, mass: 1400,
      hw: [[-2.25, 0.74], [-2.05, 0.92], [-1.35, 0.98], [0, 0.955], [1.3, 0.97], [1.95, 0.9], [2.25, 0.66]],
      belt: [[-2.25, 0.74], [-1.9, 0.86], [-0.8, 0.85], [0.6, 0.77], [1.6, 0.67], [2.25, 0.5]],
      top: [[-2.25, 0.76], [-2.0, 0.9], [-1.5, 0.96], [-0.9, 1.12], [-0.35, 1.17], [0.1, 1.15], [0.95, 0.81], [1.6, 0.7], [2.25, 0.52]],
      wt: [[-2.25, 0.56], [-1.5, 0.66], [-0.4, 0.6], [0.2, 0.62], [0.95, 0.78], [1.8, 0.72], [2.25, 0.5]],
      yb: [[-2.25, 0.36], [-2.0, 0.17], [1.9, 0.15], [2.25, 0.27]],
      ws: [0.1, 0.95], rw: [-1.5, -0.9], side: [-1.5, 0.95]
    },
    sedan: {
      L: 4.7, W: 1.84, H: 1.46, wheelR: 0.33, wb: 2.8, mass: 1500,
      hw: [[-2.35, 0.74], [-2.15, 0.88], [-1.2, 0.92], [1.2, 0.92], [2.1, 0.87], [2.35, 0.68]],
      belt: [[-2.35, 0.8], [-1.9, 0.93], [1.0, 0.9], [1.9, 0.79], [2.35, 0.6]],
      top: [[-2.35, 0.82], [-1.8, 0.97], [-1.15, 1.36], [-0.6, 1.44], [0.2, 1.43], [1.05, 0.94], [1.9, 0.81], [2.35, 0.62]],
      wt: [[-2.35, 0.6], [-1.8, 0.72], [-1.1, 0.6], [0.2, 0.62], [1.05, 0.74], [2.35, 0.58]],
      yb: [[-2.35, 0.42], [-2.1, 0.22], [2.05, 0.2], [2.35, 0.34]],
      ws: [0.2, 1.05], rw: [-1.8, -1.15], side: [-1.8, 1.05]
    },
    hatch: {
      L: 4.1, W: 1.78, H: 1.5, wheelR: 0.31, wb: 2.55, mass: 1200,
      hw: [[-2.05, 0.74], [-1.9, 0.86], [-1, 0.89], [1, 0.89], [1.8, 0.84], [2.05, 0.66]],
      belt: [[-2.05, 0.9], [-1.8, 0.97], [0.9, 0.93], [1.7, 0.8], [2.05, 0.62]],
      top: [[-2.05, 0.95], [-1.9, 1.3], [-1.4, 1.47], [0.15, 1.47], [0.95, 0.96], [1.7, 0.82], [2.05, 0.64]],
      wt: [[-2.05, 0.62], [-1.4, 0.62], [0.15, 0.62], [0.95, 0.72], [2.05, 0.58]],
      yb: [[-2.05, 0.4], [-1.85, 0.22], [1.8, 0.2], [2.05, 0.34]],
      ws: [0.15, 0.95], rw: [-2.0, -1.5], side: [-1.9, 0.95]
    },
    suv: {
      L: 4.8, W: 1.96, H: 1.8, wheelR: 0.38, wheelW: 0.28, wb: 2.85, mass: 2100,
      hw: [[-2.4, 0.82], [-2.2, 0.95], [1.3, 0.98], [2.15, 0.92], [2.4, 0.74]],
      belt: [[-2.4, 1.05], [-2.1, 1.12], [1.1, 1.08], [2.0, 1.0], [2.4, 0.78]],
      top: [[-2.4, 1.1], [-2.25, 1.6], [-1.8, 1.76], [0.3, 1.76], [1.15, 1.12], [2.0, 1.02], [2.4, 0.8]],
      wt: [[-2.4, 0.7], [-1.8, 0.72], [0.3, 0.72], [1.15, 0.82], [2.4, 0.66]],
      yb: [[-2.4, 0.5], [-2.2, 0.3], [2.15, 0.28], [2.4, 0.44]],
      ws: [0.3, 1.15], rw: [-2.38, -1.9], side: [-2.25, 1.15]
    },
    van: {
      L: 5.4, W: 2.0, H: 2.16, wheelR: 0.36, wb: 3.3, mass: 2600,
      hw: [[-2.7, 0.9], [-2.5, 1.0], [1.9, 1.0], [2.5, 0.94], [2.7, 0.8]],
      belt: [[-2.7, 1.2], [1.5, 1.2], [2.3, 1.1], [2.7, 0.85]],
      top: [[-2.7, 1.95], [-2.5, 2.12], [1.3, 2.12], [2.25, 1.22], [2.6, 1.1], [2.7, 0.9]],
      wt: [[-2.7, 0.86], [1.3, 0.86], [2.25, 0.86], [2.7, 0.7]],
      yb: [[-2.7, 0.4], [-2.5, 0.28], [2.5, 0.26], [2.7, 0.42]],
      ws: [1.3, 2.25], rw: [9, 9], side: [1.0, 2.25]
    },
    truck: {
      L: 8.4, W: 2.5, H: 3.5, wheelR: 0.5, wheelW: 0.34, mass: 9000, x0: 1.9, x1: 4.2, noArch: true,
      hw: [[1.9, 1.1], [2.1, 1.22], [3.9, 1.22], [4.2, 1.05]],
      belt: [[1.9, 1.7], [3.6, 1.7], [4.2, 1.3]],
      top: [[1.9, 2.75], [2.1, 2.9], [3.5, 2.9], [4.1, 1.8], [4.2, 1.4]],
      wt: [[1.9, 1.05], [3.5, 1.05], [4.2, 0.9]],
      yb: [[1.9, 0.6], [4.0, 0.6], [4.2, 0.75]],
      ws: [3.5, 4.1], rw: [9, 9], side: [3.0, 4.1],
      axles: [-2.9, 1.7, 2.9], cargo: { z0: -1.95, z1: 4.2, y0: 1.0, y1: 3.5 }
    }
  };
  for (var k in SPECS) ["hw", "belt", "top", "wt", "yb"].forEach(function (f) { SPECS[k][f] = curve(SPECS[k][f]); });
  RL.SPECS = SPECS;

  var HALF = 10, RING = 18; // points per half section / per full ring

  function section(sp, x, axles, R) {
    var w = sp.hw(x), yb = sp.yb(x), belt = sp.belt(x), top = Math.max(sp.top(x), belt + 0.02), wt = Math.min(sp.wt(x), w * 0.95);
    var cab = top - belt, crown = 0.04;
    var p = [
      [0, yb], [w - 0.28, yb], [w * 0.965, yb + 0.07], [w, yb + (belt - yb) * 0.5], [w * 0.985, belt - 0.07], [w * 0.93, belt],
      [(w * 0.93 + wt) / 2 + (cab > 0.2 ? 0.035 : 0), belt + cab * 0.55], [wt, top - 0.02], [wt * 0.52, top + crown * 0.8], [0, top + crown]
    ];
    for (var i = 0; i < axles.length; i++) {
      var dx = x - axles[i];
      if (Math.abs(dx) < R) {
        var ay = sp.wheelR + Math.sqrt(R * R - dx * dx);
        p[1][1] = Math.max(p[1][1], ay);
        p[2] = [w * 0.99, Math.max(p[2][1], ay)];
        p[3][1] = Math.max(p[3][1], ay + 0.025);
        p[4][1] = Math.max(p[4][1], p[3][1] + 0.02);
      }
    }
    return p;
  }

  function loft(sp) {
    var x0 = sp.x0 != null ? sp.x0 : -sp.L / 2, x1 = sp.x1 != null ? sp.x1 : sp.L / 2;
    var axles = sp.noArch ? [] : [-sp.wb / 2, sp.wb / 2], R = sp.wheelR + 0.075;
    var xs = [], i, j;
    for (var x = x0; x < x1 - 0.02; x += 0.13) xs.push(x);
    xs.push(x1);
    axles.forEach(function (a) { [-1, -0.82, -0.5, 0, 0.5, 0.82, 1].forEach(function (f) { xs.push(a + f * R); }); });
    xs.sort(function (a, b) { return a - b; });
    xs = xs.filter(function (v, n) { return n === 0 || v - xs[n - 1] > 0.015; });

    var pos = [], N = xs.length, lines = [];
    for (i = 0; i < N; i++) {
      var s = section(sp, xs[i], axles, R);
      for (j = 0; j < HALF; j++) pos.push(s[j][0], s[j][1], -xs[i]);
      for (j = HALF - 2; j >= 1; j--) pos.push(-s[j][0], s[j][1], -xs[i]);
    }
    var paint = [], glass = [];
    function inZone(z, x) { return x >= z[0] && x <= z[1]; }
    for (i = 0; i < N - 1; i++) {
      var xm = (xs[i] + xs[i + 1]) / 2, cab = sp.top(xm) - sp.belt(xm);
      for (var r = 0; r < RING; r++) {
        var r2 = (r + 1) % RING, a = i * RING + r, b = i * RING + r2, c = (i + 1) * RING + r2, d = (i + 1) * RING + r;
        var band = r < HALF - 1 ? r : RING - 1 - r;
        var g = cab > 0.12 && band >= 5 && ((band <= 6 && inZone(sp.side, xm)) || inZone(sp.ws, xm) || inZone(sp.rw, xm));
        (g ? glass : paint).push(a, b, c, a, c, d);
      }
    }
    // flat end caps (separate vertices so the bumper faces stay crisp)
    [0, N - 1].forEach(function (st, e) {
      var base = pos.length / 3, cy = 0;
      for (j = 0; j < RING; j++) { pos.push(pos[(st * RING + j) * 3], pos[(st * RING + j) * 3 + 1], pos[(st * RING + j) * 3 + 2]); cy += pos[(st * RING + j) * 3 + 1]; }
      pos.push(0, cy / RING, -xs[st]);
      for (j = 0; j < RING; j++) {
        var n2 = (j + 1) % RING;
        if (e === 0) paint.push(base + RING, base + n2, base + j); else paint.push(base + RING, base + j, base + n2);
      }
    });

    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(paint.concat(glass));
    geo.addGroup(0, paint.length, 0);
    geo.addGroup(paint.length, glass.length, 1);
    geo.computeVertexNormals();
    // make sure faces point outward (check a side vertex on the right-hand side)
    var mid = ((N / 2) | 0) * RING + 3;
    if (geo.attributes.normal.getX(mid) < 0) {
      var idx = geo.index.array;
      for (i = 0; i < idx.length; i += 3) { var tmp = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = tmp; }
      geo.index.needsUpdate = true;
      geo.computeVertexNormals();
    }

    // neon outline: character lines along the body + nose and tail loops
    function P(st, r) { var o = (st * RING + r) * 3; lines.push(pos[o], pos[o + 1], pos[o + 2]); }
    [3, 5, 7, 9, RING - 3, RING - 5, RING - 7].forEach(function (r) { for (i = 0; i < N - 1; i++) { P(i, r); P(i + 1, r); } });
    [0, N - 1].forEach(function (st) { for (j = 2; j < RING - 2; j++) { P(st, j); P(st, j + 1); } });
    var lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    return { body: geo, lines: lg };
  }

  var cache = {};
  RL.disposeCarCache = function () {
    for (var t in cache) for (var g in cache[t]) cache[t][g].dispose();
    cache = {};
  };
  function geos(type) {
    if (cache[type]) return cache[type];
    var sp = SPECS[type], c = loft(sp);
    c.wheel = new THREE.CylinderGeometry(sp.wheelR, sp.wheelR, sp.wheelW || 0.25, 24);
    c.wheel.rotateZ(Math.PI / 2);
    c.lamp = new THREE.SphereGeometry(1, 12, 8);
    return (cache[type] = c);
  }

  /**
   * T (theme): { paint(color,isPlayer), cargo(color), glass, tire, cap, dark, chrome, head, tail, amber, neon, edge(color), shadows }
   * returns { group, chassis, wheels[], blinkL, blinkR, tails[], spec }
   */
  RL.makeCar = function (type, color, T, isPlayer) {
    var sp = SPECS[type], G = geos(type);
    var root = new THREE.Group(), chassis = new THREE.Group();
    root.add(chassis);
    var paint = T.paint(color, isPlayer);
    function add(geo, mat, x, y, z, noShadow) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      if (T.shadows && !noShadow) m.castShadow = true;
      chassis.add(m);
      return m;
    }
    function box(w, h, l, mat, x, y, z, edges, noShadow) {
      var g = new THREE.BoxGeometry(w, h, l), m = add(g, mat, x, y, z, noShadow);
      if (edges && T.neon) { var e = new THREE.LineSegments(new THREE.EdgesGeometry(g), T.edge(color)); e.position.copy(m.position); chassis.add(e); }
      return m;
    }
    function lamp(mat, x, y, z, sx, sy, sz) {
      var m = add(G.lamp, mat, x, y, z, true);
      m.scale.set(sx, sy, sz);
      return m;
    }

    add(G.body, [paint, T.glass]);
    if (T.neon) chassis.add(new THREE.LineSegments(G.lines, T.edge(color)));

    var xf = sp.x1 != null ? sp.x1 : sp.L / 2, xr = -sp.L / 2;
    if (sp.cargo) {
      var cg = sp.cargo;
      box(sp.W, cg.y1 - cg.y0, cg.z1 - cg.z0, T.cargo(color), 0, (cg.y0 + cg.y1) / 2, (cg.z0 + cg.z1) / 2, true);
      box(sp.W - 0.5, 0.36, sp.L - 0.5, T.dark, 0, 0.76, 0.1);
      box(sp.W - 0.1, 0.3, 0.16, T.dark, 0, 0.72, sp.L / 2 - 0.05);
    }

    // lights, grille, plate, mirrors
    var fx = xf - 0.2, fw = sp.hw(fx), fy = sp.belt(fx) - 0.09, tails = [];
    var rx = sp.cargo ? xr + 0.02 : xr + 0.16, rw2 = sp.cargo ? sp.W / 2 : sp.hw(rx), ry = sp.cargo ? 0.95 : sp.belt(rx) - 0.1;
    [-1, 1].forEach(function (sd) {
      lamp(T.head, sd * (fw - 0.25), fy, -fx - 0.06, 0.2, 0.065, 0.16);
      if (!isPlayer) tails.push(lamp(T.tail, sd * (rw2 - 0.22), ry, -rx + 0.07, 0.2, 0.07, 0.14));
      var mx = sp.ws[1] - 0.12;
      box(0.15, 0.075, 0.07, paint, sd * (sp.hw(mx) * 0.93 + 0.05), sp.belt(mx) + 0.06, -mx, false, true);
    });
    box(fw * 1.25, 0.16, 0.08, T.dark, 0, sp.yb(fx) + 0.2, -xf + 0.03, false, true);
    if (!isPlayer) box(0.5, 0.12, 0.03, T.plate || T.head, 0, ry - 0.2, -xr + 0.015, false, true);
    var blinkL = lamp(T.amber, -(rw2 - 0.07), ry, -rx + 0.05, 0.08, 0.07, 0.12);
    var blinkR = lamp(T.amber, rw2 - 0.07, ry, -rx + 0.05, 0.08, 0.07, 0.12);
    blinkL.visible = blinkR.visible = false;

    // wheels
    var wheels = [], axles = sp.axles || [-sp.wb / 2, sp.wb / 2], ww = sp.wheelW || 0.25;
    var wm = [T.tire, T.cap, T.cap];
    axles.forEach(function (az) {
      var wx = (sp.cargo ? sp.W / 2 : sp.hw(-az)) - ww / 2 - 0.015;
      [-1, 1].forEach(function (sd) {
        var pivot = new THREE.Group();
        pivot.position.set(sd * wx, sp.wheelR, az);
        var w = new THREE.Mesh(G.wheel, wm);
        if (T.shadows) w.castShadow = true;
        pivot.add(w);
        root.add(pivot);
        wheels.push({ pivot: pivot, mesh: w, front: az < 0 });
      });
    });

    if (isPlayer) {
      // the player's hypercar: rear wing, splitter, diffuser, light bar, exhausts
      var W = sp.W, L = sp.L;
      box(W - 0.16, 0.04, 0.34, paint, 0, 1.2, L / 2 - 0.26, true);
      [-1, 1].forEach(function (sd) {
        box(0.045, 0.3, 0.16, T.dark, sd * 0.5, 1.04, L / 2 - 0.3);
        box(0.035, 0.17, 0.42, T.dark, sd * (W / 2 - 0.09), 1.16, L / 2 - 0.26);
        box(0.07, 0.07, 1.7, T.dark, sd * (W / 2 - 0.06), 0.19, 0, false, true);
        var ex = add(new THREE.CylinderGeometry(0.065, 0.065, 0.16, 14), T.chrome, sd * 0.24, 0.42, L / 2 - 0.02, true);
        ex.rotation.x = Math.PI / 2;
      });
      box(W - 0.3, 0.035, 0.4, T.dark, 0, 0.14, -L / 2 + 0.12, false, true);
      box(1.2, 0.2, 0.1, T.dark, 0, 0.44, L / 2 - 0.03, false, true);
      tails.push(box(1.5, 0.05, 0.06, T.tail, 0, 0.66, L / 2 - 0.005, false, true));
      box(0.34, 0.012, 0.9, T.dark, -0.3, sp.top(1.45) + 0.045, -1.45, false, true).rotation.x = -0.1;
      box(0.34, 0.012, 0.9, T.dark, 0.3, sp.top(1.45) + 0.045, -1.45, false, true).rotation.x = -0.1;
    }

    return { group: root, chassis: chassis, wheels: wheels, blinkL: blinkL, blinkR: blinkR, tails: tails, spec: sp };
  };
})();
