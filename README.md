# Nova Arcade

A fast, good-looking browser game site. Every game is made for it, runs fully in the browser, and needs no build step, no install and no account.

## Games

| Game | Type | Controls |
|---|---|---|
| **Redline Highway** | 3D highway traffic racer (three.js): realistic or neon look, one-way or two-way traffic, nitro, crash physics | ← → ↑ ↓, Shift nitro, C camera |
| **Neon Drift** | 3D synthwave highway dodger (three.js) | ← → / tap the left or right side |
| **Skyline Stack** | 3D timing tower builder (three.js) | Tap / Space |
| **Void Swarm** | Wave survival shooter with level-up upgrades | WASD / drag |
| **Block Blitz** | 8×8 drag-and-drop block puzzle with combos | Drag & drop |
| **Orbit Hop** | Slingshot from planet to planet | Tap / Space |
| **Gravity Flip** | One-button gravity runner | Tap / Space |
| **Pulse Breaker** | Brick breaker with power-ups and endless levels | Mouse / ← → |
| **Glow Serpent** | Neon snake with golden bonus orbs | Arrows / swipe |

All games have best scores (saved in the browser), sound effects, pause (`P`), mute (`M`), fullscreen (`F`) and touch controls.

## Run it

It's a static site. Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

### Host it free on GitHub Pages
Repo **Settings → Pages → Deploy from a branch**, pick the branch and `/ (root)`. Three.js is bundled in `vendor/`, so games load without any outside CDN. Only the fonts come from Google Fonts, and the site falls back to system fonts if those are blocked.

## Project layout

```
index.html            arcade homepage
assets/games.js       game catalogue (title, tags, colour, description)
assets/portal.*       homepage styles and logic
assets/thumbs/        game thumbnails (made by tools/thumbs.js)
shared/arcade.js      shared runtime: HUD, menus, scores, synth sounds, particles
shared/game.css       shared game UI styles
games/<id>/           one folder per game (index.html + game.js)
vendor/three.min.js   three.js r159 (MIT)
```

## Adding a game

1. Create `games/my-game/index.html` + `game.js`. Copy one of the 2D games as a starting point.
2. In `game.js`, call `Arcade.shell({ id, title, howto, onStart })`. This gives you the HUD, the start and game-over screens, pause and best scores. Use `S.setScore()` / `S.addScore()` and `S.gameOver()`.
3. Add an entry to `assets/games.js`.
4. Optional: add a plan to `tools/thumbs.js` and run it (with the site served on :8765) to screenshot a thumbnail.
