import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncReviewedCertificate} from '../netlify/lib/auto-research-release.mjs';
import {audienceFor,PRO_EARLY_ACCESS_MS} from '../netlify/lib/research-releases.mjs';
const record={state:'FL',county:'Wakulla',parcelId:'00-00-003-082-06186-001',
 certificateNumber:'18',taxYear:'2024',status:'unverified',availableForPurchase:false};
const snapshot={hash:'snapshot-1',data:{checkedAt:'2026-11-18T10:00:00.000Z'}};
const key='fl|wakulla|00-00-003-082-06186-001|18|2024';
const date=new Date('2026-11-20T20:00:00.000Z');
const approval=(decision='approved-for-research')=>({decision,certificateKey:key,snapshotSha256:'snapshot-1',
 evidenceUrl:'https://wakullatax.com/s/WakullaCountyCertificates-h4x5.xlsx',
 publishApprovedResearch:decision==='approved-for-research',publicationAuthorized:decision==='approved-for-research'});
const store=()=>{const db=new Map();return {db,kvGet:k=>Promise.resolve(db.get(k)),kvPut:(k,v)=>{db.set(k,v);return Promise.resolve();}};};
const options=(kv,review=approval(),extra={})=>({record,review,snapshot,reviewer:'site-owner',now:date,
 kvGet:kv.kvGet,kvPut:kv.kvPut,...extra});
test('actual staged Wakulla-style record approved once becomes server-gated research',async()=>{
 const kv=store();
 const result=await syncReviewedCertificate(options(kv));
 assert.equal(result.action,'published');
 const item=kv.db.get('approved-research-releases-v1').list[0];
 assert.equal(item.parcelId,record.parcelId);
 assert.equal(item.availableForPurchase,false);
 assert.equal(item.sourceCheckedAt,snapshot.data.checkedAt);
 assert.equal(audienceFor(item,{paidThrough:'2026-11-30'},date),'pro');
 assert.equal(audienceFor(item,null,date),'none');
 assert.equal(audienceFor(item,null,new Date(date.getTime()+PRO_EARLY_ACCESS_MS-1)),'none');
 assert.equal(audienceFor(item,null,new Date(date.getTime()+PRO_EARLY_ACCESS_MS)),'free');
});
test('repeat approval does not duplicate or reset 48-hour delay',async()=>{
 const kv=store();const x=await syncReviewedCertificate(options(kv));
 const y=await syncReviewedCertificate(options(kv,approval(),{now:new Date(date.getTime()+3600000)}));
 assert.equal(y.action,'already-published');assert.equal(x.proReleaseAt,y.proReleaseAt);
 assert.equal(kv.db.get('approved-research-releases-v1').list.length,1);
});
test('review rejection or follow-up automatically withdraws published research',async()=>{
 const kv=store();await syncReviewedCertificate(options(kv));
 const x=await syncReviewedCertificate(options(kv,approval('needs-follow-up')));
 assert.equal(x.action,'withdrawn');
 assert.equal(kv.db.get('approved-research-releases-v1').list.length,0);
});
test('unverified without owner publication authorization cannot publish',async()=>{
 const kv=store();
 await assert.rejects(syncReviewedCertificate(options(kv,{...approval(),publicationAuthorized:false})));
 await assert.rejects(syncReviewedCertificate(options(kv,approval(),{record:{...record,availableForPurchase:true}})));
 assert.equal(kv.db.has('approved-research-releases-v1'),false);
});
test('certificate review API and owner UI enforce explicit one-click publication',()=>{
 const api=fs.readFileSync('netlify/functions/certificate-review.mjs','utf8');
 const ui=fs.readFileSync('kinvest-liens/owner/certificates/index.html','utf8');
 assert.match(api,/b.publishApprovedResearch!==true/);
 assert.match(api,/syncReviewedCertificate/);
 assert.match(ui,/Approve &amp; publish research update/);
 assert.match(ui,/publishApprovedResearch/);
 assert.match(ui,/48 hours/);
});
