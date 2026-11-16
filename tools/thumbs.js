// Regenerates assets/thumbs/*.jpg by screenshotting each game mid-play.
// Usage: serve the repo root on :8765 (python3 -m http.server 8765), then `node tools/thumbs.js`
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'thumbs');
const BASE = process.env.BASE || 'http://localhost:8765';
const HIDE = '.ub-hud,.ub-overlay,.ub-popup,#bar,#speed,#mult,#combo,#big,#hud,#tag{display:none!important}';

const plans = {
  'redline-highway': async p => {
    await p.evaluate(() => { localStorage.setItem('ubg:redline:mode', '"real"'); localStorage.setItem('ubg:redline:traffic', '"one"'); });
    await p.reload(); await p.waitForTimeout(2500);
    await p.keyboard.press('Enter'); await p.keyboard.down('ArrowUp'); await p.waitForTimeout(9000);
  },
  'neon-drift': async p => { await p.waitForTimeout(400); await p.keyboard.press('Space'); await p.waitForTimeout(2600); },
  'skyline-stack': async p => {
    await p.keyboard.press('Space');
    for (let lv = 1; lv <= 16; lv++) { await p.waitForTimeout(5200 / (4.2 + lv * 0.09) - 15); await p.keyboard.press('Space'); }
    await p.waitForTimeout(700);
  },
  'void-swarm': async p => {
    await p.keyboard.press('Space'); const d = ['d', 's', 'a', 'w'];
    for (let i = 0; i < 16; i++) { await p.keyboard.down(d[i % 4]); await p.waitForTimeout(600); await p.keyboard.up(d[i % 4]); if (await p.isVisible('#up.show')) await p.keyboard.press(String(1 + (i % 3))); }
  },
  'orbit-hop': async p => { await p.waitForTimeout(1200); },
  'gravity-flip': async p => { await p.waitForTimeout(2600); },
  'pulse-breaker': async p => { await p.keyboard.press('Space'); await p.waitForTimeout(300); await p.mouse.click(640, 600); await p.waitForTimeout(2200); },
  'glow-serpent': async p => { await p.waitForTimeout(5000); },
  'block-blitz': async p => { await p.waitForTimeout(800); }
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const only = process.argv.slice(2);
  for (const [id, plan] of Object.entries(plans)) {
    if (only.length && !only.includes(id)) continue;
    const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/games/${id}/index.html`);
    await page.waitForTimeout(300);
    await plan(page);
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(OUT, id + '.jpg'), type: 'jpeg', quality: 82 });
    console.log('thumb', id);
    await page.close();
  }
  await browser.close();
})();
