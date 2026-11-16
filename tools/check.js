// Smoke test: loads the homepage and every game in a headless browser, starts each
// game, feeds it some input and fails if any page throws a JavaScript error.
//
//   NODE_PATH=$(npm root -g) node tools/check.js              # everything
//   NODE_PATH=$(npm root -g) node tools/check.js void-swarm   # just some games
//   SHOTS=/some/dir NODE_PATH=$(npm root -g) node tools/check.js   # also save screenshots
//
// It serves the repo itself on a free port, so nothing else needs to be running.
// Headless Chromium has no real GPU: 3D games run at a few frames per second here.
// That is expected. This test finds errors, it cannot judge frame rate or game feel.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, () => resolve(srv));
  });
}

// The catalogue is a classic script that assigns window.GAMES; evaluate it with a fake window.
function catalogue() {
  const win = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/games.js'), 'utf8'))(win);
  return win.GAMES;
}

(async () => {
  const only = process.argv.slice(2), shots = process.env.SHOTS;
  const games = catalogue().filter(g => !only.length || only.includes(g.id));
  const srv = await serve(), base = 'http://localhost:' + srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let failed = 0;

  async function visit(name, url, drive) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
    page.on('console', m => { if (m.type() === 'error' && !/font|ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    page.on('response', r => { if (r.status() === 404 && r.url().startsWith(base)) errs.push('404 ' + r.url().replace(base, '')); });
    try {
      await page.goto(base + url, { timeout: 60000 });
      await page.waitForTimeout(1500);
      if (shots) await page.screenshot({ path: path.join(shots, name + '-menu.png') });
      if (drive) await drive(page);
      if (shots) await page.screenshot({ path: path.join(shots, name + '-play.png') });
    } catch (e) { errs.push('test harness: ' + e.message.split('\n')[0]); }
    console.log((errs.length ? 'FAIL ' : 'ok   ') + name + (errs.length ? '\n     ' + [...new Set(errs)].join('\n     ') : ''));
    if (errs.length) failed++;
    await page.close();
  }

  if (!only.length) await visit('homepage', '/index.html');
  for (const g of games) {
    if (!fs.existsSync(path.join(ROOT, 'assets/thumbs', g.id + '.jpg'))) { console.log('FAIL ' + g.id + '\n     missing assets/thumbs/' + g.id + '.jpg'); failed++; }
    await visit(g.id, '/games/' + g.id + '/index.html', async page => {
      await page.keyboard.press('Enter');                      // start from the menu
      const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
      for (let i = 0; i < 12; i++) {                           // generic input: arrows, space, clicks
        await page.keyboard.down(keys[i % 4]);
        await page.mouse.click(350 + i * 35, 420);
        if (i % 3 === 0) await page.keyboard.press('Space');
        await page.waitForTimeout(250);
        await page.keyboard.up(keys[i % 4]);
      }
      await page.waitForTimeout(1500);
      await page.keyboard.press('Enter');                      // restart if the run already ended
      await page.waitForTimeout(1000);
    });
  }

  await browser.close();
  srv.close();
  console.log(failed ? '\n' + failed + ' page(s) failed' : '\nall pages loaded and ran without errors');
  process.exit(failed ? 1 : 0);
})();
