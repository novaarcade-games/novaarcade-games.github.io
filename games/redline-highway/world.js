/* Redline Highway — environments. Two themes share one interface:
 *   RL.buildWorld(scene, renderer, mode, twoWay) -> { T, scroll(d), sparkColors, ... } */
(function () {
  "use strict";
  var RL = (window.RL = window.RL || {});
  var ROAD_HALF = 9.7, TILE = 24, SPAN = 1120, BACK = 70;
  RL.ROAD_LIMIT = 9.05;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function canvasTex(w, h, draw, srgb) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ----------------------------------------------------------- textures */
  function roadTex(twoWay, neon, aniso) {
    var t = canvasTex(1024, 1024, function (g, w, h) {
      var px = w / (ROAD_HALF * 2), py = h / TILE;
      function X(m) { return (m + ROAD_HALF) * px; }
      g.fillStyle = neon ? "#0a0318" : "#39393b";
      g.fillRect(0, 0, w, h);
      var i;
      if (!neon) {
        // aggregate speckle
        for (i = 0; i < 52000; i++) {
          var v = Math.random();
          g.fillStyle = v < 0.5 ? "rgba(0,0,0," + rnd(0.05, 0.22) + ")" : "rgba(255,255,255," + rnd(0.03, 0.12) + ")";
          g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 2.5), rnd(1, 2.5));
        }
        // shoulders: lighter, rougher
        g.fillStyle = "rgba(150,145,135,0.16)";
        g.fillRect(0, 0, X(-7.4), h); g.fillRect(X(7.4), 0, w, h);
        // tyre wear tracks in every lane
        [-5.4, -1.8, 1.8, 5.4].forEach(function (c) {
          [-0.8, 0.8].forEach(function (o) {
            var gr = g.createLinearGradient(X(c + o - 0.45), 0, X(c + o + 0.45), 0);
            gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(0,0,0,0.2)"); gr.addColorStop(1, "rgba(0,0,0,0)");
            g.fillStyle = gr; g.fillRect(X(c + o - 0.45), 0, 0.9 * px, h);
          });
        });
        // seams + tar repairs (kept faint, the tile repeats)
        g.strokeStyle = "rgba(20,20,22,0.35)"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, h * 0.5); g.lineTo(w, h * 0.5 + 4); g.stroke();
        for (i = 0; i < 5; i++) {
          g.beginPath();
          var cx = rnd(X(-7), X(7)), cy = Math.random() * h;
          g.moveTo(cx, cy);
          for (var k = 0; k < 6; k++) { cx += rnd(-14, 14); cy += rnd(10, 30); g.lineTo(cx, cy); }
          g.stroke();
        }
      }
      function line(xm, wm, color, dashed) {
        g.fillStyle = color;
        if (neon) { g.shadowColor = color; g.shadowBlur = 14; }
        if (dashed) { g.fillRect(X(xm - wm / 2), 0, wm * px, 3 * py); g.fillRect(X(xm - wm / 2), 12 * py, wm * px, 3 * py); }
        else g.fillRect(X(xm - wm / 2), 0, wm * px, h);
        g.shadowBlur = 0;
      }
      var white = neon ? "#ff2a8a" : "rgba(236,236,230,0.92)", edge = neon ? "#00f0ff" : "rgba(236,236,230,0.92)", yellow = neon ? "#ffd23f" : "rgba(235,178,40,0.95)";
      line(-7.25, 0.16, edge); line(7.25, 0.16, edge);
      line(-3.6, 0.15, white, true); line(3.6, 0.15, white, true);
      if (twoWay) { line(-0.16, 0.13, yellow); line(0.16, 0.13, yellow); }
      else line(0, 0.15, white, true);
      if (!neon) {
        // scuff the paint a little
        for (i = 0; i < 9000; i++) { g.fillStyle = "rgba(57,57,59," + rnd(0.2, 0.6) + ")"; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      }
    });
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, (SPAN + BACK + 80) / TILE);
    t.anisotropy = aniso;
    return t;
  }

  function grassTex(aniso) {
    var t = canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = "#57703a"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 26000; i++) {
        var r = Math.random();
        g.fillStyle = r < 0.4 ? "rgba(40,62,26,0.35)" : r < 0.8 ? "rgba(120,150,70,0.3)" : "rgba(170,160,90,0.25)";
        g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 3), rnd(2, 6));
      }
      for (i = 0; i < 14; i++) {
        var x = Math.random() * w, y = Math.random() * h, rr = rnd(30, 90);
        var gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, i % 2 ? "rgba(150,140,80,0.22)" : "rgba(40,70,30,0.25)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  }

  function skyTex(sunDir) {
    var t = canvasTex(2048, 1024, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#1a55ad"); gr.addColorStop(0.3, "#4a8bd4"); gr.addColorStop(0.44, "#9cc4ea");
      gr.addColorStop(0.5, "#d9e7f1"); gr.addColorStop(0.52, "#b9c7c6"); gr.addColorStop(0.6, "#7d8c74"); gr.addColorStop(1, "#5b6b4a");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // sun
      var u = Math.atan2(sunDir.z, sunDir.x) / (Math.PI * 2) + 0.5, v = Math.asin(sunDir.y) / Math.PI + 0.5;
      var sx = u * w, sy = (1 - v) * h;
      g.globalCompositeOperation = "lighter";
      [[420, "rgba(255,225,170,0.25)"], [170, "rgba(255,236,200,0.55)"], [46, "rgba(255,255,245,1)"]].forEach(function (s) {
        for (var k = -1; k <= 1; k++) {
          var rg = g.createRadialGradient(sx + k * w, sy, 0, sx + k * w, sy, s[0]);
          rg.addColorStop(0, s[1]); rg.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = rg; g.fillRect(sx + k * w - s[0], sy - s[0], s[0] * 2, s[0] * 2);
        }
      });
      g.globalCompositeOperation = "source-over";
      // clouds: soft clusters, flatter near the horizon
      for (var i = 0; i < 46; i++) {
        var cy = rnd(h * 0.16, h * 0.47), cx = Math.random() * w, sc = 0.5 + (cy / (h * 0.5)) * 0.2, n = 6 + ((Math.random() * 8) | 0);
        var flat = 1 - (cy / (h * 0.5)) * 0.6;
        for (var k2 = 0; k2 < n; k2++) {
          var ox = rnd(-110, 110) * sc, oy = rnd(-14, 14) * flat, rx = rnd(50, 130) * sc, ry = rnd(16, 40) * flat;
          g.save();
          g.translate(cx + ox, cy + oy); g.scale(rx, ry);
          var cg = g.createRadialGradient(0, -0.15, 0, 0, 0, 1);
          cg.addColorStop(0, "rgba(255,255,255," + rnd(0.22, 0.5) + ")"); cg.addColorStop(0.55, "rgba(245,248,252,0.14)"); cg.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = cg; g.fillRect(-1, -1, 2, 2);
          g.restore();
        }
      }
    });
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  }

  function capTex(neon) {
    return canvasTex(128, 128, function (g) {
      g.fillStyle = "#0c0c0d"; g.fillRect(0, 0, 128, 128);
      g.translate(64, 64);
      if (neon) {
        g.strokeStyle = "#00f0ff"; g.lineWidth = 5; g.shadowColor = "#00f0ff"; g.shadowBlur = 10;
        g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(-40, 0); g.lineTo(40, 0); g.moveTo(0, -40); g.lineTo(0, 40); g.stroke();
        return;
      }
      g.fillStyle = "#161617"; g.beginPath(); g.arc(0, 0, 62, 0, Math.PI * 2); g.fill();
      var rg = g.createRadialGradient(-10, -10, 4, 0, 0, 44);
      rg.addColorStop(0, "#e8eaee"); rg.addColorStop(1, "#8b9098");
      g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 43, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#17181a";
      for (var i = 0; i < 5; i++) {
        g.rotate(Math.PI * 2 / 5);
        g.beginPath(); g.moveTo(7, 12); g.lineTo(22, 38); g.arc(0, 0, 38, 1.05, 0.52, true); g.lineTo(14, 9); g.closePath(); g.fill();
      }
      g.fillStyle = "#3a3d42"; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
    });
  }

  function signTex(lines, arrow) {
    return canvasTex(512, 256, function (g, w, h) {
      g.fillStyle = "#0d6b3c"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#fff"; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "700 58px Arial, Helvetica, sans-serif";
      g.fillText(lines[0], w / 2, 92);
      g.font = "700 44px Arial, Helvetica, sans-serif";
      g.fillText(lines[1], w / 2, 160);
      g.font = "700 50px Arial, Helvetica, sans-serif";
      g.fillText(arrow, w / 2, 226);
    });
  }

  /* ------------------------------------------------------------ scatter */
  // Instanced props that scroll toward the camera and wrap around.
  function Scatter(geo, mat, items, span, shadows) {
    this.items = items; this.span = span;
    this.mesh = new THREE.InstancedMesh(geo, mat, items.length);
    this.mesh.frustumCulled = false;
    if (shadows) this.mesh.castShadow = true;
    this.d = new THREE.Object3D();
    for (var i = 0; i < items.length; i++) if (items[i].color) this.mesh.setColorAt(i, items[i].color);
    this.scroll(0);
  }
  Scatter.prototype.scroll = function (dz) {
    var d = this.d, it;
    for (var i = 0; i < this.items.length; i++) {
      it = this.items[i];
      it.z += dz;
      if (it.z > BACK) it.z -= this.span; else if (it.z < BACK - this.span) it.z += this.span;
      d.position.set(it.x, it.y, it.z);
      d.rotation.set(it.rx || 0, it.ry || 0, 0);
      d.scale.set(it.sx || 1, it.sy || 1, it.sz || 1);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  };

  /* ---------------------------------------------------------- materials */
  function realMats(renderer) {
    var paints = {}, cap = capTex(false);
    return {
      neon: false, shadows: true,
      paint: function (color, isPlayer) {
        var k = color + (isPlayer ? "p" : "");
        return paints[k] || (paints[k] = new THREE.MeshPhysicalMaterial({
          color: color, metalness: isPlayer ? 0.45 : 0.35, roughness: isPlayer ? 0.3 : 0.42, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.85
        }));
      },
      cargo: function () { return paints.cargo || (paints.cargo = new THREE.MeshStandardMaterial({ color: 0xe9e9e6, roughness: 0.55, metalness: 0.1 })); },
      glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1118, metalness: 0.9, roughness: 0.06, envMapIntensity: 1.5 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x121213, roughness: 0.92 }),
      cap: new THREE.MeshStandardMaterial({ map: cap, roughness: 0.4, metalness: 0.5 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x0f0f11, roughness: 0.6, metalness: 0.3 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.15, metalness: 1 }),
      head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 1.6, roughness: 0.2 }),
      tail: new THREE.MeshStandardMaterial({ color: 0x8a0000, emissive: 0xff1a10, emissiveIntensity: 1.1, roughness: 0.3 }),
      amber: new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff9000, emissiveIntensity: 3 }),
      plate: new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.6 }),
      edge: function () { return null; },
      colors: [0xc9cace, 0x17171a, 0xf1f1ee, 0x8a1818, 0x1d3a72, 0x5b6068, 0x2c4a33, 0xb39a6c, 0x3d5f8f],
      playerColor: 0xd41a08
    };
  }
  function neonMats() {
    var paints = {}, edges = {};
    return {
      neon: true, shadows: false,
      paint: function (color) {
        return paints[color] || (paints[color] = new THREE.MeshStandardMaterial({ color: 0x0c0420, emissive: color, emissiveIntensity: 0.16, roughness: 0.45, metalness: 0.4 }));
      },
      cargo: function (color) { return this.paint(color); },
      glass: new THREE.MeshStandardMaterial({ color: 0x05020c, roughness: 0.2, metalness: 0.6 }),
      tire: new THREE.MeshBasicMaterial({ color: 0x08040f }),
      cap: new THREE.MeshBasicMaterial({ map: capTex(true) }),
      dark: new THREE.MeshBasicMaterial({ color: 0x08040f }),
      chrome: new THREE.MeshBasicMaterial({ color: 0xff2a8a }),
      head: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      tail: new THREE.MeshBasicMaterial({ color: 0xff2a4a }),
      amber: new THREE.MeshBasicMaterial({ color: 0xffb000 }),
      edge: function (color) { return edges[color] || (edges[color] = new THREE.LineBasicMaterial({ color: color })); },
      colors: [0xff2a8a, 0xffb000, 0xb300ff, 0x7cff6b, 0xff7a2f, 0xff2a8a],
      playerColor: 0x00f0ff
    };
  }

  /* -------------------------------------------------------------- real */
  function buildReal(scene, renderer, twoWay) {
    var aniso = renderer.capabilities.getMaxAnisotropy();
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var sunDir = new THREE.Vector3(-0.52, 0.42, -0.74).normalize();
    var sky = skyTex(sunDir);
    scene.background = sky;
    var pm = new THREE.PMREMGenerator(renderer);
    var envRT = pm.fromEquirectangular(sky);
    pm.dispose();
    scene.environment = envRT.texture;
    scene.fog = new THREE.Fog(0xcfdde8, 140, 1050);

    scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x6b6a4a, 0.55));
    var sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera;
    sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 10; sc.far = 280;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    sun.target.position.set(0, 0, -22);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 130);
    scene.add(sun); scene.add(sun.target);

    var len = SPAN + BACK + 80, zc = BACK + 40 - len / 2;
    var rTex = roadTex(twoWay, false, aniso);
    var road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, len), new THREE.MeshStandardMaterial({ map: rTex, roughness: 0.88, metalness: 0.02, envMapIntensity: 0.5 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, zc); road.receiveShadow = true;
    scene.add(road);

    var gTex = grassTex(aniso);
    gTex.repeat.set(2600 / 22, len / 22);
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, len), new THREE.MeshStandardMaterial({ map: gTex, roughness: 1, envMapIntensity: 0.25 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.03, zc); ground.receiveShadow = true;
    scene.add(ground);

    // guardrails
    var railMat = new THREE.MeshStandardMaterial({ color: 0xb9bdc2, metalness: 0.85, roughness: 0.38 });
    [-1, 1].forEach(function (sd) {
      var r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, len), railMat);
      r.position.set(sd * 9.5, 0.62, zc); r.castShadow = true;
      scene.add(r);
    });
    var posts = [];
    for (var z = BACK; z > BACK - 360; z -= 4) { posts.push({ x: -9.56, y: 0.38, z: z }); posts.push({ x: 9.56, y: 0.38, z: z }); }
    var postS = new Scatter(new THREE.BoxGeometry(0.1, 0.76, 0.12), new THREE.MeshStandardMaterial({ color: 0x8d9196, metalness: 0.7, roughness: 0.5 }), posts, 360, false);
    scene.add(postS.mesh);

    // trees
    var trunks = [], leaves = [], pines = [], i;
    for (i = 0; i < 250; i++) {
      var sd = Math.random() < 0.5 ? -1 : 1, x = sd * (14 + Math.pow(Math.random(), 1.6) * 130), tz = BACK - Math.random() * SPAN, s = rnd(0.75, 1.5);
      var pine = Math.random() < 0.45;
      trunks.push({ x: x, y: 1.4 * s, z: tz, sx: s, sy: s, sz: s });
      var col = new THREE.Color().setHSL(rnd(0.24, 0.33), rnd(0.35, 0.55), rnd(0.2, 0.3));
      if (pine) pines.push({ x: x, y: 5.2 * s, z: tz, sx: s, sy: s, sz: s, ry: Math.random() * 6, color: col });
      else leaves.push({ x: x, y: 4.6 * s, z: tz, sx: s * rnd(0.9, 1.2), sy: s * rnd(0.9, 1.25), sz: s * rnd(0.9, 1.2), ry: Math.random() * 6, color: col });
    }
    var blob = new THREE.IcosahedronGeometry(2.4, 1), bp = blob.attributes.position;
    for (i = 0; i < bp.count; i++) { var f = 1 + (Math.sin(bp.getX(i) * 3.1) * Math.cos(bp.getZ(i) * 2.7) + Math.sin(bp.getY(i) * 4.3)) * 0.09; bp.setXYZ(i, bp.getX(i) * f, bp.getY(i) * f * 1.1, bp.getZ(i) * f); }
    blob.computeVertexNormals();
    var leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true, envMapIntensity: 0.3 });
    var scat = [
      postS,
      new Scatter(new THREE.CylinderGeometry(0.16, 0.26, 2.8, 7), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 }), trunks, SPAN, true),
      new Scatter(blob, leafMat, leaves, SPAN, true),
      new Scatter(new THREE.ConeGeometry(2.1, 7.6, 8), leafMat, pines, SPAN, true)
    ];

    // street lights
    var poles = [], arms = [], lamps = [];
    for (z = BACK; z > BACK - 1080; z -= 60) {
      poles.push({ x: 10.7, y: 4.5, z: z }); arms.push({ x: 9.6, y: 9, z: z }); lamps.push({ x: 8.6, y: 8.92, z: z });
    }
    var metal = new THREE.MeshStandardMaterial({ color: 0x7c8187, metalness: 0.8, roughness: 0.45 });
    scat.push(new Scatter(new THREE.CylinderGeometry(0.09, 0.13, 9, 8), metal, poles, 1080, true));
    scat.push(new Scatter(new THREE.BoxGeometry(2.3, 0.1, 0.12), metal, arms, 1080, false));
    scat.push(new Scatter(new THREE.BoxGeometry(0.7, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.3 }), lamps, 1080, false));
    for (i = 1; i < scat.length; i++) scene.add(scat[i].mesh);

    // overhead sign gantry
    var gantry = new THREE.Group();
    [-10.6, 10.6].forEach(function (x) {
      var p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 7.4, 10), metal);
      p.position.set(x, 3.7, 0); p.castShadow = true; gantry.add(p);
    });
    var beam = new THREE.Mesh(new THREE.BoxGeometry(21.6, 0.5, 0.4), metal);
    beam.position.y = 7.3; beam.castShadow = true; gantry.add(beam);
    [[twoWay ? 3.6 : -3.6, ["NOVA CITY", "12 km", "↓      ↓"]], [twoWay ? 3.6 : 3.6, ["EXIT 27", "Harbor Rd", "↘"]]].forEach(function (s, k) {
      if (twoWay && k === 0) return;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.1), new THREE.MeshStandardMaterial({ map: signTex(s[1], s[1][2]), roughness: 0.6 }));
      m.position.set(s[0], 6.6, 0.22); gantry.add(m);
      var bk = new THREE.Mesh(new THREE.BoxGeometry(6.3, 3.2, 0.08), metal);
      bk.position.set(s[0], 6.6, 0.16); bk.castShadow = true; gantry.add(bk);
    });
    gantry.position.z = -520;
    scene.add(gantry);

    // hazy hills on the horizon
    var hillMat = new THREE.MeshStandardMaterial({ color: 0x4f6b4a, roughness: 1, flatShading: true, envMapIntensity: 0.2 });
    for (i = 0; i < 22; i++) {
      var hr = rnd(150, 290), hh = rnd(45, 120);
      var hm = new THREE.Mesh(new THREE.ConeGeometry(hr, hh, 9, 2), hillMat);
      var side = i % 2 ? 1 : -1;
      hm.position.set(side * rnd(640, 1150), hh / 2 - 6, rnd(-1000, 60));
      hm.scale.z = rnd(1, 1.7);
      scene.add(hm);
    }

    return {
      T: realMats(renderer), neon: false, baseFov: 56,
      sparkColors: [0xffc04a, 0xff8a1e, 0xffe9a8], smokeColor: 0x2a2a2c, flameColor: 0x58b8ff,
      scroll: function (d) {
        rTex.offset.y = (rTex.offset.y + d / TILE) % 1;
        gTex.offset.y = (gTex.offset.y + d / 22) % 1;
        for (var k = 0; k < scat.length; k++) scat[k].scroll(d);
        gantry.position.z += d;
        if (gantry.position.z > BACK) gantry.position.z -= SPAN + 500;
      },
      dispose: function () { envRT.dispose(); }
    };
  }

  /* -------------------------------------------------------------- neon */
  function buildNeon(scene, renderer, twoWay) {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = false;
    scene.background = new THREE.Color(0x0b0120);
    scene.environment = null;
    scene.fog = new THREE.Fog(0x14022e, 60, 620);
    scene.add(new THREE.HemisphereLight(0xff66cc, 0x220044, 1.6));
    var dl = new THREE.DirectionalLight(0xffffff, 1.2);
    dl.position.set(3, 10, 6); scene.add(dl);

    var skyT = canvasTex(4, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#05000f"); gr.addColorStop(0.45, "#2a0450"); gr.addColorStop(0.75, "#7a0f6e"); gr.addColorStop(1, "#ff3d81");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    var sky = new THREE.Mesh(new THREE.PlaneGeometry(9000, 700), new THREE.MeshBasicMaterial({ map: skyT, fog: false, depthWrite: false }));
    sky.position.set(0, 190, -900); scene.add(sky);
    var n = 600, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 2400; pos[i * 3 + 1] = 120 + Math.random() * 420; pos[i * 3 + 2] = -890; }
    var sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 3, fog: false, transparent: true, opacity: 0.85 })));
    var sunT = canvasTex(256, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#ffe76a"); gr.addColorStop(0.5, "#ff8a3d"); gr.addColorStop(1, "#ff2a8a");
      g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = "destination-out";
      for (var k = 0; k < 9; k++) g.fillRect(0, h * 0.52 + k * k * 1.6 + k * 9, w, 2 + k * 1.3);
    });
    var sun = new THREE.Mesh(new THREE.PlaneGeometry(330, 330), new THREE.MeshBasicMaterial({ map: sunT, transparent: true, fog: false, depthWrite: false }));
    sun.position.set(0, 78, -880); scene.add(sun);

    var len = SPAN + BACK + 80, zc = BACK + 40 - len / 2;
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(2600, len), new THREE.MeshBasicMaterial({ color: 0x090016 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.05, zc); scene.add(floor);
    var grid = new THREE.GridHelper(1200, 150, 0xff2a8a, 0x8a00d4);
    grid.material.transparent = true; grid.material.opacity = 0.6; grid.position.set(0, -0.03, -400);
    scene.add(grid);
    var rTex = roadTex(twoWay, true, renderer.capabilities.getMaxAnisotropy());
    var road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, len), new THREE.MeshBasicMaterial({ map: rTex }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, zc); scene.add(road);
    [-1, 1].forEach(function (sd) {
      var r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, len), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
      r.position.set(sd * 9.5, 0.6, zc); scene.add(r);
    });
    var py = [];
    for (var z = BACK; z > BACK - 1080; z -= 30) { py.push({ x: -10.4, y: 2, z: z }); py.push({ x: 10.4, y: 2, z: z }); }
    var pyl = new Scatter(new THREE.BoxGeometry(0.4, 4, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2a8a }), py, 1080, false);
    scene.add(pyl.mesh);
    [-1, 1].forEach(function (sd) {
      var geo = new THREE.PlaneGeometry(420, 1100, 30, 70), p = geo.attributes.position;
      for (var k = 0; k < p.count; k++) { var e = (p.getX(k) + 210) / 420; p.setZ(k, Math.pow(e, 1.4) * (20 + Math.random() * 70)); }
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x9d00ff, wireframe: true, transparent: true, opacity: 0.4 }));
      m.rotation.x = -Math.PI / 2; if (sd < 0) m.rotation.z = Math.PI;
      m.position.set(sd * 250, 0, -470); scene.add(m);
    });

    return {
      T: neonMats(), neon: true, baseFov: 60,
      sparkColors: [0x00f0ff, 0xff2a8a, 0xffffff], smokeColor: 0xb300ff, flameColor: 0xff2a8a,
      scroll: function (d) {
        rTex.offset.y = (rTex.offset.y + d / TILE) % 1;
        grid.position.z = -400 + ((grid.position.z + 400 + d) % 8);
        pyl.scroll(d);
      },
      dispose: function () { }
    };
  }

  RL.buildWorld = function (scene, renderer, mode, twoWay) {
    return mode === "neon" ? buildNeon(scene, renderer, twoWay) : buildReal(scene, renderer, twoWay);
  };
})();
