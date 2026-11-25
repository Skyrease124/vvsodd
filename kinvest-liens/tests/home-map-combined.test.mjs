import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('homepage preserves parcel and radar surfaces and adds a combined view',()=>{
 const html=fs.readFileSync('kinvest-liens/index.html','utf8');
 const script=fs.readFileSync('kinvest-liens/app-ui.js','utf8');
 const css=fs.readFileSync('kinvest-liens/styles.css','utf8');
 // Design: one combined "Price Pocket Maps" view. The separate Parcel Map and Tax Sale Radar
 // buttons stay in the markup but are hidden; both map surfaces always show together.
 assert.match(html,/<button[^>]*data-home-map-view="both"[^>]*aria-pressed="true"[^>]*>Price Pocket Maps<\/button>/);
 assert.match(html,/<button[^>]*data-home-map-view="parcels"[^>]*hidden style="display:none!important"/);
 assert.match(html,/<button[^>]*data-home-map-view="radar"[^>]*hidden style="display:none!important"/);
 assert.match(html,/id="home-parcels"/);
 assert.match(html,/id="home-radar"/);
 assert.match(html,/id="home-combined-note"[^>]*hidden/);
 assert.match(script,/document\.getElementById\('home-parcels'\)\.hidden=false;/);
 assert.match(script,/document\.getElementById\('home-radar'\)\.hidden=false;/);
 assert.match(script,/document\.getElementById\('home-combined-note'\)\.hidden=true;/);
 assert.match(script,/mapWorkspace\.classList\.toggle\('app-map-unified',view==='both'\)/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});


test('Radar official changes hand off state only, without inventing parcel markers',()=>{
 const radar=fs.readFileSync('kinvest-liens/radar.js','utf8');
 const app=fs.readFileSync('kinvest-liens/app-ui.js','utf8');
 assert.match(radar,/Explore state on Parcel Map/);
 assert.match(radar,/ppa:radar-map-state/);
 assert.match(app,/window\.addEventListener\('ppa:radar-map-state'/);
 assert.match(app,/showMapView\('both'\)/);
 assert.match(app,/select\.dispatchEvent\(new Event\('change'/);
 // The parcel handoff exists only for an official change with a parcel reference (gated below).
 assert.match(radar,/c\.official === true && c\.type !== 'missing' && c\.type !== 'canceled'/);
 assert.match(radar,/Explore state on Parcel Map/);
});

test('exact Radar parcel handoff requires official change and verified GIS polygon',()=>{
 const radar=fs.readFileSync('kinvest-liens/radar.js','utf8');
 const map=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
 const app=fs.readFileSync('kinvest-liens/app-ui.js','utf8');
 assert.match(radar,/c\.official === true/);
 assert.match(radar,/c\.type !== 'missing'/);
 assert.match(radar,/ppa:radar-map-parcel/);
 assert.match(map,/event\.origin !== location\.origin/);
 assert.match(map,/event\.source !== window\.parent/);
 assert.match(map,/String\(r\.p\)\.trim\(\)===d\.parcel\.trim\(\) && r\.g/);
 assert.match(map,/hits\.length===1/);
 assert.match(app,/ppa:radar-parcel-result/);
 assert.match(app,/no location was invented/);
});

test('hazard alerts live above homepage maps and use existing hazard endpoint',()=>{
 const html=fs.readFileSync('kinvest-liens/index.html','utf8');
 const ticker=fs.readFileSync('kinvest-liens/hazard-ticker.js','utf8');
 const css=fs.readFileSync('kinvest-liens/styles.css','utf8');
 assert.ok(html.indexOf('id="home-hazard-alerts"')<html.indexOf('class="app-map" id="map"'));
 assert.match(ticker,/document\.getElementById\('home-hazard-alerts'\)/);
 assert.match(ticker,/host\.inside\) host\.el\.appendChild\(box\)/);
 assert.match(ticker,/\.netlify\/functions\/hazards\?major=1/);
 assert.match(css,/\.app-home-hazard:empty\{display:none\}/);
});

test('Radar categories render verified county-area markers with fallback and 3D tilt',()=>{
 const radar=fs.readFileSync('kinvest-liens/radar.js','utf8');
 const app=fs.readFileSync('kinvest-liens/app-ui.js','utf8');
 const map=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
 assert.match(radar,/ppa:radar-category/);
 assert.match(app,/type:'ppa:radar-overlay'/);
 assert.match(map,/type!=='ppa:radar-overlay'/);
 assert.match(map,/drawRadarPins\(\)/);
 assert.match(map,/new maplibregl\.Marker/);
 assert.match(map,/map\.easeTo\(\{pitch:REDUCED\?0:22/);
 assert.match(map,/county location/);
 assert.match(map,/state aggregate/);
 assert.match(map,/radarCounties/);
 assert.match(map,/radarOverlay.month/);
 assert.match(map,/!!c.history/);
 // The homepage map is opportunity-only: calendar and history stay in Explore, so month is fixed to -1.
 assert.match(app,/tab:'opp',month:-1,counties/);
 assert.match(map,/ppa:radar-overlay-select/);
});
