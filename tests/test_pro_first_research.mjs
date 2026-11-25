import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {audienceFor,isProAccount,makeRelease,safeResearchRecord,PRO_EARLY_ACCESS_MS} from '../netlify/lib/research-releases.mjs';

const t=Date.parse('2026-11-20T15:00:00.000Z');
const sample={id:'record-1',type:'lien',state:'FL',county:'Wakulla',parcelId:'P-123',
 certificateNumber:'14',title:'County tax certificate update',
 description:'County certificate reviewed against official research source.',
 evidenceUrl:'https://wakullatax.com/online-services',approvedForResearch:true};
const pro={paidThrough:'2026-11-30'};
const make=()=>makeRelease(sample,new Date(t),'owner@example.com');

test('Pro accounts exclude free family and suspended accounts',()=>{
 assert.equal(isProAccount(null),false);
 assert.equal(isProAccount({family:true},new Date(t)),false);
 assert.equal(isProAccount({paidThrough:'2026-11-30'},new Date(t)),true);
 assert.equal(isProAccount({paidThrough:'2026-11-19'},new Date(t)),false);
 assert.equal(isProAccount({owner:true},new Date(t)),true);
 assert.equal(isProAccount({disputeHold:true,paidThrough:'2026-11-30'},new Date(t)),false);
});
test('48-hour release is exact and fail closed before timestamp',()=>{
 const row=make();
 assert.equal(PRO_EARLY_ACCESS_MS,172800000);
 assert.equal(audienceFor(row,pro,t-1),'none');
 assert.equal(audienceFor(row,pro,t),'pro');
 assert.equal(audienceFor(row,null,t),'none');
 assert.equal(audienceFor(row,{family:true},t+PRO_EARLY_ACCESS_MS-1),'none');
 assert.equal(audienceFor(row,null,t+PRO_EARLY_ACCESS_MS-1),'none');
 assert.equal(audienceFor(row,null,t+PRO_EARLY_ACCESS_MS),'free');
 assert.equal(audienceFor(row,null,t+PRO_EARLY_ACCESS_MS+1),'free');
});
test('unapproved or unsafe rows cannot be released',()=>{
 const row=make();
 for(const patch of [{reviewApproved:false},{publicationApproved:false},{researchOnly:false},{availableForPurchase:true},{type:'sale'},{proReleaseAt:'bad'}]){
   assert.equal(audienceFor({...row,...patch},pro,t+PRO_EARLY_ACCESS_MS+1),'none');
 }
});
test('land and lien research supported; public output uses allowlist',()=>{
 const lien=make(),land=makeRelease({...sample,type:'land',certificateNumber:undefined},new Date(t),'owner');
 for(const item of [lien,land]) {
  assert.equal(audienceFor(item,pro,t),'pro');
  const out=safeResearchRecord({...item,reviewerAudit:'private reviewer',
    ownerName:'private owner',mailingAddress:'private address'});
  assert.equal(out.reviewerAudit,undefined);
  assert.equal(out.ownerName,undefined);
  assert.equal(out.mailingAddress,undefined);
  assert.equal(out.availableForPurchase,false);
 }
});
test('owner approval, official source and item identity are required',()=>{
 for(const patch of [{approvedForResearch:false},{evidenceUrl:'http://wakullatax.com'},
  {evidenceUrl:'https://user:pass@wakullatax.com/file'},{parcelId:''},{description:'too short'},
  {state:'ZZ'},{type:'cars'}]){
  assert.throws(()=>makeRelease({...sample,...patch},new Date(t),'owner'));
 }
 assert.throws(()=>makeRelease(sample,new Date(t),''));
});
test('AI endpoint is Pro-only, not family-inclusive paid access',()=>{
 const ai=fs.readFileSync('netlify/functions/ai.mjs','utf8');
 assert.match(ai,/if \(!auth\.isPro\(me\)\) return json\(402/);
 assert.match(ai,/paid: auth\.isPro\(me\)/);
 const auth=fs.readFileSync('netlify/lib/auth.mjs','utf8');
 assert.match(auth,/export function isPro\(u\)/);
});
test('new release API is owner authenticated, county-review bound, and does not edit maps',()=>{
 const api=fs.readFileSync('netlify/functions/research-updates.mjs','utf8');
 assert.match(api,/if\(!me\.owner\)return json\(403/);
 assert.match(api,/if\(req\.headers\.get\('origin'\)!==u\.origin\)/);
 assert.match(api,/review\.decision!=='approved-for-research'/);
 assert.match(api,/review\.snapshotSha256!==snap\.hash/);
 assert.match(api,/audienceFor\(item,me,now\)!=='none'/);
 assert.doesNotMatch(api,/writeFileSync|\/map\/data\/|\/liens\/states\/parcels\//);
});
test('member page receives gated API data, not public early static data',()=>{
 const html=fs.readFileSync('kinvest-liens/reviewed-certificates.html','utf8');
 assert.match(html,/\.netlify\/functions\/research-updates/);
 assert.doesNotMatch(html,/fetch\('\/data\/reviewed-certificates\.json'/);
 const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(inline.length);for(const m of inline)new vm.Script(m[1]);
 const ownerHtml=fs.readFileSync('kinvest-liens/owner/research-releases/index.html','utf8');
 const ownerScripts=[...ownerHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(ownerScripts.length);for(const m of ownerScripts)new vm.Script(m[1]);
});
test('owner release menu visible and existing browse links remain intact',()=>{
 const dashboard=fs.readFileSync('kinvest-liens/owner/dashboard.js','utf8');
 assert.match(dashboard,/\/owner\/research-releases\//);
 const home=fs.readFileSync('kinvest-liens/index.html','utf8');
 // Research updates are linked from the owner release workflow. The home page
 // retains its general land browse link and does not own this navigation.
 const release=fs.readFileSync('kinvest-liens/owner/research-releases/index.html','utf8');
 assert.match(release,/href="\/reviewed-certificates\.html"/);
 assert.match(home,/href="land\/"/);
});
