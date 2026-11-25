import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync('kinvest-liens/map/parcel-map.js','utf8');
const css=readFileSync('kinvest-liens/map/parcel-map.css','utf8');
const src=readFileSync('kinvest-liens/map/index.html','utf8');

test('black state borders stay on; thick white reference overlay is off by default',()=>{
  // Design: satellite imagery + black state borders + parcel outlines. The ESRI 'ref' raster
  // (white boundaries and place labels) is opt-in through Layers > Hybrid only.
  assert.match(js,/let IDX = null[^\n]*base = 'satellite'/);
  assert.match(js,/id: 'st-line'[^;\n]*layout: \{ visibility: 'visible' \}[^;\n]*'line-color': '#000000'/);
  assert.match(js,/\{ id: 'ref', type: 'raster', source: 'ref', layout: \{ visibility: 'none' \} \}/);
  assert.match(js,/map\.setLayoutProperty\('ref', 'visibility', b === 'hybrid' \? 'visible' : 'none'\)/);
  assert.match(js,/map\.setLayoutProperty\('sat', 'visibility', b === 'map' \? 'none' : 'visible'\)/);
  assert.match(js,/id: 'st-sel'[^;\n]*layout: \{ visibility: 'none' \}/);
  for(const layer of ['p-fill','p-line','p-line-hist','p-vac','p-dots','st-fill','fl-gis-parcel-outline','fl-gis-building-outline']){
    assert.ok(js.includes("'"+layer+"'"),'Missing preserved map layer '+layer);
  }
  assert.match(js,/map\.setFilter\('st-sel'/);
});
test('one accessible collapsible map toolbar retains every existing action',()=>{
  for(const token of ['pmToolTrigger','pmToolMenu','aria-expanded','aria-controls','pm-tool-dock',
    'setDock(!dock.classList.contains', 'menu.inert=!open','menu.append(lay,fb,floridaBtn,tools)',
    'tools.append(camb,hzb)','menu.append(results)','menu.append(seg)',
    'moveNativeMapControls()','filter(el=>el.classList.contains']){
      assert.ok(js.includes(token),'Missing toolbar behavior: '+token);
  }
  assert.match(js,/if\(!homeMap&&!pickerMap\)moveNativeMapControls\(\)/);
  assert.match(js,/const menu=window.__pmDock\?\.menu/);
  assert.match(js,/document\.addEventListener\('pointerdown'/);
  assert.match(js,/window\.addEventListener\('keydown',e=>\{if\(e\.key==='Escape'\)setDock\(false\)/);
  assert.match(css,/\.pm-tool-dock\.open \.pm-tool-menu/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
test('GIS respects state, uses Florida GIS only for Florida and verified links elsewhere',()=>{
  assert.match(js,/btn\.textContent=code\?code\+' GIS':'GIS'/);
  assert.match(js,/if\(code!=='FL'&&flGisOn\)/);
  assert.match(js,/if\(curState!=='FL'\)/);
  assert.match(js,/function verifiedGISLink\(\)/);
  assert.match(js,/const d=selectedGISCounty\(\), gis=d\?\.gis/);
  assert.match(js,/GIS viewer not yet verified/);
  assert.match(js,/x>-81\.05&&x<-79\.65/);
  assert.match(js,/x>-82\.35&&x<-81\.45/);
  assert.match(js,/syncGISButton\(\); refresh\(\)/);
  // Behaviour of syncGISButton() and aiRefresh() on a state change is verified in a real browser
  // by tests/map_behavior.browser.cjs (CI: validate-map-polish.yml), not by matching adjacent lines.
});
test('styles support mobile homepage and full map without a second panel',()=>{
  assert.match(css,/\.ppa-map-home \.pm-tool-menu/);
  assert.match(css,/body:not\(\.ppa-map-home\) \.pm-stack/);
  assert.match(css,/\.pm-native-map-controls/);
  assert.match(css,/\.ppa-map-home \.pm-home-rail\{overflow:visible/);
  assert.match(src,/parcel-map\.css/);
  assert.match(src,/parcel-map\.js/);
});
