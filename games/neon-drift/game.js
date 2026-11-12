/* Neon Drift — synthwave highway dodger built with three.js */
(function () {
  "use strict";
  var A = Arcade, sfx = A.sfx;

  var S = A.shell({
    id: "neon-drift",
    title: "Neon Drift",
    howto: "Steer with <kbd>&larr;</kbd><kbd>&rarr;</kbd> or <kbd>A</kbd><kbd>D</kbd> &mdash; on touch, hold the left or right side.<br>Grab <span style='color:#00f0ff'>orbs</span> to build your multiplier. Skim past blocks for <b>close-call</b> bonuses.",
    onStart: reset
  });

  /* ---------------------------------------------------------------- setup */
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0120);
  scene.fog = new THREE.Fog(0x14022e, 30, 170);

  var camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 3.2, 8);

  window.addEventListener("resize", function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  scene.add(new THREE.HemisphereLight(0xff66cc, 0x220044, 0.9));
  var dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(3, 10, 6);
  scene.add(dir);

  function canvasTex(w, h, draw) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Sky gradient
  var skyTex = canvasTex(4, 256, function (g, w, h) {
    var grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#05000f");
    grd.addColorStop(0.45, "#2a0450");
    grd.addColorStop(0.75, "#7a0f6e");
    grd.addColorStop(1, "#ff3d81");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  var sky = new THREE.Mesh(new THREE.PlaneGeometry(900, 260), new THREE.MeshBasicMaterial({ map: skyTex, fog: false, depthWrite: false }));
  sky.position.set(0, 70, -260);
  scene.add(sky);

  // Stars
  (function () {
    var n = 500, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 800;
      pos[i * 3 + 1] = 40 + Math.random() * 160;
      pos[i * 3 + 2] = -250;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, fog: false, transparent: true, opacity: 0.8 })));
  })();

  // Striped retro sun
  var sunTex = canvasTex(256, 256, function (g, w, h) {
    var grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#ffe76a"); grd.addColorStop(0.5, "#ff8a3d"); grd.addColorStop(1, "#ff2a8a");
    g.fillStyle = grd;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = "destination-out";
    for (var i = 0; i < 9; i++) {
      var y = h * 0.52 + i * i * 1.6 + i * 9, th = 2 + i * 1.3;
      g.fillRect(0, y, w, th);
    }
  });
  var sun = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
  sun.position.set(0, 26, -250);
  scene.add(sun);

  // Glow sprite texture
  var glowTex = canvasTex(64, 64, function (g) {
    var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.2, "rgba(255,255,255,0.8)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  });
  function glowSprite(color, size) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.set(size, size, 1);
    return s;
  }
  var sunGlow = glowSprite(0xff4fa0, 230);
  sunGlow.material.fog = false;
  sunGlow.material.opacity = 0.55;
  sunGlow.position.set(0, 26, -255);
  scene.add(sunGlow);

  // Floor & moving grid
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: 0x090016 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);
  var CELL = 4;
  var grid = new THREE.GridHelper(400, 100, 0xff2a8a, 0xb300ff);
  grid.material.transparent = true;
  grid.material.opacity = 0.75;
  scene.add(grid);

  // Road edge rails
  var railMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  [-7, 7].forEach(function (x) {
    var r = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 400), railMat);
    r.position.set(x, 0.1, -150);
    scene.add(r);
  });

  // Scrolling side pylons
  var pylons = [];
  var pylonGeo = new THREE.BoxGeometry(0.35, 3, 0.35);
  var pylonMat = new THREE.MeshBasicMaterial({ color: 0xff2a8a });
  for (var i = 0; i < 24; i++) {
    [-8.5, 8.5].forEach(function (x) {
      var p = new THREE.Mesh(pylonGeo, pylonMat);
      p.position.set(x, 1.5, 10 - i * 8);
      scene.add(p);
      pylons.push(p);
    });
  }

  // Wireframe mountains
  function mountains(side) {
    var geo = new THREE.PlaneGeometry(120, 320, 24, 60);
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i);
      var edge = (x + 60) / 120; // 0 near road, 1 far
      var h = Math.pow(edge, 1.4) * (8 + Math.random() * 22);
      p.setZ(i, h);
    }
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x9d00ff, wireframe: true, transparent: true, opacity: 0.45 }));
    m.rotation.x = -Math.PI / 2;
    if (side < 0) m.rotation.z = Math.PI;
    m.position.set(side * 74, 0, -150);
    scene.add(m);
  }
  mountains(-1); mountains(1);

  /* --------------------------------------------------------------- player */
  var ship = new THREE.Group();
  var hullMat = new THREE.MeshStandardMaterial({ color: 0x2a2050, emissive: 0x0090ff, emissiveIntensity: 0.12, metalness: 0.7, roughness: 0.25, flatShading: true });
  var trimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  var hull = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 4), hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.rotation.y = Math.PI / 4;
  hull.scale.set(1, 1, 0.45);
  ship.add(hull);
  var wing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.8), hullMat);
  wing.position.set(0, -0.05, 0.6);
  ship.add(wing);
  [-1.2, 1.2].forEach(function (x) {
    var t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.9), trimMat);
    t.position.set(x, 0.05, 0.6);
    ship.add(t);
  });
  var engine = glowSprite(0x00f0ff, 1.4);
  engine.position.set(0, 0.05, 1.5);
  ship.add(engine);
  var shipLight = new THREE.PointLight(0x00f0ff, 2.5, 8, 1.5);
  shipLight.position.set(0, 1, 0);
  ship.add(shipLight);
  ship.position.set(0, 0.55, 0);
  scene.add(ship);

  /* ------------------------------------------------------------ obstacles */
  var boxGeo = new THREE.BoxGeometry(1, 1, 1);
  var edgeGeo = new THREE.EdgesGeometry(boxGeo);
  var COLORS = [0xff2a8a, 0xffb000, 0xb300ff];
  var obsMats = COLORS.map(function (c) {
    return {
      body: new THREE.MeshStandardMaterial({ color: 0x14001f, emissive: c, emissiveIntensity: 0.28, roughness: 0.4, metalness: 0.2 }),
      edge: new THREE.LineBasicMaterial({ color: c })
    };
  });
  var orbGeo = new THREE.OctahedronGeometry(0.45);
  var orbMat = new THREE.MeshBasicMaterial({ color: 0x7ffcff });

  var LANES = [-5.2, -2.6, 0, 2.6, 5.2];
  var obstacles = [], orbs = [];

  function makeObstacle(x, z, w, h) {
    var c = obsMats[(Math.random() * obsMats.length) | 0];
    var g = new THREE.Group();
    var body = new THREE.Mesh(boxGeo, c.body);
    var edges = new THREE.LineSegments(edgeGeo, c.edge);
    g.add(body); g.add(edges);
    g.scale.set(w, h, 1.6);
    g.position.set(x, h / 2, z);
    scene.add(g);
    obstacles.push({ mesh: g, hw: w / 2, hd: 0.8, passed: false });
  }
  function makeOrb(x, z) {
    var g = new THREE.Group();
    var m = new THREE.Mesh(orbGeo, orbMat);
    var s = glowSprite(0x00f0ff, 2.6);
    g.add(m); g.add(s);
    g.position.set(x, 1, z);
    scene.add(g);
    orbs.push({ mesh: g, core: m, passed: false });
  }

  function spawnRow(z) {
    var lanes = LANES.slice();
    // shuffle
    for (var i = lanes.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = lanes[i]; lanes[i] = lanes[j]; lanes[j] = t; }
    var diff = Math.min(1, elapsed / 90);
    var count = 1 + ((Math.random() * (1.6 + diff * 2.2)) | 0); // 1..3 blocks (rarely 4)
    count = Math.min(count, 4);
    for (var k = 0; k < count; k++) {
      var wide = Math.random() < 0.18 + diff * 0.15;
      makeObstacle(lanes[k], z + (Math.random() - 0.5) * 2, wide ? 2.4 : 1.8, 1.2 + Math.random() * 2.2);
    }
    if (Math.random() < 0.65) makeOrb(lanes[count], z + (Math.random() < 0.5 ? 0 : -6));
  }

  /* ------------------------------------------------------------ particles */
  var PCOUNT = 260;
  var pGeo = new THREE.BufferGeometry();
  var pPos = new Float32Array(PCOUNT * 3);
  var pVel = new Float32Array(PCOUNT * 3);
  var pCol = new Float32Array(PCOUNT * 3);
  var pLife = new Float32Array(PCOUNT);
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  var pMat = new THREE.PointsMaterial({ size: 0.35, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  var points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);
  var pNext = 0;
  var tmpC = new THREE.Color();
  function burst(x, y, z, n, color, speed) {
    for (var i = 0; i < n; i++) {
      var k = pNext; pNext = (pNext + 1) % PCOUNT;
      pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z;
      var a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = speed * (0.3 + Math.random());
      pVel[k * 3] = Math.cos(a) * Math.cos(b) * s;
      pVel[k * 3 + 1] = Math.abs(Math.sin(b)) * s + 2;
      pVel[k * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
      tmpC.set(Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color);
      pCol[k * 3] = tmpC.r; pCol[k * 3 + 1] = tmpC.g; pCol[k * 3 + 2] = tmpC.b;
      pLife[k] = 0.6 + Math.random() * 0.8;
    }
  }
  function updateParticles(dt) {
    for (var k = 0; k < PCOUNT; k++) {
      if (pLife[k] <= 0) { pPos[k * 3 + 1] = -100; continue; }
      pLife[k] -= dt;
      pVel[k * 3 + 1] -= 14 * dt;
      pPos[k * 3] += pVel[k * 3] * dt;
      pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt;
      pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt;
      var f = Math.max(0, pLife[k]);
      pCol[k * 3] *= 0.985; pCol[k * 3 + 1] *= 0.985; pCol[k * 3 + 2] *= 0.985;
      if (f <= 0) pPos[k * 3 + 1] = -100;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- input */
  var keys = {}, touchDir = 0;
  window.addEventListener("keydown", function (e) { keys[e.key.toLowerCase()] = true; });
  window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; });
  var pointers = {};
  function updTouch() {
    var d = 0;
    for (var id in pointers) d += pointers[id];
    touchDir = Math.max(-1, Math.min(1, d));
  }
  window.addEventListener("pointerdown", function (e) { pointers[e.pointerId] = e.clientX < window.innerWidth / 2 ? -1 : 1; updTouch(); });
  window.addEventListener("pointermove", function (e) { if (pointers[e.pointerId] != null) { pointers[e.pointerId] = e.clientX < window.innerWidth / 2 ? -1 : 1; updTouch(); } });
  function up(e) { delete pointers[e.pointerId]; updTouch(); }
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);

  /* ---------------------------------------------------------------- state */
  var speedEl = document.querySelector("#speed b"), multEl = document.getElementById("mult");
  var speed = 28, elapsed = 0, dist = 0, nextRow = 40, vx = 0, alive = false, crashT = 0;
  var bonus = 0, streak = 0, mult = 1, shake = 0;

  function clearWorld() {
    obstacles.forEach(function (o) { scene.remove(o.mesh); });
    orbs.forEach(function (o) { scene.remove(o.mesh); });
    obstacles.length = 0; orbs.length = 0;
  }

  function reset() {
    clearWorld();
    speed = 30; elapsed = 0; dist = 0; nextRow = 50; vx = 0; bonus = 0; streak = 0; mult = 1;
    ship.position.x = 0; ship.visible = true; alive = true;
    multEl.textContent = "x1";
  }

  function setMult() {
    var m = 1 + Math.floor(streak / 4);
    if (m > 8) m = 8;
    if (m !== mult) {
      if (m > mult) { sfx.levelup(); A.popup("x" + m + " MULTIPLIER", window.innerWidth / 2, window.innerHeight * 0.35, "#00f0ff", 24); }
      mult = m;
      multEl.textContent = "x" + m;
      multEl.style.transform = "scale(1.4)";
      setTimeout(function () { multEl.style.transform = ""; }, 150);
    }
  }

  var proj = new THREE.Vector3();
  function screenPos(obj) {
    proj.setFromMatrixPosition(obj.matrixWorld).project(camera);
    return { x: (proj.x * 0.5 + 0.5) * window.innerWidth, y: (-proj.y * 0.5 + 0.5) * window.innerHeight };
  }

  function crash() {
    alive = false;
    crashT = 0;
    ship.visible = false;
    burst(ship.position.x, 0.8, ship.position.z, 180, [0x00f0ff, 0xff2a8a, 0xffffff, 0xffb000], 14);
    shake = 1;
    sfx.boom();
    setTimeout(function () { sfx.over(); }, 300);
    S.gameOver('<div class="ub-label" style="margin-top:10px">' + Math.floor(dist) + " m travelled</div>");
  }

  /* ----------------------------------------------------------------- loop */
  var t = 0;
  A.loop(function (dt) {
    if (S.paused) { renderer.render(scene, camera); return; }
    t += dt;
    var playing = S.playing && alive;
    var curSpeed = playing ? speed : (alive ? 26 : speed * Math.max(0, 1 - crashT * 1.5));
    if (!alive) crashT += dt;

    // scroll the world
    grid.position.z = (grid.position.z + curSpeed * dt) % CELL;
    for (var i = 0; i < pylons.length; i++) {
      var p = pylons[i];
      p.position.z += curSpeed * dt;
      if (p.position.z > 12) p.position.z -= 24 * 8;
    }

    if (playing) {
      elapsed += dt;
      speed = Math.min(95, 30 + elapsed * 0.75);
      dist += speed * dt;

      // steering
      var input = 0;
      if (keys["arrowleft"] || keys["a"]) input -= 1;
      if (keys["arrowright"] || keys["d"]) input += 1;
      input = Math.max(-1, Math.min(1, input + touchDir));
      var target = input * (14 + speed * 0.08);
      vx += (target - vx) * Math.min(1, dt * 10);
      ship.position.x += vx * dt;
      if (ship.position.x > 6) { ship.position.x = 6; vx = 0; }
      if (ship.position.x < -6) { ship.position.x = -6; vx = 0; }

      // spawn
      nextRow -= speed * dt;
      if (nextRow <= 0) {
        spawnRow(-170);
        nextRow = Math.max(15, 30 - elapsed * 0.12) + Math.random() * 8;
      }
    } else if (alive) {
      // attract mode: gentle weave
      ship.position.x = Math.sin(t * 0.9) * 3;
      vx = Math.cos(t * 0.9) * 2.7 * 3;
    }

    ship.rotation.z = -vx * 0.035;
    ship.rotation.y = -vx * 0.01;
    ship.position.y = 0.55 + Math.sin(t * 6) * 0.05;
    engine.scale.setScalar(1.2 + Math.random() * 0.5);

    // obstacles
    for (var j = obstacles.length - 1; j >= 0; j--) {
      var o = obstacles[j];
      o.mesh.position.z += curSpeed * dt;
      var dz = o.mesh.position.z - ship.position.z;
      var dx = Math.abs(o.mesh.position.x - ship.position.x);
      if (playing && Math.abs(dz) < o.hd + 1.0 && dx < o.hw + 0.95) { crash(); playing = false; }
      if (playing && !o.passed && dz > o.hd + 1.0) {
        o.passed = true;
        if (dx < o.hw + 1.7) {
          var b = 25 * mult;
          bonus += b;
          sfx.coin(1.5);
          var sp = screenPos(ship);
          A.popup("CLOSE! +" + b, sp.x, sp.y - 60, "#ffb000");
        }
      }
      if (o.mesh.position.z > 15) { scene.remove(o.mesh); obstacles.splice(j, 1); }
    }

    // orbs
    for (var k = orbs.length - 1; k >= 0; k--) {
      var orb = orbs[k];
      orb.mesh.position.z += curSpeed * dt;
      orb.core.rotation.y += dt * 3;
      orb.mesh.position.y = 1 + Math.sin(t * 4 + k) * 0.2;
      var odz = orb.mesh.position.z - ship.position.z;
      if (playing && Math.abs(odz) < 1.2 && Math.abs(orb.mesh.position.x - ship.position.x) < 1.4) {
        streak++;
        var v = 50 * mult;
        bonus += v;
        sfx.coin(1 + Math.min(streak, 12) * 0.05);
        burst(orb.mesh.position.x, 1, orb.mesh.position.z, 24, [0x00f0ff, 0xffffff], 6);
        var spo = screenPos(orb.mesh);
        A.popup("+" + v, spo.x, spo.y - 30, "#7ffcff");
        scene.remove(orb.mesh); orbs.splice(k, 1);
        setMult();
        continue;
      }
      if (playing && !orb.passed && odz > 2) { orb.passed = true; streak = 0; setMult(); }
      if (orb.mesh.position.z > 15) { scene.remove(orb.mesh); orbs.splice(k, 1); }
    }

    if (S.playing) {
      S.setScore(Math.floor(dist * 0.5) * 1 + bonus);
    }
    speedEl.textContent = Math.round(curSpeed * 6.2);

    updateParticles(dt);

    // camera
    var cx = ship.position.x * 0.55;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 5);
    camera.fov = 66 + Math.max(0, curSpeed - 30) * 0.22;
    camera.updateProjectionMatrix();
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 1.6);
      camera.position.x += (Math.random() - 0.5) * shake * 0.8;
      camera.position.y = 3.2 + (Math.random() - 0.5) * shake * 0.8;
    } else camera.position.y = 3.2;
    camera.lookAt(ship.position.x * 0.7, 1.2, -12);

    sunGlow.material.opacity = 0.5 + Math.sin(t * 1.5) * 0.06;
    renderer.render(scene, camera);
  });

  // after a crash, reset the scene when the overlay is back so attract mode looks right
  setInterval(function () {
    if (!S.playing && !alive && crashT > 1.6) { clearWorld(); ship.visible = true; alive = true; ship.position.x = 0; }
  }, 300);
})();
