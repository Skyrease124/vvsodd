import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('homepage preserves parcel and radar surfaces and adds a combined view',()=>{
 const html=fs.readFileSync('kinvest-liens/index.html','utf8');
 const script=fs.readFileSync('kinvest-liens/app-ui.js','utf8');
 const css=fs.readFileSync('kinvest-liens/styles.css','utf8');
 for(const view of ['parcels','radar','both'])assert.match(html,new RegExp('data-home-map-view="'+view+'"'));
 assert.match(html,/id="home-parcels"/);
 assert.match(html,/id="home-radar"/);
 assert.match(html,/id="home-combined-note"/);
 assert.match(script,/const both = view === 'both'/);
 assert.match(script,/home-parcels'\)\.hidden = !\(both \|\| view === 'parcels'\)/);
 assert.match(script,/home-radar'\)\.hidden = !\(both \|\| view === 'radar'\)/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
