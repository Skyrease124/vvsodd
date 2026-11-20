import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncReviewedCertificate} from '../netlify/lib/auto-research-release.mjs';
import {audienceFor,PRO_EARLY_ACCESS_MS,safeResearchRecord} from '../netlify/lib/research-releases.mjs';
import vm from 'node:vm';
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

test('real Palm Beach staged parcel fixture matches an existing mapped location (no publication)',async()=>{
  // Parcel and center verified against the Palm Beach staged export and the map's AL/FL county datasets.
  const palm={...record,county:'Palm Beach',parcelId:'74-42-43-13-17-004-0000',
    certificateNumber:'102',taxYear:'2017'};
  const palmKey='fl|palm beach|74-42-43-13-17-004-0000|102|2017';
  const kv=store();
  const result=await syncReviewedCertificate(options(kv,{...approval(),certificateKey:palmKey,
    evidenceUrl:'https://www.pbctax.gov/'},{record:palm}));
  assert.equal(result.action,'published');
  const item=safeResearchRecord(kv.db.get('approved-research-releases-v1').list[0]);
  const code=fs.readFileSync('kinvest-liens/map/research-match.js','utf8');
  const ctx={module:{exports:{}},globalThis:{}};
  vm.runInNewContext(code,ctx,{timeout:1000});
  const matched=ctx.module.exports.match([item],[{meta:{id:'FL-palm-beach',state:'FL',county:'Palm Beach County'},
    recs:[{p:palm.parcelId,cx:[-80.10162,26.73355]}]}]);
  assert.equal(matched.length,1);
  assert.equal(JSON.stringify(matched[0].coordinates),'[-80.10162,26.73355]');
  assert.equal(audienceFor(item,null,date),'none');
});


test('Wakulla certificates on the same parcel and number across tax years remain separate releases',async()=>{
 const kv=store();
 const older={...record,taxYear:'2020'};
 const newer={...record,taxYear:'2021'};
 const oldKey='fl|wakulla|'+record.parcelId.toLowerCase()+'|18|2020';
 const newKey='fl|wakulla|'+record.parcelId.toLowerCase()+'|18|2021';
 const oldReview={...approval(),certificateKey:oldKey};
 const newReview={...approval(),certificateKey:newKey};
 const first=await syncReviewedCertificate(options(kv,oldReview,{record:older}));
 const second=await syncReviewedCertificate(options(kv,newReview,{record:newer}));
 assert.equal(first.action,'published');
 assert.equal(second.action,'published');
 assert.notEqual(first.id,second.id);
 const published=kv.db.get('approved-research-releases-v1').list;
 assert.equal(published.length,2);
 assert.deepEqual(new Set(published.map(x=>x.reviewCertificateKey)),new Set([oldKey,newKey]));
 const withdrawn=await syncReviewedCertificate(options(kv,{...oldReview,decision:'needs-follow-up',
  publishApprovedResearch:false,publicationAuthorized:false},{record:older}));
 assert.equal(withdrawn.action,'withdrawn');
 const remaining=kv.db.get('approved-research-releases-v1').list;
 assert.equal(remaining.length,1);
 assert.equal(remaining[0].reviewCertificateKey,newKey);
 assert.equal(remaining[0].availableForPurchase,false);
});
