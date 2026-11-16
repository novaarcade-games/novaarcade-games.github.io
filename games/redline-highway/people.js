/* Redline Highway — pedestrians, cyclists and motorbike riders, built from primitives.
 * A person has pivoted legs, arms and upper body so it can walk, pedal or sit. */
(function () {
  "use strict";
  var RL = (window.RL = window.RL || {});
  var G = null;

  function geos() {
    if (G) return G;
    G = {
      leg: new THREE.CapsuleGeometry(0.075, 0.62, 4, 8),
      arm: new THREE.CapsuleGeometry(0.055, 0.5, 4, 8),
      torso: new THREE.CapsuleGeometry(0.17, 0.34, 4, 10),
      head: new THREE.SphereGeometry(0.12, 12, 10),
      helmet: new THREE.SphereGeometry(0.155, 12, 10),
      wheel: new THREE.TorusGeometry(0.33, 0.028, 8, 24),
      mwheel: new THREE.CylinderGeometry(0.31, 0.31, 0.15, 18),
      box: new THREE.BoxGeometry(1, 1, 1),
      lamp: new THREE.SphereGeometry(0.09, 10, 8)
    };
    G.leg.translate(0, -0.385, 0);   // pivot at the hip
    G.arm.translate(0, -0.305, 0);   // pivot at the shoulder
    G.wheel.rotateY(Math.PI / 2);
    G.mwheel.rotateZ(Math.PI / 2);
    return G;
  }
  RL.disposePeopleCache = function () {
    if (G) for (var k in G) G[k].dispose();
    G = null;
  };

  // flat-ish cloth/skin materials, cached on the theme object
  function mat(T, color) {
    var c = T._pm || (T._pm = {});
    return c[color] || (c[color] = T.neon ? new THREE.MeshBasicMaterial({ color: color }) : new THREE.MeshStandardMaterial({ color: color, roughness: 0.85, envMapIntensity: 0.4 }));
  }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  var SHIRT = [0xe84a3a, 0x2f7fd8, 0xf2c230, 0x3aa856, 0xf08a24, 0xf2f2f2, 0xd84a9a, 0xc8ff2a];
  var PANTS = [0x23283a, 0x3a3f4a, 0x1a1a1a, 0x5a4a3a, 0x2a3a5a];
  var SKIN = [0xf1c9a5, 0xd9a37a, 0xa9744f, 0x70482f];
  var NEON = [0xff2a8a, 0xffb000, 0x7cff6b, 0x00f0ff, 0xff7a2f];

  /** returns { group, upper, legs:[L,R], arms:[L,R] } — origin at the feet, facing -Z */
  RL.makePerson = function (T, helmet) {
    var g = geos(), root = new THREE.Group(), upper = new THREE.Group();
    var shirt = mat(T, T.neon ? pick(NEON) : pick(SHIRT)), pants = mat(T, T.neon ? 0x8a00d4 : pick(PANTS)), skin = mat(T, T.neon ? 0xffffff : pick(SKIN));
    function m(geo, material, parent, x, y, z) {
      var o = new THREE.Mesh(geo, material);
      o.position.set(x, y, z);
      if (T.shadows) o.castShadow = true;
      parent.add(o);
      return o;
    }
    var legs = [m(g.leg, pants, root, -0.1, 0.88, 0), m(g.leg, pants, root, 0.1, 0.88, 0)];
    upper.position.y = 0.88;
    root.add(upper);
    m(g.torso, shirt, upper, 0, 0.34, 0);
    if (helmet) m(g.helmet, mat(T, T.neon ? 0x00f0ff : pick([0x111111, 0xd8d8d8, 0xb81818])), upper, 0, 0.76, 0);
    else m(g.head, skin, upper, 0, 0.75, 0);
    var arms = [m(g.arm, shirt, upper, -0.25, 0.57, 0), m(g.arm, shirt, upper, 0.25, 0.57, 0)];
    return { group: root, upper: upper, legs: legs, arms: arms };
  };

  /** bicycle or motorbike with a rider. returns { group, rider, moto } — facing -Z */
  RL.makeBike = function (T, moto) {
    var g = geos(), root = new THREE.Group();
    var color = T.neon ? pick(NEON) : pick([0xc81e1e, 0x1e5ac8, 0x111111, 0xe8e8e8, 0x1e9a4a, 0xf0a010]);
    var paint = T.paint(color), frame = mat(T, T.neon ? color : 0x2a2d33);
    function bx(w, h, l, material, x, y, z, rx) {
      var o = new THREE.Mesh(g.box, material);
      o.scale.set(w, h, l); o.position.set(x, y, z);
      if (rx) o.rotation.x = rx;
      if (T.shadows) o.castShadow = true;
      root.add(o);
      return o;
    }
    function wheel(geo, material, y, z) {
      var o = new THREE.Mesh(geo, material);
      o.position.set(0, y, z);
      if (T.shadows) o.castShadow = true;
      root.add(o);
    }
    var rider = RL.makePerson(T, true);
    root.add(rider.group);
    if (moto) {
      wheel(g.mwheel, T.tire, 0.31, -0.72); wheel(g.mwheel, T.tire, 0.31, 0.7);
      bx(0.34, 0.34, 1.0, paint, 0, 0.62, 0);
      bx(0.36, 0.2, 0.5, paint, 0, 0.84, -0.2);
      bx(0.3, 0.1, 0.6, T.dark, 0, 0.82, 0.35);
      bx(0.2, 0.62, 0.06, T.dark, 0, 0.6, -0.66, -0.35);
      bx(0.6, 0.04, 0.04, T.dark, 0, 1.0, -0.52);
      bx(0.08, 0.08, 0.62, T.chrome, 0.2, 0.4, 0.42);
      bx(0.2, 0.06, 0.04, T.tail, 0, 0.8, 0.68);
      var hl = new THREE.Mesh(g.lamp, T.head); hl.position.set(0, 0.86, -0.8); root.add(hl);
      rider.group.position.set(0, 0, 0.3);
      rider.upper.rotation.x = -0.5;
      rider.arms[0].rotation.x = rider.arms[1].rotation.x = 1.25;
      rider.legs[0].rotation.x = rider.legs[1].rotation.x = 0.95;
      rider.legs[0].position.x = -0.2; rider.legs[1].position.x = 0.2;
    } else {
      wheel(g.wheel, frame, 0.33, -0.52); wheel(g.wheel, frame, 0.33, 0.52);
      bx(0.04, 0.04, 0.6, paint, 0, 0.82, -0.08);
      bx(0.04, 0.04, 0.66, paint, 0, 0.58, -0.1, 0.72);
      bx(0.04, 0.52, 0.04, paint, 0, 0.68, 0.2);
      bx(0.04, 0.04, 0.5, paint, 0, 0.36, 0.36);
      bx(0.14, 0.05, 0.24, T.dark, 0, 0.95, 0.2);
      bx(0.04, 0.64, 0.04, paint, 0, 0.64, -0.46, -0.3);
      bx(0.46, 0.035, 0.035, T.dark, 0, 0.98, -0.4);
      rider.group.position.set(0, 0.07, 0.18);
      rider.upper.rotation.x = -0.6;
      rider.arms[0].rotation.x = rider.arms[1].rotation.x = 1.3;
    }
    return { group: root, rider: rider, moto: !!moto };
  };
})();
