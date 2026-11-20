import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyBatchMarks} from '../netlify/functions/certificate-auto-review.mjs';
const key=(y)=>'fl|wakulla|parcel-1|18|'+y;
const snapshot=()=>({snapshotSha256:'current',items:[
 {certificateKey:key(2020),availableForPurchase:false},
 {certificateKey:key(2021),availableForPurchase:false}
],triageMarks:{},publicationAuthorized:false});
test('private selected batch marks do not approve or publish records',()=>{
 const original=snapshot();
 const marked=applyBatchMarks(original,{snapshotSha256:'current',action:'mark-follow-up',certificateKeys:[key(2020)]});
 assert.equal(marked.triageMarks[key(2020)].status,'follow-up');
 assert.equal(marked.triageMarks[key(2021)],undefined);
 assert.equal(marked.items[0].availableForPurchase,false);
 assert.equal(marked.publicationAuthorized,false);
 assert.deepEqual(original.triageMarks,{});
 const inspected=applyBatchMarks(marked,{snapshotSha256:'current',action:'mark-inspected',certificateKeys:[key(2021)]});
 assert.equal(inspected.triageMarks[key(2021)].status,'inspected');
 const cleared=applyBatchMarks(inspected,{snapshotSha256:'current',action:'clear-mark',certificateKeys:[key(2020)]});
 assert.equal(cleared.triageMarks[key(2020)],undefined);
 assert.equal(cleared.triageMarks[key(2021)].status,'inspected');
});
test('stale, unknown, oversized, duplicated and invalid batch requests fail closed',()=>{
 const original=snapshot(),base={snapshotSha256:'current',action:'mark-follow-up'};
 for(const input of [
 {...base,snapshotSha256:'stale',certificateKeys:[key(2020)]},
 {...base,certificateKeys:[key(2019)]},
 {...base,certificateKeys:[key(2020),key(2020)]},
 {...base,certificateKeys:[]},
 {...base,certificateKeys:Array.from({length:101},(_,i)=>'x'+i)},
 {...base,certificateKeys:[key(2020)],action:'approve-for-research'}
 ])assert.throws(()=>applyBatchMarks(original,input));
});
test('AI summary uses shared saved NVIDIA keystore config, not environment-only gate',()=>{
 const api=fs.readFileSync('netlify/functions/certificate-auto-review.mjs','utf8');
 const html=fs.readFileSync('kinvest-liens/owner/certificates/index.html','utf8');
 assert.match(api,/keystore\.getConfig\(\)/);
 assert.match(api,/complete\(cfg,prompt/);
 assert.doesNotMatch(api,/if\(body\?\.useAI===true && process\.env\.NVIDIA_API_KEY\)/);
 assert.match(api,/if\(!user\.owner\)/);
 assert.match(api,/req\.headers\.get\('origin'\)/);
 assert.match(api,/snapshotSha256!==snap\.hash/);
 assert.doesNotMatch(api,/syncReviewedCertificate|publishedToPublicMaps:true/);
 assert.match(html,/Flag selected for follow-up/);
 assert.match(html,/Mark selected inspected/);
 assert.match(html,/No research was approved or published/);
});
