import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('netlify/functions/owner-brain-batch-publish.mjs','utf8');
const ui=fs.readFileSync('kinvest-liens/owner/brain/preview-test.js','utf8');
test('three-parcel publisher requires deploy preview, owner, origin and explicit action',()=>{
 assert.match(code,/context\?\.deploy\?\.context!=='deploy-preview'/);
 assert.match(code,/!auth\.isBrainPreview\(\)/);
 assert.match(code,/!user\?\.owner/);
 assert.match(code,/req\.headers\.get\('origin'\)/);
 assert.match(code,/input\?\.action!=='publish-three-wayne'/);
 assert.match(code,/input\.confirmed!==true/);
});
test('only three fixed parcel IDs, bounded GIS, verified identity and guarded publisher',()=>{
 for(const id of ['01002754','01002830','01003357'])assert.match(code,new RegExp(id));
 assert.match(code,/verifyOfficial\(r,feature\.features\)/);
 assert.match(code,/Number\.isSafeInteger\(verified\.officialObjectId\)/);
 // Staged decisions wait for owner approval. This route never publishes directly.
 assert.match(code,/decision:'pending_owner_review'/);
 assert.doesNotMatch(code,/await publish\(/);
 assert.match(code,/addPendingIfAbsent/);
 assert.match(code,/if\(staged\.length\)/);
 assert.match(code,/currentControl\?\.status==='paused'/);
 assert.doesNotMatch(code,/api\.geoapify\.com|api\.tavily\.com|auth\.kvDel/);
});
test('preview UI explains publication scope and shows per-parcel results',()=>{
 assert.match(ui,/Publish 3 verified Wayne parcels to preview/);
 assert.match(ui,/owner-brain-batch-publish/);
 assert.match(ui,/This cannot change production/);
 assert.match(ui,/row\.published/);
});


test('manual parcel publisher blocks cross-site browser requests before staging',()=>{
 assert.match(code,/req\.headers\.get\('sec-fetch-site'\)==='cross-site'/);
 assert.match(code,/return json\(403,\{ok:false,error:'Cross-site request denied'\}\)/);
});
