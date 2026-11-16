/* Redline Highway — endless highway traffic racer with two looks (realistic / neon),
 * one-way or two-way traffic, nitro, close calls and rigid-body crash physics. */
(function () {
  "use strict";
  var A = Arcade, sfx = A.sfx, store = A.store, RL = window.RL;
  var V3 = THREE.Vector3;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var mode = store.get("redline:mode", "real"), trafficMode = store.get("redline:traffic", "one"), peopleOn = store.get("redline:people", true);

  var S = A.shell({
    id: "redline-highway",
    title: "Redline Highway",
    howto: "<kbd>&larr;</kbd><kbd>&rarr;</kbd> steer &middot; <kbd>&uarr;</kbd> gas &middot; <kbd>&darr;</kbd> brake &middot; <kbd>Shift</kbd> nitro &middot; <kbd>C</kbd> camera<br>Skim past traffic for <b>close calls</b> &mdash; they refill nitro. On touch, hold a side to steer.",
    onStart: start,
    onPause: function () { setEngine(0, 0, 0); }
  });

  /* ------------------------------------------------------- menu options */
  (function () {
    var panel = document.querySelector(".ub-panel"), opt = document.createElement("div");
    opt.className = "rl-opts";
    opt.innerHTML =
      '<div class="rl-row"><span>STYLE</span><div class="seg" data-k="mode"><button type="button" data-v="real">Realistic</button><button type="button" data-v="neon">Neon</button></div></div>' +
      '<div class="rl-row"><span>TRAFFIC</span><div class="seg" data-k="traffic"><button type="button" data-v="one">One-way</button><button type="button" data-v="two">Two-way</button></div></div>' +
      '<div class="rl-row"><span>PEOPLE</span><div class="seg" data-k="people"><button type="button" data-v="on">Walkers &amp; bikers</button><button type="button" data-v="off">Off</button></div></div>';
    panel.insertBefore(opt, panel.querySelector(".ub-play"));
    function paint() {
      opt.querySelectorAll("button").forEach(function (b) {
        var k = b.parentNode.dataset.k;
        b.classList.toggle("on", b.dataset.v === (k === "mode" ? mode : k === "traffic" ? trafficMode : peopleOn ? "on" : "off"));
      });
    }
    opt.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.parentNode.dataset.k;
        if (k === "mode") { mode = b.dataset.v; store.set("redline:mode", mode); }
        else if (k === "traffic") { trafficMode = b.dataset.v; store.set("redline:traffic", trafficMode); }
        else { peopleOn = b.dataset.v === "on"; store.set("redline:people", peopleOn); }
        b.blur(); paint(); sfx.click();
        if (!S.playing && k !== "people") { build(); toAttract(); }
      });
    });
    paint();
  })();

  /* ------------------------------------------------------------ renderer */
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.insertBefore(renderer.domElement, document.body.firstChild);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 2400);
  window.addEventListener("resize", function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  var hudEl = document.getElementById("hud"), spdEl = document.querySelector("#spd b"), nosEl = document.querySelector(".nos i"),
    dmgEl = document.querySelector(".dmg i"), tagEl = document.getElementById("tag"), touchEl = document.getElementById("touch");

  /* --------------------------------------------------------------- state */
  var world = null, T = null, lanes = [], built = "";
  var P = null;                 // player
  var traffic = [], pool = {};  // active traffic + free lists by type
  var bodies = [];              // rigid bodies (wrecks)
  var chunks = [];              // debris + loose wheels
  var state = "attract", frameV = 0, crashT = 0, dist = 0, score = 0, combo = 0, comboT = 0, closeCalls = 0, topSpeed = 0, t = 0;
  var camMode = 0, camX = 0, shake = 0, tagText = "";

  var SPAWN_Z = -600, TYPES = ["sedan", "sedan", "sedan", "hatch", "hatch", "suv", "suv", "van", "truck", "sports"];

  /* ------------------------------------------------------------- effects */
  var SPN = 500, spPos, spVel, spLife, spCol, spGeo, spPts, spNext = 0, tmpC = new THREE.Color();
  var smokes = [], smokeTex = null, flames = [];
  function softTex() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function buildFx() {
    spPos = new Float32Array(SPN * 3); spVel = new Float32Array(SPN * 3); spCol = new Float32Array(SPN * 3); spLife = new Float32Array(SPN);
    for (var i = 0; i < SPN; i++) spPos[i * 3 + 1] = -50;
    spGeo = new THREE.BufferGeometry();
    spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
    spGeo.setAttribute("color", new THREE.BufferAttribute(spCol, 3));
    smokeTex = softTex();
    spPts = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: world.neon ? 0.3 : 0.16, map: smokeTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    spPts.frustumCulled = false;
    scene.add(spPts);
    smokes = [];
    for (i = 0; i < 44; i++) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: world.smokeColor, transparent: true, opacity: 0, depthWrite: false, blending: world.neon ? THREE.AdditiveBlending : THREE.NormalBlending }));
      s.visible = false; scene.add(s);
      smokes.push({ s: s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 });
    }
  }
  function sparks(x, y, z, n, vx, vy, vz, spread) {
    for (var i = 0; i < n; i++) {
      var k = spNext; spNext = (spNext + 1) % SPN;
      spPos[k * 3] = x; spPos[k * 3 + 1] = y; spPos[k * 3 + 2] = z;
      spVel[k * 3] = vx + rnd(-1, 1) * spread; spVel[k * 3 + 1] = vy + Math.random() * spread * 0.8; spVel[k * 3 + 2] = vz + rnd(-1, 1) * spread;
      tmpC.set(world.sparkColors[(Math.random() * world.sparkColors.length) | 0]);
      spCol[k * 3] = tmpC.r * 3; spCol[k * 3 + 1] = tmpC.g * 3; spCol[k * 3 + 2] = tmpC.b * 3;
      spLife[k] = rnd(0.25, 0.9);
    }
  }
  function smoke(x, y, z, size, life, vz) {
    for (var i = 0; i < smokes.length; i++) {
      var m = smokes[i];
      if (m.life > 0) continue;
      m.life = m.max = life; m.size = size; m.vx = rnd(-0.5, 0.5); m.vy = rnd(1, 2.4); m.vz = vz || 0;
      m.s.position.set(x, y, z); m.s.visible = true;
      return;
    }
  }
  function updateFx(dt) {
    var i;
    for (i = 0; i < SPN; i++) {
      if (spLife[i] <= 0) continue;
      spLife[i] -= dt;
      if (spLife[i] <= 0) { spPos[i * 3 + 1] = -50; continue; }
      spVel[i * 3 + 1] -= 14 * dt;
      spPos[i * 3] += spVel[i * 3] * dt;
      spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt;
      spPos[i * 3 + 2] += (spVel[i * 3 + 2] + frameV) * dt;
      if (spPos[i * 3 + 1] < 0.03) { spPos[i * 3 + 1] = 0.03; spVel[i * 3 + 1] *= -0.4; }
    }
    spGeo.attributes.position.needsUpdate = true;
    spGeo.attributes.color.needsUpdate = true;
    for (i = 0; i < smokes.length; i++) {
      var m = smokes[i];
      if (m.life <= 0) continue;
      m.life -= dt;
      if (m.life <= 0) { m.s.visible = false; continue; }
      var k = 1 - m.life / m.max;
      m.s.position.x += m.vx * dt; m.s.position.y += m.vy * dt; m.s.position.z += (m.vz + frameV) * dt;
      var sc = m.size * (0.6 + k * 2.2);
      m.s.scale.set(sc, sc, 1);
      m.s.material.opacity = (world.neon ? 0.35 : 0.55) * (1 - k) * Math.min(1, k * 8);
    }
  }

  /* -------------------------------------------------------------- build */
  function disposeScene() {
    scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
    });
    if (scene.background && scene.background.dispose) scene.background.dispose();
    if (world) world.dispose();
    scene.clear();
    RL.disposeCarCache();
    RL.disposePeopleCache();
  }
  function build() {
    disposeScene();
    var two = trafficMode === "two";
    world = RL.buildWorld(scene, renderer, mode, two);
    T = world.T;
    lanes = two
      ? [{ x: -5.4, dir: -1, speed: 26 }, { x: -1.8, dir: -1, speed: 31 }, { x: 1.8, dir: 1, speed: 31 }, { x: 5.4, dir: 1, speed: 26 }]
      : [{ x: -5.4, dir: 1, speed: 37 }, { x: -1.8, dir: 1, speed: 33 }, { x: 1.8, dir: 1, speed: 29 }, { x: 5.4, dir: 1, speed: 25 }];
    traffic = []; pool = {}; bodies = []; chunks = []; people = []; debrisGeo = null; P = null;
    buildFx();
    makePlayer();
    built = mode + trafficMode;
  }

  function makePlayer() {
    if (P && P.car) {
      scene.remove(P.car.group);
      P.car.group.traverse(function (o) { if (o.geometry && o.geometry.type === "BoxGeometry") o.geometry.dispose(); });
    }
    var car = RL.makeCar("sports", T.playerColor, T, true), spec = car.spec;
    scene.add(car.group);
    flames = [];
    [-0.28, 0.28].forEach(function (x) {
      var f = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: world.flameColor, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
      f.position.set(x, 0.34, spec.L / 2 + 0.4); f.visible = false;
      car.chassis.add(f); flames.push(f);
    });
    if (world.neon) {
      var ug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), new THREE.MeshBasicMaterial({ map: smokeTex, color: 0xff2a8a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      ug.rotation.x = -Math.PI / 2; ug.position.y = 0.03; car.group.add(ug);
    }
    P = {
      car: car, mesh: car.group, x: 1.8, z: 0, vx: 0, speed: 0, steer: 0, accel: 0, damage: 0, nitro: 0.5, boosting: false,
      hw: spec.W / 2, hl: spec.L / 2, hh: 0.6, mass: 1400, body: null, hitCd: 0, smokeT: 0
    };
    car.group.position.set(P.x, 0, 0);
  }

  /* ------------------------------------------------------------- traffic */
  function getCar(type) {
    var list = pool[type] || (pool[type] = []);
    var e = list.pop();
    if (!e) {
      var color = T.colors[(Math.random() * T.colors.length) | 0];
      var car = RL.makeCar(type, color, T, false), sp = car.spec;
      scene.add(car.group);
      e = { type: type, car: car, mesh: car.group, hw: sp.W / 2, hl: sp.L / 2, hh: sp.H / 2, mass: sp.mass, wr: sp.wheelR };
    }
    e.mesh.visible = true;
    e.mesh.quaternion.identity();
    return e;
  }
  function spawn(lane, z) {
    var type = TYPES[(Math.random() * TYPES.length) | 0];
    var e = getCar(type);
    e.lane = lane; e.dir = lane.dir; e.x = lane.x; e.z = z; e.lat = 0;
    e.speed = e.cruise = (lane.speed + rnd(-2.5, 2.5)) * (type === "truck" ? 0.86 : type === "sports" ? 1.12 : 1);
    e.vz = -e.dir * e.speed;
    e.passed = false; e.body = null; e.changeT = rnd(4, 16); e.target = null; e.blink = 0; e.hitCd = 0;
    e.car.blinkL.visible = e.car.blinkR.visible = false;
    e.mesh.rotation.set(0, e.dir > 0 ? 0 : Math.PI, 0);
    e.mesh.position.set(e.x, 0, e.z);
    traffic.push(e);
    return e;
  }
  function release(e) {
    e.mesh.visible = false;
    if (e.body) { var k = bodies.indexOf(e.body); if (k >= 0) bodies.splice(k, 1); e.body = null; }
    pool[e.type].push(e);
  }
  function clearTraffic() {
    for (var i = 0; i < traffic.length; i++) release(traffic[i]);
    traffic.length = 0;
  }
  function density() { return 1 + Math.min(1, dist / 9000) * 0.9; }
  function prefill() {
    lanes.forEach(function (l) {
      var z = -rnd(90, 200);
      while (z > SPAWN_Z) { spawn(l, z); z -= rnd(70, 200); }
      l.acc = 0; l.gap = rnd(60, 190);
    });
  }

  function updateTraffic(dt) {
    var i, j, e, o, driving = state === "drive";
    // spawning
    if (driving) {
      var nFwd = 0;
      for (i = 0; i < lanes.length; i++) if (lanes[i].dir > 0) nFwd++;
      for (i = 0; i < lanes.length; i++) {
        var l = lanes[i], closing = frameV - l.dir * l.speed;
        if (closing <= 0) continue;
        l.acc += closing * dt;
        if (l.acc < l.gap || traffic.length >= 34) continue;
        // never build a wall across every lane of a direction
        var near = 0;
        for (j = 0; j < traffic.length; j++) if (traffic[j].dir === l.dir && traffic[j].lane !== l && traffic[j].z < SPAWN_Z + 55) near++;
        if (near >= (l.dir > 0 ? nFwd : lanes.length - nFwd) - 1) continue;
        spawn(l, SPAWN_Z);
        l.acc = 0; l.gap = rnd(60, 200) / density();
      }
    }
    for (i = traffic.length - 1; i >= 0; i--) {
      e = traffic[i];
      if (e.body) {
        if (e.body.pos.z > 90 || e.body.pos.z < -900) { release(e); traffic.splice(i, 1); }
        continue;
      }
      if (e.hitCd > 0) e.hitCd -= dt;
      // follow the car ahead / brake for wrecks
      var want = e.cruise;
      for (j = 0; j < traffic.length; j++) {
        o = traffic[j];
        if (o === e || o.body || Math.abs(o.x - e.x) > 1.7) continue;
        var ahead = (e.z - o.z) * e.dir; // >0 when o is in front of e
        if (ahead > 0 && ahead < 26 + e.speed * 0.6) want = Math.min(want, o.dir === e.dir ? o.speed - (ahead < 12 ? 3 : 0) : 0);
      }
      if (driving && e.dir > 0 && Math.abs(P.x - e.x) < 1.7 && e.z > 0 && e.z < 26 + e.speed * 0.6) want = Math.min(want, Math.max(0, P.speed - (e.z < 12 ? 3 : 0)));
      for (j = 0; j < people.length; j++) {
        var pp = people[j], ap = (e.z - pp.z) * e.dir;
        if (!pp.hit && pp.kind === "cross" && ap > 0 && ap < 60 && Math.abs(pp.x - e.x) < 2.4) want = Math.min(want, Math.max(0, (ap - 9) * 0.6));
      }
      for (j = 0; j < bodies.length; j++) {
        var b = bodies[j], ab = (e.z - b.pos.z) * e.dir;
        if (!b.light && ab > 0 && ab < 110 && Math.abs(b.pos.x - e.x) < 3.2) want = Math.min(want, Math.max(0, (ab - 14) * 0.5));
      }
      if (e.speed > want) e.speed = Math.max(want, e.speed - 11 * dt); else e.speed = Math.min(want, e.speed + 3 * dt);
      var braking = e.speed > want + 0.5;
      e.vz = -e.dir * e.speed;

      // lane changes (signalled)
      if (driving && e.dir > 0 && !e.target) {
        e.changeT -= dt;
        if (e.changeT <= 0) {
          e.changeT = rnd(6, 18);
          var li = lanes.indexOf(e.lane), opts = [];
          if (lanes[li - 1] && lanes[li - 1].dir === e.dir) opts.push(lanes[li - 1]);
          if (lanes[li + 1] && lanes[li + 1].dir === e.dir) opts.push(lanes[li + 1]);
          var nl = opts[(Math.random() * opts.length) | 0], free = !!nl && e.z < -40 && e.z > -380;
          for (j = 0; free && j < traffic.length; j++) if (traffic[j] !== e && Math.abs(traffic[j].x - nl.x) < 2.2 && Math.abs(traffic[j].z - e.z) < 24) free = false;
          if (free) { e.target = nl; e.blink = 1.1; }
        }
      }
      if (e.target) {
        var right = e.target.x > e.x;
        if (e.blink > 0) {
          e.blink -= dt;
          var on = Math.floor(e.blink * 5) % 2 === 0;
          e.car.blinkL.visible = on && !right; e.car.blinkR.visible = on && right;
        } else {
          e.car.blinkL.visible = e.car.blinkR.visible = false;
          e.lat = (right ? 1 : -1) * 2.4;
          e.x += e.lat * dt;
          if ((right && e.x >= e.target.x) || (!right && e.x <= e.target.x)) { e.x = e.target.x; e.lane = e.target; e.target = null; e.lat = 0; e.cruise = e.lane.speed + rnd(-2, 2); }
        }
      }

      e.z += (e.vz + frameV) * dt;
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = (e.dir > 0 ? 0 : Math.PI) - e.lat * 0.03;
      var spin = e.speed * dt / e.wr;
      for (j = 0; j < e.car.wheels.length; j++) e.car.wheels[j].mesh.rotation.x -= spin;
      if (!T.neon) { /* brake lights share one material; skip per-car tint */ }

      // close calls + pass-by whoosh
      if (driving && !e.passed && e.z > P.hl * 0.2) {
        e.passed = true;
        var gap = Math.abs(e.x - P.x) - e.hw - P.hw, rel = frameV + e.vz;
        if (rel > 8 && gap < 4) sfx.noise(0.22, Math.min(0.22, rel / 380), 700 + rel * 12);
        if (rel > 9 && gap < 1.15 && e.hitCd <= 0) closeCall(e, rel);
      }
      // wreck pile-ups
      for (j = 0; j < bodies.length; j++) {
        var bb = bodies[j];
        if (!bb.light && bb.pos.y < 2.6 && Math.abs(bb.pos.x - e.x) < e.hw + bb.he.x * 0.9 && Math.abs(bb.pos.z - e.z) < e.hl + bb.he.z * 0.8) {
          toBody(e); impact(e.body, bb); break;
        }
      }
      if (e.z > 60 || e.z < -900) { release(e); traffic.splice(i, 1); }
    }
  }

  function closeCall(e, rel, label) {
    var head = e.dir < 0;
    combo = comboT > 0 ? Math.min(combo + 1, 12) : 1;
    comboT = 3.2;
    closeCalls++;
    var pts = (head ? 300 : 150) * combo;
    score += pts;
    P.nitro = Math.min(1, P.nitro + (head ? 0.22 : 0.14));
    sfx.coin(1 + combo * 0.06);
    A.popup((label || (head ? "HEAD-ON MISS" : "CLOSE CALL")) + (combo > 1 ? " x" + combo : "") + "  +" + pts, window.innerWidth / 2, window.innerHeight * 0.36, head ? "#ff5a5a" : "#ffd23f", 20 + Math.min(combo, 8));
  }

  /* -------------------------------------------------------------- people */
  // Pedestrians, cyclists and motorbike riders. They are light: hitting one costs
  // damage, speed and points instead of ending the run, and the same rigid-body
  // code that tumbles wrecked cars throws them (bodies flagged `light`).
  var people = [], pplAcc = 0, pplGap = 160;
  var pplTest = A.params.has("ppltest") ? 1 : 0;
  var KINDS = {
    walk: { hw: 0.3, hl: 0.25, hh: 0.88, mass: 75 }, cross: { hw: 0.3, hl: 0.25, hh: 0.88, mass: 75 },
    cycle: { hw: 0.35, hl: 0.85, hh: 0.5, mass: 16 }, moto: { hw: 0.42, hl: 1.05, hh: 0.55, mass: 210 }
  };
  function spawnPerson(z, forceKind) {
    var r = Math.random(), kind = forceKind || (r < 0.3 ? "walk" : r < 0.42 ? "cross" : r < 0.72 ? "cycle" : "moto");
    var two = trafficMode === "two", K = KINDS[kind], side = Math.random() < 0.5 ? -1 : 1;
    var p = { kind: kind, hw: K.hw, hl: K.hl, hh: K.hh, mass: K.mass, z: z, vx: 0, dir: 1, hit: false, passed: false, ph: rnd(0, 6), bodies: [], rider: null, riderMesh: null };
    if (kind === "moto") {
      // filters between lanes, faster than the cars
      p.dir = two && Math.random() < 0.4 ? -1 : 1;
      p.x = two ? p.dir * 3.6 : [-3.6, 0, 3.6][(Math.random() * 3) | 0];
      p.speed = rnd(38, 47);
      if (!forceKind && frameV - p.dir * p.speed < 5) return null; // would never reach the player
    } else if (kind === "cycle") {
      p.dir = two ? side : 1; p.x = side * 7.7; p.speed = rnd(6, 9);
    } else if (kind === "walk") {
      p.dir = Math.random() < 0.5 ? -1 : 1; p.x = side * 8.5; p.speed = rnd(1.2, 1.8);
    } else {
      p.x = side * 8.6; p.vx = -side * rnd(1.7, 2.8); p.speed = 0; // jaywalker
    }
    p.vz = -p.dir * p.speed;
    var obj = kind === "walk" || kind === "cross" ? RL.makePerson(T) : RL.makeBike(T, kind === "moto");
    p.mesh = obj.group;
    p.fig = obj.rider || obj;
    p.rider = obj.rider || null;
    p.mesh.rotation.y = kind === "cross" ? (p.vx > 0 ? -Math.PI / 2 : Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    p.mesh.position.set(p.x, 0, p.z);
    scene.add(p.mesh);
    people.push(p);
    return p;
  }
  function removePerson(p) {
    for (var i = 0; i < p.bodies.length; i++) { var k = bodies.indexOf(p.bodies[i]); if (k >= 0) bodies.splice(k, 1); }
    scene.remove(p.mesh);
    if (p.riderMesh) scene.remove(p.riderMesh);
  }
  // knock a person/bike away: hvx, hvz = ground velocity of whatever hit them
  function fling(p, hvx, hvz) {
    if (p.hit) return;
    p.hit = true;
    var dv = Math.abs(hvz - p.vz) + Math.abs(hvx - p.vx), k = Math.min(12, 3 + dv * 0.14), up = Math.min(9, 2.5 + dv * 0.07);
    function launch(mesh, hw, hh, hl, mass, boost) {
      mesh.updateWorldMatrix(true, false);
      var wp = new V3().setFromMatrixPosition(mesh.matrixWorld);
      var ent = { x: wp.x, z: wp.z, hw: hw, hh: hh, hl: hl, mass: mass, mesh: mesh };
      var b = makeBody(ent, new V3(hvx * 0.9 + rnd(-3, 3), up * boost, p.vz + (hvz - p.vz) * 1.08));
      b.pos.y = wp.y + hh; b.light = true;
      b.I = mass * (hw * hw + hh * hh + hl * hl) / 2.4;
      b.w.set(rnd(-1, 1) * k, rnd(-1, 1) * k * 0.6, rnd(-1, 1) * k);
      p.bodies.push(b);
    }
    var f = p.fig;
    f.arms[0].rotation.set(0, 0, -2.1); f.arms[1].rotation.set(0, 0, 2.1);
    f.legs[0].rotation.x = 0.5; f.legs[1].rotation.x = -0.4; f.upper.rotation.x = 0;
    if (p.rider) {
      // the rider leaves the bike and tumbles separately
      p.mesh.updateWorldMatrix(true, true);
      scene.attach(p.rider.group);
      p.riderMesh = p.rider.group;
      launch(p.riderMesh, 0.3, 0.88, 0.25, 75, 1.3);
    }
    launch(p.mesh, p.hw, p.hh, p.hl, p.mass, 1);
    sfx.tone(120, 0.12, "sine", 0.25, -40); sfx.noise(0.12, 0.2, 500);
  }
  function hitByPlayer(p) {
    var heavy = p.kind === "moto";
    fling(p, P.vx, -P.speed);
    P.damage += heavy ? 26 : 12;
    P.speed *= heavy ? 0.88 : 0.96;
    combo = 0; comboT = 0;
    score = Math.max(0, score - 300);
    shake = Math.max(shake, heavy ? 0.7 : 0.45);
    sfx.hit();
    if (heavy) sparks(p.x, 0.5, 0, 24, 0, 2, -P.speed * 0.8, 6);
    A.popup((heavy ? "BIKER" : p.kind === "cycle" ? "CYCLIST" : "PEDESTRIAN") + " HIT  -300", window.innerWidth / 2, window.innerHeight * 0.42, "#ff4d4d", 20);
  }
  function updatePeople(dt) {
    var driving = state === "drive", i, j;
    if (driving && peopleOn) {
      pplAcc += frameV * dt;
      if (pplTest && pplAcc > 90) {
        // dev aid (?ppltest): put each kind straight in the player's path to exercise the hit physics
        pplAcc = 0;
        var tp = spawnPerson(-140, ["walk", "cycle", "moto"][pplTest++ % 3]);
        tp.x = P.x; tp.vx = 0; tp.dir = 1; tp.vz = -Math.min(tp.speed, 8); tp.kind = tp.kind === "cross" ? "walk" : tp.kind; tp.mesh.rotation.y = 0;
      } else if (pplAcc > pplGap && people.length < 14) { pplAcc = 0; pplGap = rnd(110, 300) / density(); spawnPerson(SPAWN_Z); }
    }
    for (i = people.length - 1; i >= 0; i--) {
      var p = people[i];
      if (p.hit) {
        var gone = true;
        for (j = 0; j < p.bodies.length; j++) if (p.bodies[j].pos.z < 90 && p.bodies[j].pos.z > -900) gone = false;
        if (gone) { removePerson(p); people.splice(i, 1); }
        continue;
      }
      // animation: walk cycle or pedalling
      var f = p.fig;
      if (p.kind === "walk" || p.kind === "cross") {
        p.ph += dt * 7;
        var sw = Math.sin(p.ph) * 0.6;
        f.legs[0].rotation.x = sw; f.legs[1].rotation.x = -sw; f.arms[0].rotation.x = -sw * 0.6; f.arms[1].rotation.x = sw * 0.6;
      } else if (p.kind === "cycle") {
        p.ph += dt * 9;
        f.legs[0].rotation.x = 0.85 + Math.sin(p.ph) * 0.45; f.legs[1].rotation.x = 0.85 - Math.sin(p.ph) * 0.45;
      }
      if (p.kind === "cross") {
        p.x += p.vx * dt;
        if (Math.abs(p.x) > 8.55 && p.x * p.vx > 0) { // reached the far side: carry on along the shoulder
          p.kind = "walk"; p.vx = 0; p.dir = Math.random() < 0.5 ? -1 : 1; p.speed = 1.5; p.vz = -p.dir * p.speed;
          p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
        }
      }
      p.z += (p.vz + frameV) * dt;
      p.mesh.position.set(p.x, 0, p.z);

      if (driving) {
        var dx = Math.abs(p.x - P.x);
        if (dx < p.hw + P.hw && Math.abs(p.z) < p.hl + P.hl) { hitByPlayer(p); continue; }
        if (!p.passed && p.z > 0.4) {
          p.passed = true;
          var gap = dx - p.hw - P.hw, rel = frameV + p.vz;
          if (rel > 9 && gap < 1.0) closeCall(p, rel, "NEAR MISS");
        }
      }
      // run over by traffic, or caught by a tumbling wreck
      for (j = 0; j < traffic.length && !p.hit; j++) {
        var e = traffic[j];
        if (!e.body && Math.abs(e.x - p.x) < e.hw + p.hw && Math.abs(e.z - p.z) < e.hl + p.hl) fling(p, e.lat || 0, e.vz);
      }
      for (j = 0; j < bodies.length && !p.hit; j++) {
        var b = bodies[j];
        if (!b.light && b.pos.y < 2.2 && Math.abs(b.pos.x - p.x) < b.he.x + p.hw && Math.abs(b.pos.z - p.z) < b.he.z + p.hl && b.vel.lengthSq() > 9) fling(p, b.vel.x, b.vel.z);
      }
      if (!p.hit && (p.z > 60 || p.z < -900)) { removePerson(p); people.splice(i, 1); }
    }
  }

  /* ------------------------------------------------------- crash physics */
  var _r = new V3(), _vp = new V3(), _a = new V3(), _b = new V3(), _dq = new THREE.Quaternion(), UP = new V3(0, 1, 0);
  var CORNERS = [];
  for (var cx = -1; cx <= 1; cx += 2) for (var cy = -1; cy <= 1; cy += 2) for (var cz = -1; cz <= 1; cz += 2) CORNERS.push(new V3(cx, cy, cz));

  function makeBody(ent, vel) {
    var b = {
      ent: ent, pos: new V3(ent.x, ent.hh, ent.z), vel: vel, q: ent.mesh.quaternion.clone(), w: new V3(),
      m: ent.mass, I: ent.mass * (ent.hw * ent.hw + ent.hl * ent.hl) / 2.4, he: new V3(ent.hw, ent.hh, ent.hl), smoke: 0, rest: 0
    };
    bodies.push(b);
    return b;
  }
  function toBody(e) {
    if (!e.body) {
      e.car.blinkL.visible = e.car.blinkR.visible = false;
      e.body = makeBody(e, new V3(e.lat || 0, 0, e.vz));
    }
    return e.body;
  }
  // two-body impulse; returns how hard `a` was hit (delta-v in m/s)
  function impact(a, b) {
    var n = _a.set(a.pos.x - b.pos.x, 0, a.pos.z - b.pos.z);
    if (n.lengthSq() < 1e-4) n.set(0, 0, 1);
    n.normalize();
    var vr = _b.copy(a.vel).sub(b.vel), vn = vr.dot(n);
    if (vn >= 0) return 0;
    var j = -(1.25) * vn / (1 / a.m + 1 / b.m), sa = j / a.m, sb = j / b.m;
    var d = new V3(vr.x, 0, vr.z).normalize(), flipAxis = new V3().crossVectors(UP, d);
    var c = new V3((a.pos.x + b.pos.x) / 2, 0.55, (a.pos.z + b.pos.z) / 2);
    a.vel.addScaledVector(n, sa); b.vel.addScaledVector(n, -sb);
    a.vel.y += Math.min(7, sa * 0.17); b.vel.y += Math.min(7, sb * 0.17);
    var J = new V3().copy(n).multiplyScalar(j);
    a.w.add(new V3().subVectors(c, a.pos).cross(J).multiplyScalar(1 / a.I));
    b.w.sub(new V3().subVectors(c, b.pos).cross(J).multiplyScalar(1 / b.I));
    a.w.addScaledVector(flipAxis, Math.min(5, sa * 0.07)); b.w.addScaledVector(flipAxis, -Math.min(5, sb * 0.07));
    a.w.x += rnd(-1, 1) * Math.min(3, sa * 0.1); a.w.y += rnd(-1, 1) * Math.min(4, sa * 0.12); a.w.z += rnd(-1, 1) * Math.min(4, sa * 0.14);
    b.w.y += rnd(-1, 1) * Math.min(4, sb * 0.12); b.w.z += rnd(-1, 1) * Math.min(4, sb * 0.14);
    // fx
    var hard = Math.min(1, Math.max(sa, sb) / 30);
    var mv = (a.vel.z + b.vel.z) / 2;
    sparks(c.x, c.y, c.z, 30 + hard * 90, 0, 3, mv, 6 + hard * 10);
    debris(c, 5 + ((hard * 12) | 0), mv, a.ent === P ? T.playerColor : 0x888888);
    smoke(c.x, 1, c.z, 2.5, 1.4, mv * 0.3);
    shake = Math.max(shake, 0.5 + hard);
    sfx.noise(0.5 + hard * 0.4, 0.35 + hard * 0.25, 500 + hard * 900);
    sfx.tone(70, 0.4, "sine", 0.35, -30);
    return sa;
  }
  function stepBody(b, dt) {
    b.vel.y -= 15 * dt;
    b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt; b.pos.z += (b.vel.z + frameV) * dt;
    var wl = b.w.length();
    if (wl > 1e-4) { _dq.setFromAxisAngle(_a.copy(b.w).multiplyScalar(1 / wl), wl * dt); b.q.premultiply(_dq).normalize(); }
    var pen = 0, touching = false;
    for (var i = 0; i < 8; i++) {
      var r = _r.copy(CORNERS[i]).multiply(b.he).applyQuaternion(b.q);
      var py = b.pos.y + r.y;
      if (py >= 0) continue;
      touching = true;
      if (-py > pen) pen = -py;
      var vp = _vp.copy(b.w).cross(r).add(b.vel);
      if (vp.y < 0) {
        // normal impulse (n = up):  r x n = (-r.z, 0, r.x)
        var rnx = -r.z, rnz = r.x;
        var jn = -(1.28) * vp.y / (1 / b.m + (rnx * rnx + rnz * rnz) / b.I);
        b.vel.y += jn / b.m;
        b.w.x += rnx * jn / b.I; b.w.z += rnz * jn / b.I;
        // friction
        var tl = Math.hypot(vp.x, vp.z);
        if (tl > 0.05) {
          var tx = vp.x / tl, tz = vp.z / tl;
          var rt = _a.set(r.y * tz, r.z * tx - r.x * tz, -r.y * tx); // r x t
          var jt = Math.min(0.62 * jn, tl / (1 / b.m + rt.lengthSq() / b.I));
          b.vel.x -= tx * jt / b.m; b.vel.z -= tz * jt / b.m;
          b.w.addScaledVector(rt, -jt / b.I);
          if (!b.light && jn / b.m > 1.2 && Math.random() < 0.5) sparks(b.pos.x + r.x, 0.05, b.pos.z + r.z, 3, b.vel.x * 0.5, 1.5, b.vel.z * 0.5, 3);
        }
      }
    }
    b.pos.y += pen;
    // guardrails catch low wrecks; anything airborne clears them
    if (Math.abs(b.pos.x) > 8.5 && Math.abs(b.pos.x) < 10 && b.pos.y < 1.5 && b.pos.x * b.vel.x > 0) {
      sparks(b.pos.x, 0.6, b.pos.z, 10, -b.vel.x * 0.3, 2, b.vel.z * 0.5, 4);
      b.vel.x *= -0.4; b.vel.z *= 0.85; b.w.y += rnd(-2, 2);
    }
    b.w.multiplyScalar(1 - 0.5 * dt);
    if (touching) {
      // sliding scrub so wrecks eventually stop
      var k = Math.max(0, 1 - 1.1 * dt);
      b.vel.x *= k; b.vel.z *= k;
      if (b.vel.lengthSq() < 0.6 && b.w.lengthSq() < 0.6) { b.w.multiplyScalar(0.8); b.vel.x *= 0.8; b.vel.z *= 0.8; }
    }
    b.ent.x = b.pos.x; b.ent.z = b.pos.z;
    b.ent.mesh.quaternion.copy(b.q);
    b.ent.mesh.position.copy(_a.set(0, -b.he.y, 0).applyQuaternion(b.q).add(b.pos));
  }
  function updateBodies(dt) {
    var i, j, n = 3, h = dt / n;
    for (var s = 0; s < n; s++) {
      for (i = 0; i < bodies.length; i++) stepBody(bodies[i], h);
      for (i = 0; i < bodies.length; i++) for (j = i + 1; j < bodies.length; j++) {
        var a = bodies[i], b = bodies[j];
        var rr = Math.min(a.he.x, a.he.z * 0.6) + Math.min(b.he.x, b.he.z * 0.6) + 0.5;
        var dx = a.pos.x - b.pos.x, dy = a.pos.y - b.pos.y, dz = a.pos.z - b.pos.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < rr * rr && d2 > 1e-4) {
          var d = Math.sqrt(d2), push = rr - d, fa = b.m / (a.m + b.m), fb = 1 - fa;
          a.pos.x += dx / d * push * fa; a.pos.z += dz / d * push * fa; b.pos.x -= dx / d * push * fb; b.pos.z -= dz / d * push * fb;
          var vn = (a.vel.x - b.vel.x) * dx / d + (a.vel.z - b.vel.z) * dz / d;
          if (vn < -1.5) {
            var jj = -1.3 * vn / (1 / a.m + 1 / b.m);
            a.vel.x += dx / d * jj / a.m; a.vel.z += dz / d * jj / a.m; b.vel.x -= dx / d * jj / b.m; b.vel.z -= dz / d * jj / b.m;
            if (-vn > 6 && !a.light && !b.light) { sparks((a.pos.x + b.pos.x) / 2, 0.6, (a.pos.z + b.pos.z) / 2, 14, 0, 2, a.vel.z, 5); sfx.noise(0.2, 0.2, 700); }
          }
        }
      }
    }
    // wreck smoke
    for (i = 0; i < bodies.length; i++) {
      var w = bodies[i];
      if (w.light) continue;
      w.smoke -= dt;
      if (w.smoke <= 0) { w.smoke = 0.12; smoke(w.pos.x + rnd(-0.5, 0.5), w.pos.y + 0.4, w.pos.z + rnd(-1, 1), w.ent === P ? 2.4 : 1.6, 1.8, w.vel.z * 0.25); }
    }
  }

  var debrisGeo = null;
  function debris(c, n, vz, color) {
    if (!debrisGeo) debrisGeo = new THREE.BoxGeometry(1, 1, 1);
    for (var i = 0; i < n; i++) {
      var ch = null;
      for (var k = 0; k < chunks.length; k++) if (chunks[k].free) { ch = chunks[k]; break; }
      if (!ch) {
        if (chunks.length > 70) return;
        ch = { mesh: new THREE.Mesh(debrisGeo, T.dark), vel: new V3(), axis: new V3(), spin: 0, r: 0.1, free: true, wheel: false };
        if (T.shadows) ch.mesh.castShadow = true;
        scene.add(ch.mesh); chunks.push(ch);
      }
      ch.free = false; ch.mesh.visible = true;
      ch.mesh.material = Math.random() < 0.5 ? T.paint(color) : Math.random() < 0.5 ? T.glass : T.dark;
      ch.mesh.scale.set(rnd(0.08, 0.5), rnd(0.03, 0.14), rnd(0.08, 0.6));
      ch.r = 0.06;
      ch.mesh.position.set(c.x + rnd(-0.6, 0.6), c.y + rnd(0, 0.6), c.z + rnd(-0.6, 0.6));
      ch.vel.set(rnd(-9, 9), rnd(2, 10), vz + rnd(-12, 12));
      ch.axis.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); ch.spin = rnd(4, 18);
    }
  }
  function looseWheel(w, vel) {
    w.pivot.updateWorldMatrix(true, false);
    var m = w.pivot;
    var wp = new V3().setFromMatrixPosition(m.matrixWorld);
    scene.attach(m);
    chunks.push({ mesh: m, vel: new V3(vel.x + rnd(-6, 6), rnd(4, 9), vel.z + rnd(-8, 4)), axis: new V3(1, 0, 0), spin: rnd(10, 30), r: 0.33, free: false, wheel: true });
    m.position.copy(wp);
  }
  function updateChunks(dt) {
    for (var i = 0; i < chunks.length; i++) {
      var c = chunks[i];
      if (c.free) continue;
      c.vel.y -= 15 * dt;
      var p = c.mesh.position;
      p.x += c.vel.x * dt; p.y += c.vel.y * dt; p.z += (c.vel.z + frameV) * dt;
      if (p.y < c.r) {
        p.y = c.r;
        if (c.vel.y < 0) c.vel.y *= c.wheel ? -0.55 : -0.35;
        var k = Math.max(0, 1 - (c.wheel ? 0.5 : 3) * dt);
        c.vel.x *= k; c.vel.z *= k; c.spin *= Math.max(0, 1 - 1.5 * dt);
      }
      c.mesh.rotateOnAxis(c.axis, c.spin * dt);
      if (p.z > 120 || p.z < -900) { if (c.wheel) { scene.remove(c.mesh); chunks.splice(i--, 1); } else { c.free = true; c.mesh.visible = false; } }
    }
  }

  function crash(e) {
    if (state !== "drive") return;
    state = "crash"; crashT = 0;
    P.car.chassis.rotation.set(0, 0, 0);
    flames.forEach(function (f) { f.visible = false; });
    var pb = P.body = makeBody(P, new V3(P.vx, 0, -P.speed));
    var sev = 12;
    if (e) sev = impact(pb, toBody(e));
    else { pb.vel.y = 3; pb.w.set(rnd(-1, 1), (Math.random() < 0.5 ? -1 : 1) * rnd(3, 5), rnd(-2, 2)); sfx.noise(0.6, 0.4, 600); shake = 1; }
    if (sev > 9) {
      var ws = P.car.wheels.slice().sort(function () { return Math.random() - 0.5; });
      var n = sev > 25 ? 2 : 1;
      for (var i = 0; i < n; i++) looseWheel(ws[i], pb.vel);
    }
    sfx.boom();
    setEngine(0, 0, 0);
    hudEl.classList.remove("on"); touchEl.classList.remove("on"); tagEl.innerHTML = "";
    S.setScore(Math.floor(score));
    var km = (dist / 1000).toFixed(1);
    setTimeout(function () {
      sfx.over();
      S.gameOver('<div class="rl-stats"><div>' + km + '<small>KM</small></div><div>' + Math.round(topSpeed * 3.6) + '<small>TOP KM/H</small></div><div>' + closeCalls + "<small>CLOSE CALLS</small></div></div>");
    }, 2300);
  }

  /* --------------------------------------------------------------- audio */
  var eng = null;
  function initAudio() {
    if (eng) return;
    var a = A.audio();
    if (!a) return;
    var c = a.ctx;
    eng = { ctx: c, gain: c.createGain(), filt: c.createBiquadFilter(), o: [], wind: c.createGain(), wf: c.createBiquadFilter() };
    eng.gain.gain.value = 0; eng.filt.type = "lowpass"; eng.filt.frequency.value = 800;
    [["sawtooth", 1, 0.5], ["square", 0.5, 0.35], ["sawtooth", 1.505, 0.18]].forEach(function (d) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = d[0]; g.gain.value = d[2]; o.frequency.value = 60 * d[1];
      o.connect(g); g.connect(eng.filt); o.start();
      eng.o.push({ o: o, mul: d[1] });
    });
    eng.filt.connect(eng.gain); eng.gain.connect(a.master);
    var buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    eng.wf.type = "bandpass"; eng.wf.frequency.value = 600; eng.wf.Q.value = 0.4; eng.wind.gain.value = 0;
    src.connect(eng.wf); eng.wf.connect(eng.wind); eng.wind.connect(a.master); src.start();
  }
  var GEARS = [17, 30, 46, 64, 84, 140];
  function setEngine(v, throttle, vol) {
    if (!eng) return;
    var now = eng.ctx.currentTime, g = 0, lo = 0;
    while (g < GEARS.length - 1 && v > GEARS[g]) { lo = GEARS[g]; g++; }
    var rpm = clamp((v - lo) / (GEARS[g] - lo), 0, 1) * (g === 0 ? 0.85 : 0.6) + (g === 0 ? 0.15 : 0.4);
    var f = 48 + rpm * 150 + throttle * 8;
    eng.o.forEach(function (o) { o.o.frequency.setTargetAtTime(f * o.mul, now, 0.04); });
    eng.filt.frequency.setTargetAtTime(350 + rpm * 1500 + throttle * 700, now, 0.06);
    eng.gain.gain.setTargetAtTime(vol * (0.05 + throttle * 0.05), now, 0.08);
    eng.wind.gain.setTargetAtTime(vol * Math.min(0.16, v * v / 60000), now, 0.1);
    eng.wf.frequency.setTargetAtTime(400 + v * 9, now, 0.1);
  }

  /* --------------------------------------------------------------- input */
  var keys = {}, pointers = {}, touchSteer = 0, touchMode = false, tBrake = false, tNitro = false;
  window.addEventListener("keydown", function (e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === "c" && S.playing) camMode = 1 - camMode;
  });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
  function updTouch() { var d = 0; for (var id in pointers) d += pointers[id]; touchSteer = clamp(d, -1, 1); }
  function sideOf(e) { return e.clientX < window.innerWidth / 2 ? -1 : 1; }
  renderer.domElement.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "touch" && !touchMode) { touchMode = true; if (state === "drive") touchEl.classList.add("on"); }
    if (e.pointerType !== "touch") return;
    pointers[e.pointerId] = sideOf(e); updTouch();
  });
  window.addEventListener("pointermove", function (e) { if (pointers[e.pointerId] != null) { pointers[e.pointerId] = sideOf(e); updTouch(); } });
  function pup(e) { delete pointers[e.pointerId]; updTouch(); }
  window.addEventListener("pointerup", pup); window.addEventListener("pointercancel", pup);
  function hold(id, set) {
    var b = document.getElementById(id);
    b.addEventListener("pointerdown", function (e) { e.stopPropagation(); e.preventDefault(); set(true); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (n) { b.addEventListener(n, function () { set(false); }); });
  }
  hold("tb", function (v) { tBrake = v; }); hold("tn", function (v) { tNitro = v; });

  /* ---------------------------------------------------------------- flow */
  function resetRun() {
    clearTraffic();
    bodies.length = 0;
    for (var q = 0; q < people.length; q++) removePerson(people[q]);
    people.length = 0; pplAcc = 0;
    for (var i = chunks.length - 1; i >= 0; i--) { if (chunks[i].wheel) { scene.remove(chunks[i].mesh); chunks.splice(i, 1); } else { chunks[i].free = true; chunks[i].mesh.visible = false; } }
    for (i = 0; i < smokes.length; i++) { smokes[i].life = 0; smokes[i].s.visible = false; }
    for (i = 0; i < SPN; i++) { spLife[i] = 0; spPos[i * 3 + 1] = -50; }
    makePlayer();
    dist = 0; score = 0; combo = 0; comboT = 0; closeCalls = 0; topSpeed = 0; shake = 0; tagText = "";
  }
  function toAttract() { resetRun(); state = "attract"; frameV = 26; hudEl.classList.remove("on"); touchEl.classList.remove("on"); tagEl.innerHTML = ""; }
  function start() {
    if (built !== mode + trafficMode) build();
    resetRun();
    initAudio();
    state = "drive";
    P.speed = 30; frameV = 30; camX = P.x * 0.82; keys = {};
    prefill();
    hudEl.classList.add("on");
    if (touchMode) touchEl.classList.add("on");
  }

  function drive(dt) {
    var steerIn = 0;
    if (keys["arrowleft"] || keys["a"]) steerIn -= 1;
    if (keys["arrowright"] || keys["d"]) steerIn += 1;
    steerIn = clamp(steerIn + touchSteer, -1, 1);
    var gas = keys["arrowup"] || keys["w"] || touchMode, brake = keys["arrowdown"] || keys["s"] || tBrake;
    var wantN = keys["shift"] || keys[" "] || tNitro;
    P.boosting = !!wantN && P.nitro > 0.02 && !brake;
    if (P.boosting) { P.nitro = Math.max(0, P.nitro - 0.22 * dt); gas = true; }
    else P.nitro = Math.min(1, P.nitro + 0.015 * dt);

    var vmax = (P.boosting ? 128 : 100) * (1 - Math.max(0, P.damage - 50) / 50 * 0.35), a;
    if (brake) a = -28;
    else if (gas) a = (P.boosting ? 30 : 15) * (1 - Math.pow(P.speed / vmax, 2));
    else a = -(1.5 + P.speed * 0.014);
    if (P.speed > vmax) a = Math.min(a, -8);
    P.accel += (a - P.accel) * Math.min(1, dt * 6);
    P.speed = Math.max(0, P.speed + a * dt);
    if (P.speed > topSpeed) topSpeed = P.speed;

    P.steer += (steerIn - P.steer) * Math.min(1, dt * 9);
    var maxLat = 4.5 + Math.min(10, P.speed * 0.11);
    P.vx = P.steer * maxLat * Math.min(1, P.speed / 4);
    P.x += P.vx * dt;
    if (P.hitCd > 0) P.hitCd -= dt;

    // guardrails
    var lim = RL.ROAD_LIMIT - P.hw;
    if (Math.abs(P.x) > lim) {
      var sd = P.x > 0 ? 1 : -1;
      P.x = sd * lim;
      if (P.speed > 6) {
        P.speed *= 1 - 0.55 * dt;
        P.damage += dt * (10 + P.speed * 0.28);
        sparks(P.x + sd * P.hw, 0.55, rnd(-1.5, 1.5), 4, -sd * 2, 2, -P.speed * 0.6, 4);
        shake = Math.max(shake, 0.25);
        if (Math.random() < 0.3) sfx.noise(0.08, 0.14, 2400);
      }
      P.steer *= 0.6;
    }

    frameV = P.speed;
    dist += P.speed * dt;
    var kmh = P.speed * 3.6, wrong = trafficMode === "two" && P.x < -0.3;
    var mult = (kmh >= 100 ? 1 : 0.5) + (kmh >= 200 ? 1 : 0) + (kmh >= 300 ? 1 : 0) + (kmh >= 400 ? 1 : 0) + (wrong ? 2 : 0);
    score += P.speed * dt * 0.5 * mult;
    if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
    var tg = "x" + mult + (wrong ? "<small>WRONG WAY BONUS</small>" : kmh >= 300 ? "<small>REDLINE</small>" : "");
    if (tg !== tagText) { tagText = tg; tagEl.innerHTML = tg; }

    // collisions with traffic
    for (var i = 0; i < traffic.length; i++) {
      var e = traffic[i];
      if (e.body) continue;
      var dx = P.x - e.x, dz = -e.z, ox = P.hw + e.hw - Math.abs(dx), oz = P.hl + e.hl - Math.abs(dz);
      if (ox <= 0 || oz <= 0) continue;
      var dv = Math.abs(-P.speed - e.vz), sgn = dx >= 0 ? 1 : -1;
      if (ox < 0.5 && ox < oz && dv < 30) {
        // sideswipe: trade paint, lose speed, keep going
        P.x += sgn * ox; e.x -= sgn * 0.15; P.steer = sgn * 0.5;
        if (P.hitCd <= 0) {
          P.hitCd = 0.35; e.hitCd = 1; e.passed = true;
          P.speed *= 0.93; P.damage += 9 + dv * 0.7;
          sparks(P.x - sgn * P.hw, 0.6, clamp(-dz, -2, 2), 26, sgn * 3, 2, -P.speed * 0.7, 6);
          shake = Math.max(shake, 0.55); sfx.hit();
          A.popup("SCRAPE", window.innerWidth / 2, window.innerHeight * 0.44, "#ff8a5a", 16);
        }
      } else if (oz <= ox && dv < 8 && e.dir > 0) {
        // gentle nose-to-tail bump
        var front = dz > 0; // traffic car is ahead of the player
        if (front) { P.speed = Math.max(0, e.speed - 1.5); e.speed += 2; } else { e.speed = Math.max(0, P.speed - 1.5); }
        e.z += (front ? -1 : 1) * (oz + 0.05);
        if (P.hitCd <= 0) { P.hitCd = 0.4; e.hitCd = 1; e.passed = true; P.damage += 6 + dv * 1.5; shake = Math.max(shake, 0.4); sfx.hit(); sparks(P.x, 0.5, front ? -P.hl : P.hl, 12, 0, 2, -P.speed, 4); }
      } else { crash(e); return; }
    }
    if (P.damage >= 100) { P.damage = 100; crash(null); return; }

    // car pose
    var car = P.car;
    car.group.position.set(P.x, 0, 0);
    car.group.rotation.y = -P.steer * 0.085;
    car.chassis.rotation.z = P.steer * 0.045 * Math.min(1, P.speed / 30);
    car.chassis.rotation.x = clamp(P.accel * 0.0022, -0.05, 0.035);
    car.chassis.position.y = Math.sin(t * 31) * 0.004 * Math.min(1, P.speed / 60);
    var spin = P.speed * dt / 0.33;
    for (var w = 0; w < car.wheels.length; w++) {
      car.wheels[w].mesh.rotation.x -= spin;
      if (car.wheels[w].front) car.wheels[w].pivot.rotation.y = -P.steer * 0.3;
    }
    for (w = 0; w < car.tails.length; w++) car.tails[w].scale.y = brake ? 1.8 : 1;
    flames.forEach(function (f) { f.visible = P.boosting; var s = rnd(0.7, 1.3); f.scale.set(s, s, 1); });
    if (P.boosting && Math.random() < 0.5) sparks(P.x + rnd(-0.3, 0.3), 0.34, P.hl + 0.3, 1, 0, 0.5, -P.speed + 8, 1);
    if (P.damage > 55) { P.smokeT -= dt; if (P.smokeT <= 0) { P.smokeT = 0.09; smoke(P.x + rnd(-0.3, 0.3), 0.9, -1.4, 0.7 + P.damage / 100, 0.9, -P.speed * 0.85); } }

    spdEl.textContent = Math.round(kmh);
    nosEl.style.width = P.nitro * 100 + "%";
    dmgEl.style.width = P.damage + "%";
    S.setScore(Math.floor(score));
    setEngine(P.speed, gas && !brake ? 1 : 0, 1);
  }

  /* -------------------------------------------------------------- camera */
  var look = new V3();
  function updateCamera(dt, rdt) {
    var fov = world.baseFov, sh = 0;
    if (state === "drive") {
      var k = P.speed / 100;
      camX += (P.x * 0.84 - camX) * Math.min(1, dt * 7);
      if (camMode === 0) {
        camera.position.set(camX, 2.2 + k * 0.25, 6.3 + (P.boosting ? 0.9 : 0) + clamp(P.accel * 0.02, -0.4, 0.4));
        look.set(P.x * 0.92, 0.95, -16);
      } else {
        camera.position.set(P.x, 1.02, -0.35);
        look.set(P.x + P.steer * 1.5, 0.9, -30);
      }
      fov += k * 24 + (P.boosting ? 7 : 0);
      sh = k * k * 0.035 + (P.boosting ? 0.03 : 0);
    } else if (state === "crash") {
      var b = P.body, ang = 0.5 + crashT * 0.35, rad = 8.5 + Math.min(5, crashT * 1.6);
      var tx = b.pos.x + Math.sin(ang) * rad, tz = b.pos.z + Math.cos(ang) * rad;
      camera.position.x += (tx - camera.position.x) * Math.min(1, rdt * 3);
      camera.position.y += (3.2 - camera.position.y) * Math.min(1, rdt * 3);
      camera.position.z += (tz - camera.position.z) * Math.min(1, rdt * 3);
      look.lerp(_a.set(b.pos.x, Math.max(0.8, b.pos.y), b.pos.z), Math.min(1, rdt * 8));
      fov += 4;
    } else {
      var a2 = t * 0.22;
      camera.position.set(P.x + Math.sin(a2) * 7.5, 1.9 + Math.sin(t * 0.3) * 0.5, Math.cos(a2) * 7.5);
      look.set(P.x, 0.7, 0);
    }
    if (shake > 0) { shake = Math.max(0, shake - rdt * 1.8); sh += shake * 0.35; }
    camera.position.x += rnd(-1, 1) * sh; camera.position.y += rnd(-1, 1) * sh * 0.6;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, rdt * 5); camera.updateProjectionMatrix(); }
    camera.lookAt(look);
  }

  /* ---------------------------------------------------------------- loop */
  build();
  toAttract();
  if (A.params.has("debug")) {
    // dev aid: ?debug=<orbit angle> parks one of each vehicle next to the player
    ["sedan", "hatch", "suv", "van", "truck", "sports"].forEach(function (ty, i) {
      var e = getCar(ty); e.mesh.position.set(i % 2 ? -5.4 : 5.4, 0, -4 - ((i / 2) | 0) * 8);
    });
    ["walk", "cycle", "moto", "cross"].forEach(function (k, i) { var pr = spawnPerson(0, k); if (pr) { pr.x = -1.6 + i * 1.5; pr.z = -3.5; pr.vz = -26; pr.vx = 0; pr.kind = k === "cross" ? "walk" : k; } });
    t = (parseFloat(A.params.get("debug")) || 0) / 0.22;
  }
  A.loop(function (rdt) {
    if (S.paused) { renderer.render(scene, camera); return; }
    var ts = 1;
    if (state === "crash") { crashT += rdt; ts = crashT < 1.1 ? 0.2 : Math.min(1, 0.2 + (crashT - 1.1) * 1.3); }
    var dt = rdt * ts;
    t += dt;

    if (state === "drive" && S.playing) drive(dt);
    if (state === "crash") frameV = Math.max(-5, -P.body.vel.z);
    else if (state === "attract") {
      frameV = 26;
      P.car.group.position.set(P.x, 0, 0);
      for (var w = 0; w < P.car.wheels.length; w++) P.car.wheels[w].mesh.rotation.x -= frameV * dt / 0.33;
    }

    world.scroll(frameV * dt);
    updateTraffic(dt);
    updatePeople(dt);
    updateBodies(dt);
    updateChunks(dt);
    updateFx(dt);
    updateCamera(dt, rdt);
    renderer.render(scene, camera);
  });
})();
