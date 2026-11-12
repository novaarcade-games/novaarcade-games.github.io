/* Skyline Stack — timing tower builder with three.js */
(function () {
  "use strict";
  var A = Arcade, sfx = A.sfx;

  var S = A.shell({
    id: "skyline-stack",
    title: "Skyline Stack",
    scoreLabel: "FLOORS",
    pausable: false,
    howto: "Tap, click or press <kbd>Space</kbd> to drop each floor.<br>Anything hanging over the edge gets sliced off. Land <b>3 perfects</b> in a row to grow the floor back.",
    onStart: reset
  });

  var bigEl = document.getElementById("big"), comboEl = document.getElementById("combo");

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
  var viewH = 14, viewTarget = 14;
  function setView() {
    var a = window.innerWidth / window.innerHeight;
    var vh = Math.max(viewH, 11 / a);
    camera.left = -vh * a / 2; camera.right = vh * a / 2;
    camera.top = vh / 2; camera.bottom = -vh / 2;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", function () { renderer.setSize(window.innerWidth, window.innerHeight); setView(); });

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  var sunL = new THREE.DirectionalLight(0xffffff, 1.5);
  sunL.position.set(4, 12, 7);
  scene.add(sunL);
  var fill = new THREE.DirectionalLight(0x9db4ff, 0.35);
  fill.position.set(-6, 2, -3);
  scene.add(fill);

  var H = 0.6, SIZE = 3.2, RANGE = 5.2;
  var geo = new THREE.BoxGeometry(1, 1, 1);
  var baseHue = Math.random() * 360;

  function colorFor(level) {
    var c = new THREE.Color();
    c.setHSL(((baseHue + level * 9) % 360) / 360, 0.7, 0.62);
    return c;
  }
  function makeBlock(x, y, z, w, d, level, h) {
    var m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: colorFor(level) }));
    m.scale.set(w, h || H, d);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }

  var stack = [], debris = [], rings = [];
  var cur = null, axis = "x", dir = 1, offset = 0, speed = 4, camY = 0, combo = 0, dead = false;

  function clearAll() {
    stack.forEach(function (s) { scene.remove(s.mesh); });
    debris.forEach(function (d) { scene.remove(d.mesh); });
    rings.forEach(function (r) { scene.remove(r.line); });
    if (cur) scene.remove(cur.mesh);
    stack = []; debris = []; rings = []; cur = null;
  }

  function build() {
    clearAll();
    baseHue = Math.random() * 360;
    var base = makeBlock(0, -6, 0, SIZE, SIZE, 0, 12);
    stack.push({ mesh: base, x: 0, z: 0, w: SIZE, d: SIZE });
    updateBg(0);
  }

  function updateBg(level) {
    var h1 = (250 + level * 2.5) % 360, h2 = (320 + level * 2.5) % 360;
    document.body.style.setProperty("--top", "hsl(" + h1 + ",55%," + Math.max(6, 16 - level * 0.12) + "%)");
    document.body.style.setProperty("--bot", "hsl(" + h2 + ",70%,58%)");
  }

  function spawn() {
    var top = stack[stack.length - 1];
    var level = stack.length;
    axis = level % 2 ? "x" : "z";
    offset = -RANGE; dir = 1;
    var m = makeBlock(top.x, (level - 0.5) * H, top.z, top.w, top.d, level);
    cur = { mesh: m, x: top.x, z: top.z, w: top.w, d: top.d };
    speed = Math.min(10, 4.2 + level * 0.09);
    placeCur();
  }
  function placeCur() {
    var top = stack[stack.length - 1];
    if (axis === "x") { cur.x = top.x + offset; cur.mesh.position.x = cur.x; }
    else { cur.z = top.z + offset; cur.mesh.position.z = cur.z; }
  }

  function reset() {
    build();
    dead = false; combo = 0; viewTarget = 14; viewH = 14; setView();
    bigEl.textContent = "0";
    spawn();
  }

  function addDebris(x, y, z, w, d, level, vx, vz) {
    var m = makeBlock(x, y, z, w, d, level);
    debris.push({ mesh: m, vy: 0, vx: vx || 0, vz: vz || 0, rx: (Math.random() - 0.5) * 3, rz: (Math.random() - 0.5) * 3 });
  }

  function ring(x, y, z, w, d, color) {
    var pts = [
      new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, 0, -d / 2),
      new THREE.Vector3(w / 2, 0, d / 2), new THREE.Vector3(-w / 2, 0, d / 2), new THREE.Vector3(-w / 2, 0, -d / 2)
    ];
    var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: color || 0xffffff, transparent: true }));
    line.position.set(x, y, z);
    scene.add(line);
    rings.push({ line: line, t: 0 });
  }

  function flashCombo(text) {
    comboEl.textContent = text;
    comboEl.style.opacity = 1;
    clearTimeout(flashCombo.t);
    flashCombo.t = setTimeout(function () { comboEl.style.opacity = 0; }, 700);
  }

  function drop() {
    if (!S.playing || dead || !cur) return;
    var top = stack[stack.length - 1];
    var level = stack.length;
    var y = (level - 0.5) * H;
    var key = axis === "x" ? "x" : "z", sz = axis === "x" ? "w" : "d";
    var c = cur[key], p = top[key], s = cur[sz];
    var delta = c - p;
    var ad = Math.abs(delta);
    var tol = 0.14;

    if (ad <= tol) {
      // perfect!
      combo++;
      cur[key] = p;
      if (combo >= 3 && cur[sz] < SIZE) cur[sz] = Math.min(SIZE, cur[sz] + 0.25);
      cur.mesh.position[key] = p;
      cur.mesh.scale.set(cur.w, H, cur.d);
      sfx.tone(440 * Math.pow(1.0595, Math.min(combo, 24) * 2), 0.18, "triangle", 0.22);
      ring(cur.x, y - H / 2, cur.z, cur.w + 0.3, cur.d + 0.3);
      if (combo >= 3) ring(cur.x, y - H / 2, cur.z, cur.w + 0.7, cur.d + 0.7, 0xfff3a0);
      flashCombo(combo >= 2 ? "PERFECT x" + combo : "PERFECT");
    } else {
      var overlap = s - ad;
      if (overlap <= 0) {
        // complete miss
        scene.remove(cur.mesh);
        addDebris(cur.x, y, cur.z, cur.w, cur.d, level, axis === "x" ? Math.sign(delta) * 2 : 0, axis === "z" ? Math.sign(delta) * 2 : 0);
        cur = null;
        gameOver();
        return;
      }
      combo = 0;
      var newC = p + delta / 2;
      var chopC = newC + Math.sign(delta) * (overlap / 2 + ad / 2);
      cur[sz] = overlap;
      cur[key] = newC;
      cur.mesh.scale.set(cur.w, H, cur.d);
      cur.mesh.position[key] = newC;
      var dx = key === "x" ? chopC : cur.x, dz = key === "z" ? chopC : cur.z;
      addDebris(dx, y, dz, key === "x" ? ad : cur.w, key === "z" ? ad : cur.d, level,
        key === "x" ? Math.sign(delta) * 1.5 : 0, key === "z" ? Math.sign(delta) * 1.5 : 0);
      sfx.tone(300 + Math.random() * 40, 0.09, "square", 0.08);
      sfx.noise(0.08, 0.12, 2500);
    }

    stack.push(cur);
    cur = null;
    S.setScore(stack.length - 1);
    S.setBestLive();
    bigEl.textContent = stack.length - 1;
    updateBg(stack.length);
    spawn();
  }

  function gameOver() {
    dead = true;
    sfx.hit();
    setTimeout(sfx.over, 250);
    var floors = stack.length - 1;
    viewTarget = Math.max(14, floors * H + 8);
    S.gameOver();
  }

  window.addEventListener("pointerdown", function (e) { if (e.button === 0 || e.pointerType !== "mouse") drop(); });
  window.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") drop(); });

  build();
  setView();

  var t = 0;
  A.loop(function (dt) {
    t += dt;
    if (cur && S.playing && !dead) {
      offset += dir * speed * dt;
      if (offset > RANGE) { offset = RANGE; dir = -1; }
      if (offset < -RANGE) { offset = -RANGE; dir = 1; }
      placeCur();
    }

    for (var i = debris.length - 1; i >= 0; i--) {
      var d = debris[i];
      d.vy -= 28 * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.x += d.rx * dt;
      d.mesh.rotation.z += d.rz * dt;
      if (d.mesh.position.y < camY - 30) { scene.remove(d.mesh); debris.splice(i, 1); }
    }
    for (var r = rings.length - 1; r >= 0; r--) {
      var rg = rings[r];
      rg.t += dt;
      var s = 1 + rg.t * 1.6;
      rg.line.scale.set(s, 1, s);
      rg.line.material.opacity = Math.max(0, 1 - rg.t * 2);
      if (rg.t > 0.5) { scene.remove(rg.line); rings.splice(r, 1); }
    }

    var height = (stack.length - 1) * H;
    var targetY = dead ? height / 2 : height;
    camY += (targetY - camY) * Math.min(1, dt * 3);
    viewH += (viewTarget - viewH) * Math.min(1, dt * 2.5);
    setView();
    var orbit = S.playing ? 0 : Math.sin(t * 0.25) * 0.25;
    camera.position.set(Math.cos(Math.PI / 4 + orbit) * 12, camY + 9, Math.sin(Math.PI / 4 + orbit) * 12);
    camera.lookAt(0, camY - 0.5, 0);

    renderer.render(scene, camera);
  });
})();
