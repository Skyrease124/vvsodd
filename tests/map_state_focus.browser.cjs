// Real-browser checks for the selected state and county treatment (kinvest-liens/map/state-focus.js): the selected shape is
// raised with its satellite imagery, the surroundings are dimmed, the camera is locked to the selection, and clearing restores
// the national map. Automatic: no toggle, button or banner is added. Network access is mocked: tiles are tiny images and the
// county boundaries come from a small fictional file, so nothing here depends on an outside service.
// Requires the static server from tests/map_polish.static-server.cjs on 127.0.0.1:8765.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const BASE = 'http://127.0.0.1:8765';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
// Fictional Iowa counties: Scott is a box inside the state, Polk another.
const box = (w, s, e, n) => ({type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]]});
const COUNTIES = {type: 'FeatureCollection', features: [
  {type: 'Feature', properties: {NAME: 'Scott County'}, geometry: box(-90.9, 41.4, -90.2, 41.8)},
  {type: 'Feature', properties: {NAME: 'Polk County'}, geometry: box(-93.9, 41.4, -93.2, 41.9)}]};

(async () => {
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
  const run = async (viewport, label) => {
    const context = await browser.newContext({viewport, deviceScaleFactor: 1, reducedMotion: 'reduce'});
    await context.addInitScript(() => { window.__ppaFocusAdaptive = false; }); // the weak device guard is not under test, and software rendering is slow
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/.netlify/functions/account', r => r.fulfill({status: 200, contentType: 'application/json', body: '{}'}));
    await page.route('**/server.arcgisonline.com/**', r => r.fulfill({status: 200, contentType: 'image/png', body: PNG}));
    await page.route('**/tile.openstreetmap.org/**', r => r.fulfill({status: 200, contentType: 'image/png', body: PNG}));
    await page.route('**/USA_Counties_Generalized_Boundaries/**', r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(COUNTIES)}));
    await page.goto(BASE + '/', {waitUntil: 'domcontentloaded'});
    const el = page.locator('iframe[src*="/map/?embed=1&home=1"]'); await el.waitFor({timeout: 20000});
    const f = await (await el.elementHandle()).contentFrame();
    await f.waitForFunction(() => window.__ppaMap && window.__ppaMap.getLayer && window.__ppaMap.getLayer('st-line') && window.PPAFocus, null, {timeout: 30000});
    await page.waitForTimeout(800);
    const read = () => f.evaluate(() => { const m = window.__ppaMap, mb = m.getMaxBounds && m.getMaxBounds(), fx = document.querySelector('.ppa-fx'), c = m.getCenter();
      return {pitch: m.getPitch(), terrain: !!m.getTerrain(), bounds: mb ? [mb.getWest(), mb.getSouth(), mb.getEast(), mb.getNorth()] : null, fx: !!fx && fx.style.display !== 'none', active: window.PPAFocus.active,
        center: [c.lng, c.lat], ui: document.querySelectorAll('#pmMap button,#pmMap [role=switch],#pmMap [role=alert],#pmMap [role=status],#pmMap [role=dialog]').length,
        added: [...document.querySelectorAll('[class*="ppa-"]')].map(e => e.className).filter(c => /(^| )ppa-(fx|veil|rim)/.test(String(c)))}; });
    const until = (fn, msg) => f.waitForFunction(fn, null, {timeout: 60000}).catch(() => { throw new Error(label + ': ' + msg); });
    const pick = (name, v) => f.getByRole('combobox', {name}).selectOption(v);

    // 0. Before any selection: the normal national map, and a count of the controls on the page.
    const before = await read();
    assert.equal(before.terrain, false, label + ': no terrain before a selection'); assert.equal(before.pitch, 0); assert.equal(before.bounds, null); assert.equal(before.active, false);

    // 1. Selecting a state raises it, dims the rest, tilts the camera and locks it to the state.
    await pick('State', 'IA');
    await until(() => window.__ppaMap.getTerrain() && window.__ppaMap.getPitch() > 40 && window.__ppaMap.getMaxBounds(), 'the state is raised, tilted and locked');
    const st = await read();
    assert.ok(st.active && st.terrain && st.fx, label + ': raised with the dimming layer on'); assert.ok(Math.abs(st.pitch - 42) < 1, label + ': tilted');
    assert.ok(st.bounds[0] < -96.5 && st.bounds[2] > -90.1 && st.bounds[1] < 40.5 && st.bounds[3] > 43.4, label + ': locked to Iowa, not the country');
    // A wide screen shows more than the state, so its lock is as wide as the view; it is still far from the whole country.
    assert.ok(st.bounds[2] - st.bounds[0] < 24 && st.bounds[3] - st.bounds[1] < 14 && st.bounds[0] > -106 && st.bounds[2] < -82, label + ': and not beyond a margin around it');
    const layers = await f.evaluate(() => ['sat', 'st-line', 'pts', 'ppa-wall', 'ppa-county-lines'].map(id => !!window.__ppaMap.getLayer(id)));
    assert.deepEqual(layers, [true, true, true, true, true], label + ': the existing layers stay and the new ones are added');
    assert.equal(await f.evaluate(() => window.__ppaMap.getLayoutProperty('sat', 'visibility') !== 'none'), true, label + ': the satellite imagery is still shown');
    await until(() => window.__ppaMap.getSource('ppa-counties') && window.__ppaMap.getSource('ppa-counties')._data.features && window.__ppaMap.getSource('ppa-counties')._data.features.length === 2, 'county lines are drawn');
    const after = await read(); assert.deepEqual(after.added, ['ppa-fx'], label + ': the only element it adds is the dimming layer itself: no button, toggle, banner or status');

    // 2. The camera cannot leave: a move far away is pulled back inside the lock, and a drag that ends outside the state eases back in.
    await f.evaluate(() => window.__ppaMap.jumpTo({center: [-120, 35]}));
    const away = (await read()).center; assert.ok(away[0] >= st.bounds[0] - 1e-6 && away[0] <= st.bounds[2] + 1e-6, label + ': a jump away stays inside the lock');
    await f.evaluate(() => { const m = window.__ppaMap, mb = m.getMaxBounds(); m.jumpTo({center: [mb.getWest() + 0.2, mb.getSouth() + 0.2]}); m.fire('moveend', {originalEvent: {type: 'touchend'}}); });
    await page.waitForTimeout(400);
    const back = (await read()).center, inIowa = back[0] > -96.7 && back[0] < -90.1 && back[1] > 40.3 && back[1] < 43.6;
    assert.ok(inIowa, label + ': a drag that ends outside the state eases back into it (' + back.map(v => v.toFixed(2)) + ')');

    // 3. Selecting a county raises that county in the same way and tightens the lock.
    await pick('County', {index: 1});
    await until(() => { const mb = window.__ppaMap.getMaxBounds(); const d = window.__ppaMap.getSource('ppa-focus'); return d && d._data.features && d._data.features.length === 1 && mb && mb.getEast() - mb.getWest() < 3; }, 'the county is raised and the lock tightens');
    const co = await read(); assert.ok(co.terrain && co.fx && Math.abs(co.pitch - 42) < 1, label + ': the county is raised and tilted');
    assert.ok(co.bounds[2] - co.bounds[0] < st.bounds[2] - st.bounds[0], label + ': locked to the county, tighter than the state');
    const sel = await f.evaluate(() => JSON.stringify(window.__ppaMap.getSource('ppa-focus')._data.features[0].geometry.coordinates[0][0]));
    assert.match(sel, /-90\.9|-90\.2|-93\.9|-93\.2/, label + ': the raised shape is that county\'s own outline');

    // 4. Changing the state moves the effect to the new state.
    await pick('State', 'FL');
    await until(() => { const mb = window.__ppaMap.getMaxBounds(); return window.__ppaMap.getTerrain() && mb && mb.getWest() < -86 && mb.getEast() > -81 && mb.getSouth() < 26 && mb.getNorth() > 29; }, 'the effect moves to Florida');

    // 5. Clearing restores the national map.
    await pick('State', '');
    await until(() => !window.__ppaMap.getTerrain() && window.__ppaMap.getPitch() < 0.5 && !window.__ppaMap.getMaxBounds() && !window.PPAFocus.active, 'clearing restores the national map');
    const off = await read(); assert.equal(off.fx, false, label + ': the dimming layer is hidden again');
    const bad = errors.filter(e => /ReferenceError|TypeError|SyntaxError/.test(e)); assert.equal(bad.length, 0, label + ': ' + bad.join('; '));
    await context.close();
    console.log('PASS: ' + label + ' (state raised, county raised, camera locked, state change, clear)');
  };
  try {
    await run({width: 390, height: 844}, 'phone 390px');
    await run({width: 1365, height: 900}, 'desktop 1365px');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
