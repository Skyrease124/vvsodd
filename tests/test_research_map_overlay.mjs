import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {audienceFor,makeRelease,PRO_EARLY_ACCESS_MS} from '../netlify/lib/research-releases.mjs';

const code=fs.readFileSync('kinvest-liens/map/research-match.js','utf8');
const scope={module:{exports:{}},globalThis:{}};
vm.runInNewContext(code,scope,{timeout:1000});
const {match}=scope.module.exports;
const ds=(rows,county='Wakulla County',state='FL')=>({meta:{county,state},recs:rows});
const mapped=(p='P-123',cx=[-84.4,30.2])=>({p,cx,g:[[[0,0],[1,0],[1,1]] ]});
const update=(over={})=>({id:'update-1',type:'lien',state:'FL',county:'Wakulla',
 parcelId:'P-123',title:'County approved research',researchOnly:true,
 availableForPurchase:false,...over});
test('exact state, county and parcel matching uses existing coordinates only',()=>{
 const actual=match([update()],[ds([mapped()])]);
 assert.equal(actual.length,1);
 assert.equal(JSON.stringify(actual[0].coordinates),'[-84.4,30.2]');
 assert.equal(actual[0].parcel.p,'P-123');
 assert.equal(match([update({state:'GA'})],[ds([mapped()])]).length,0);
 assert.equal(match([update({county:'Palm Beach'})],[ds([mapped()])]).length,0);
 assert.equal(match([update({parcelId:'P-1234'})],[ds([mapped()])]).length,0);
});
test('ambiguous matching and unmapped parcels fail closed',()=>{
 assert.equal(match([update()],[ds([mapped(),mapped()])]).length,0);
 assert.equal(match([update()],[ds([mapped('P-123',null)])]).length,0);
 assert.equal(match([update()],[ds([mapped('P-123',[999,30])])]).length,0);
 assert.equal(match([update()],[ds([mapped('P-123',[-84.4,NaN])])]).length,0);
});
test('unapproved, unsafe or unsupported updates cannot become map pins',()=>{
 assert.equal(match([update({availableForPurchase:true})],[ds([mapped()])]).length,0);
 assert.equal(match([update({researchOnly:false})],[ds([mapped()])]).length,0);
 assert.equal(match([update({type:'for-sale'})],[ds([mapped()])]).length,0);
 assert.equal(match([update({id:null})],[ds([mapped()])]).length,0);
});
test('land research works and duplicate ids create at most one pin',()=>{
 const r=update({type:'land'});
 assert.equal(match([r,r],[ds([mapped()])]).length,1);
});
test('Pro gets approved updates before Free; Free only sees them at hour 48',()=>{
 const start=Date.parse('2026-11-20T14:00:00.000Z');
 const item=makeRelease({id:'land-1',type:'land',state:'FL',county:'Wakulla',parcelId:'P-123',
 title:'Research update on property',description:'Official research record was reviewed for parcel update.',
 evidenceUrl:'https://example.gov/parcel',approvedForResearch:true},new Date(start),'site-owner');
 assert.equal(audienceFor(item,{paidThrough:'2026-11-30'},start),'pro');
 assert.equal(audienceFor(item,null,start),'none');
 assert.equal(audienceFor(item,null,start+PRO_EARLY_ACCESS_MS-1),'none');
 assert.equal(audienceFor(item,null,start+PRO_EARLY_ACCESS_MS),'free');
});
test('existing map keeps original datasets and only fetches gated release API',()=>{
 const js=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
 assert.match(js,/\/\.netlify\/functions\/research-updates/);
 assert.match(js,/window\.PPAResearchMap\.match\(researchUpdates\.filter\(u => !u\.mapRecord\), relevant\)/);
 assert.match(js,/map\.addSource\('research-updates'/);
 assert.match(js,/map\.on\('click','research-pin',openResearchPin\)/);
 assert.match(js,/pmResearchCount/);
 assert.match(js,/\/map\/data\/.*d\.file/);
 assert.doesNotMatch(js,/fetch\(['"]\/data\/reviewed-certificates\.json/);
 const page=fs.readFileSync('kinvest-liens/map/index.html','utf8');
 assert.ok(page.indexOf('research-match.js')>=0 && page.indexOf('research-match.js')<page.indexOf('parcel-map.js'));
});
