/* Game catalogue — add a new entry here and drop the game in games/<id>/ */
window.GAMES = [
  {
    id: "neon-drift", title: "Neon Drift", is3d: true, featured: true, isNew: true,
    tagline: "Thread a synthwave highway at 500 km/h.",
    desc: "A 3D speed run through a retro-future grid. Weave between neon blocks, chain orbs for a score multiplier and skim obstacles for close-call bonuses as the road keeps getting faster.",
    cats: ["3d", "action", "racing"], color: "#ff2a8a", controls: "← → / tap sides"
  },
  {
    id: "void-swarm", title: "Void Swarm", featured: true, isNew: true,
    tagline: "One ship. Ten thousand enemies. Infinite upgrades.",
    desc: "Survive a swarm that never stops. Your guns fire on their own — you dodge, grab crystals and stack upgrades like orbit blades, nova pulses and split barrels until your ship is a storm.",
    cats: ["action", "shooter"], color: "#00f0ff", controls: "WASD / drag"
  },
  {
    id: "skyline-stack", title: "Skyline Stack", is3d: true, featured: true,
    tagline: "How high can your tower go?",
    desc: "A 3D timing game. Drop each sliding floor onto the tower — whatever hangs over gets sliced off. Nail perfect drops to build combos and win back width.",
    cats: ["3d", "one-tap", "casual"], color: "#ff9f43", controls: "Tap / Space"
  },
  {
    id: "block-blitz", title: "Block Blitz", featured: true,
    tagline: "Fill the lines. Chase the combo.",
    desc: "A relaxing-then-not-so-relaxing block puzzle. Drag pieces onto an 8×8 board and blast full rows and columns. Chain clears turn after turn for massive combo scores.",
    cats: ["puzzle", "casual"], color: "#b14bff", controls: "Drag & drop"
  },
  {
    id: "orbit-hop", title: "Orbit Hop",
    tagline: "Slingshot from planet to planet.",
    desc: "Time your launch off each orbit and fly straight into the next planet's gravity. Moving planets, star pickups and quick-launch bonuses make every run a little more frantic.",
    cats: ["one-tap", "casual"], color: "#7c5cff", controls: "Tap / Space"
  },
  {
    id: "gravity-flip", title: "Gravity Flip",
    tagline: "Floor or ceiling? Decide fast.",
    desc: "A one-button runner. Flip gravity to dodge spikes and gaps as the corridor speeds up. Snag orbs in mid-flip for bonus points.",
    cats: ["one-tap", "action"], color: "#00e5ff", controls: "Tap / Space"
  },
  {
    id: "pulse-breaker", title: "Pulse Breaker",
    tagline: "Smash bricks. Catch power-ups. Repeat.",
    desc: "Neon brick-breaking with endless procedural levels. Catch multi-ball, wide paddle, fireball and extra lives — then watch the screen explode.",
    cats: ["arcade", "action"], color: "#ffd23f", controls: "Mouse / ← →"
  },
  {
    id: "glow-serpent", title: "Glow Serpent",
    tagline: "The classic grow-and-dodge, in neon.",
    desc: "Smooth, glowing snake with golden bonus orbs and a speed that ramps as you grow. Easy to learn, hard to put down.",
    cats: ["arcade", "casual"], color: "#7cff6b", controls: "Arrows / swipe"
  }
];

window.CATEGORIES = [
  { id: "all", label: "All games" },
  { id: "3d", label: "3D" },
  { id: "action", label: "Action" },
  { id: "one-tap", label: "One-tap" },
  { id: "puzzle", label: "Puzzle" },
  { id: "arcade", label: "Arcade" },
  { id: "casual", label: "Casual" }
];
