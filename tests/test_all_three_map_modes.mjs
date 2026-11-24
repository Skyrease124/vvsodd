import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
const matcher=fs.readFileSync('kinvest-liens/map/research-match.js','utf8');
const context={module:{exports:{}},globalThis:{}};
vm.runInNewContext(matcher,context,{timeout:1000});
const match=context.module.exports.match;
const update={id:'one',type:'lien',state:'AL',county:'Baldwin',parcelId:'123-456',researchOnly:true,availableForPurchase:false};
const dataset={meta:{id:'AL-05',state:'AL',county:'Baldwin County'},recs:[{p:'123-456',cx:[-87.75,30.45]}]};
test('authorized approved research records can resolve nationwide without selecting county',()=>{
 assert.equal(match([update],[dataset]).length,1);
});
test('matching avoids guessed, missing, and ambiguous locations',()=>{
 assert.equal(match([update],[{...dataset,recs:[{p:'123-456'}]}]).length,0);
 assert.equal(match([update],[{...dataset,recs:[...dataset.recs,...dataset.recs]}]).length,0);
 assert.equal(match([{...update,state:'FL'}],[dataset]).length,0);
});
test('homepage and AI Workshop both use full map engine iframe',()=>{
 const home=fs.readFileSync('kinvest-liens/index.html','utf8');
 const workshop=fs.readFileSync('kinvest-liens/ai/workshop.js','utf8');
 const mapPage=fs.readFileSync('kinvest-liens/map/index.html','utf8');
 assert.match(home,/\/map\/\?embed=1&home=1/);
 assert.match(workshop,/embed:'1',picker:'1'/);
 assert.match(workshop,/map\.src = '\/map\/\?' \+ q/);
 assert.match(mapPage,/research-match\.js/);
 assert.match(mapPage,/parcel-map\.js/);
});
test('preloads only authorized research county data without polluting normal map results',()=>{
 assert.match(script,/async function locateApprovedResearch\(\)/);
 assert.match(script,/for \(const r of researchUpdates\)/);
 assert.match(script,/const entries = \[\.\.\.choices\.values\(\)\]\.slice\(0, 12\)/);
 assert.match(script,/researchMapped\[d\.id\] = expanded/);
 assert.match(script,/const byCounty = new Map\(\[\.\.\.Object\.values\(researchMapped\), \.\.\.Object\.values\(loaded\)\]/);
 assert.match(script,/researchPins = window\.PPAResearchMap\.match\(researchUpdates\.filter\(u => !u\.mapRecord\), relevant\)/);
 assert.match(script,/await locateApprovedResearch\(\)/);
 assert.match(script,/if \(!raw \|\| !Array\.isArray\(raw\.recs\) \|\| !raw\.dict \|\| raw\.id !== d\.id\) return/);
 assert.match(script,/researchUpdates = data\.records\.filter/);
 assert.match(script,/\/\.netlify\/functions\/research-updates/);
 assert.match(script,/credentials:'same-origin'/);
 assert.doesNotMatch(script,/researchMapped\[.*?\]\.recs.*?renderResults/s);
});
test('county normalization handles suffix reliably',()=>{
 const line=script.split('\n').find(x=>x.includes('const countyKey = value =>'));
 assert.ok(line.includes('replace(/\\s+county$/,'));
});
