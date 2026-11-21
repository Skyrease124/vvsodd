import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const endpoint=fs.readFileSync('netlify/functions/owner-brain-county-progress.mjs','utf8');
const frontend=fs.readFileSync('kinvest-liens/owner/pipeline.js','utf8');
test('county status endpoint requires owner and is GET only',()=>{
 assert.match(endpoint,/req\.method!=='GET'/);
 assert.match(endpoint,/auth\.userFromCookie/);
 assert.match(endpoint,/if\(!user\?\.owner\)/);
 assert.match(endpoint,/activeCounty\(index,auth/);
 assert.doesNotMatch(endpoint,/complete\(|GEOAPIFY_API_KEY|TAVILY_API_KEY/);
});
test('owner progress view shows active work and explicit connector blockers',()=>{
 for(const phrase of ['County Agent Progress','Estimated remaining','Blocked: ','staged','Publisher','Force Auto Run'])assert.ok(frontend.includes(phrase),phrase);
 assert.match(frontend,/owner-brain-county-progress/);
});

test('county progress bar is accessible and uses precise verified percentage',()=>{
 assert.match(frontend,/role','progressbar'/);
 assert.match(frontend,/aria-valuenow/);
 assert.match(frontend,/percent\.toFixed\(2\)/);
 assert.match(frontend,/c\.baselineMapped/);
 assert.match(frontend,/c\.verifiedCorrections/);
 assert.match(frontend,/County mapping progress/);
});

test('coverage refreshes automatically and force run respects guarded preview endpoint',()=>{
 assert.match(frontend,/setInterval\(\(\)=>/);
 assert.match(frontend,/20000/);
 assert.match(frontend,/visibilitychange/);
 assert.match(frontend,/ppa:brain-map-updated/);
 assert.match(frontend,/force\.hidden=!?\(/);
 assert.match(frontend,/d\.preview&&c\.id==='MI-wayne'/);
 assert.match(frontend,/owner-brain-wayne-run/);
 assert.match(frontend,/action:'run-wayne-batch',confirmed:true/);
 assert.match(frontend,/daily limit still apply/);
 const preview=fs.readFileSync('kinvest-liens/owner/brain/preview-test.js','utf8');
 assert.match(preview,/dispatchEvent\(new CustomEvent\('ppa:brain-map-updated'/);
});

test('automatic runner and force button share exactly one guarded batch operation',()=>{
 assert.match(frontend,/async function runBatch\(manual\)/);
 assert.match(frontend,/force\.onclick=\(\)=>runBatch\(true\)/);
 assert.match(frontend,/runBatch\(false\)/);
 assert.match(frontend,/setInterval\(\(\)=>/);
 assert.match(frontend,/300000/);
 assert.match(frontend,/document\.hidden/);
 assert.match(frontend,/autoAllowed=d\.preview&&c\.id==='MI-wayne'/);
 assert.match(frontend,/autoStopped=true/);
 assert.match(frontend,/Auto Run: ON/);
 assert.match(frontend,/Auto Run: OFF/);
});
