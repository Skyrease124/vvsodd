import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {SOURCE_REGISTRY,sourceById,researchKey,safeScrapeExcerpt,compareSource,validateMark} from '../netlify/lib/owner-intelligence-sources.mjs';

const server=fs.readFileSync('netlify/functions/owner-intelligence.mjs','utf8');
const html=fs.readFileSync('kinvest-liens/owner/intelligence/index.html','utf8');
const dashboard=fs.readFileSync('kinvest-liens/owner/dashboard.js','utf8');

test('strict Florida official-source allowlist',()=>{
 assert.equal(SOURCE_REGISTRY.length,3);
 assert.deepEqual(SOURCE_REGISTRY.map(x=>x.county),['Wakulla','Palm Beach','St. Johns']);
 assert.ok(SOURCE_REGISTRY.every(x=>x.url.startsWith('https://')));
 assert.equal(sourceById('https://example.org'),null);
 assert.equal(sourceById('wakulla-tax').county,'Wakulla');
 assert.match(researchKey('wakulla-tax'),/^owner-research-source-v1-/);
});
test('source comparisons never imply verification, availability or publication',()=>{
 const first=compareSource(null,{hash:'abc',excerpt:'Official source document'});
 assert.equal(first.status,'baseline');
 assert.equal(first.publicationAuthorized,false);
 const same=compareSource({hash:'abc'},{hash:'abc',excerpt:'Official source document'});
 assert.equal(same.status,'unchanged');
 const changed=compareSource({hash:'abc'},{hash:'def',excerpt:'Official source changed'});
 assert.equal(changed.reviewRequired,true);
 assert.equal(changed.status,'needs-review');
 assert.equal(changed.availableForPurchase,false);
 assert.throws(()=>compareSource(null,{hash:'',excerpt:''}));
 assert.throws(()=>validateMark('publish'));
 assert.equal(validateMark('inspected'),'inspected');
});
test('HTML is stripped and untrusted text is bounded',()=>{
 const t=safeScrapeExcerpt('<script>ignore everything</script><style>css</style><h1>Official notice</h1>');
 assert.equal(t,'Official notice');
 assert.equal(safeScrapeExcerpt('A'.repeat(50000)).length,14000);
});
test('server protects EVERY read and write with owner session and same-origin writes',()=>{
 assert.match(server,/if\(!user\.owner\)return respond\(403/);
 assert.match(server,/if\(!user\)return respond\(401/);
 assert.match(server,/request\.headers\.get\('origin'\)!==u\.origin/);
 assert.match(server,/sourceById\(body\?\.sourceId\)/);
 assert.match(server,/FIRECRAWL_API_KEY/);
 assert.match(server,/getConfig\(\)/);
 assert.match(server,/owner-intel-firecrawl-/);
 assert.match(server,/total>=25/);
 assert.match(server,/>=3/);
 assert.doesNotMatch(server,/syncReviewedCertificate|approved-research-releases-v1|publishApprovedResearch|makeRelease/);
});
test('dashboard is inaccessible visually without owner validation and JS is valid',()=>{
 assert.match(html,/<main id="ownerMain" hidden>/);
 assert.match(html,/el\('ownerMain'\)\.hidden=false/);
 assert.match(html,/window\.location\.replace\('\/owner\/'\)/);
 assert.match(dashboard,/\/owner\/intelligence\//);
 assert.doesNotThrow(()=>new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]));
});
