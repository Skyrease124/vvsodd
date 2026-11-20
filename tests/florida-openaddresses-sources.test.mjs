import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file='kinvest-liens/map/florida-sources/sources.json';
const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
const page=fs.readFileSync('kinvest-liens/map/florida-sources/index.html','utf8');
const mapPage=fs.readFileSync('kinvest-liens/map/index.html','utf8');

test('Florida source catalog is stable source metadata only, not parcel or tax-lien records',()=>{
 assert.equal(manifest.state,'FL');
 assert.equal(manifest.type,'source-directory-only');
 assert.equal(manifest.entries.length,75);
 assert.equal(manifest.mapDatasetCount,17);
 assert.ok(manifest.entries.every(e=>e.definitionUrl.startsWith('https://github.com/openaddresses/openaddresses/blob/master/sources/us/fl/')));
 assert.ok(manifest.entries.every(e=>!('records' in e)&&!('availableForPurchase' in e)));
 assert.match(manifest.licenseNotice,/separate/i);
});
test('five inspected county-city definitions preserve source attributes and license caveats',()=>{
 const files=['lee.json','palm_beach.json','wakulla.json','st-johns.json','city_of_cape_coral.json'];
 for(const name of files)assert.ok(manifest.entries.find(x=>x.filename===name&&x.detailInspected));
 const lee=manifest.entries.find(x=>x.filename==='lee.json');
 assert.deepEqual(new Set(lee.layers.map(x=>x.type)),new Set(['addresses','parcels','buildings']));
 assert.ok(lee.layers.some(x=>x.type==='parcels'&&x.pidField==='STRAP'));
 const palm=manifest.entries.find(x=>x.filename==='palm_beach.json');
 assert.ok(palm.layers.some(x=>x.type==='parcels'&&x.pidField==='PARID'));
 assert.ok(palm.layers.some(x=>x.license==='Public Domain'));
 const wakulla=manifest.entries.find(x=>x.filename==='wakulla.json');
 assert.ok(wakulla.layers.some(x=>x.type==='parcels'&&x.year===2023));
 assert.ok(manifest.entries.filter(x=>!x.detailInspected).every(x=>x.layers.length===0));
});
test('source explorer is linked from the common map, without changing map data or auto-enriching parcels',()=>{
 assert.match(mapPage,/\/map\/florida-sources\//);
 assert.match(page,/research sources only/i);
 assert.doesNotMatch(page,/addLayer\(|addSource\(|auto.?publish|availableForPurchase\s*:\s*true/i);
 const match=page.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match);
 assert.doesNotThrow(()=>new vm.Script(match[1]));
});
