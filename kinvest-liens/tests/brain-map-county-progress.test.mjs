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
 for(const phrase of ['County Agent Progress','Estimated remaining','Blocked: ','staged','Publisher','Refresh county status'])assert.ok(frontend.includes(phrase),phrase);
 assert.match(frontend,/owner-brain-county-progress/);
});
