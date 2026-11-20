import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {triageRecord,triageSnapshot,summarizeForAI} from '../netlify/lib/certificate-auto-triage.mjs';
const source='https://wakullatax.com/s/certificates.xlsx';
const record=(taxYear,other={})=>({state:'FL',county:'Wakulla',parcelId:'00-00-003-082-06186-001',
  certificateNumber:'18',taxYear,sourceUrl:source,status:'unverified',availableForPurchase:false,
  holdingType:'county-held',redemptionStatus:'reported-unredeemed',taxDeedStatus:'unknown',
  verificationFlags:['tax-deed-application-needs-verification'],...other});
const report={checkedAt:'2026-11-20T20:06:26.597803+00:00',source};
test('full-key isolation across tax years and no publication rights',()=>{
 const snap=triageSnapshot({hash:'hash1',data:{...report,records:[record('2020'),record('2021')]}});
 assert.equal(snap.total,2);
 assert.notEqual(snap.items[0].certificateKey,snap.items[1].certificateKey);
 assert.equal(snap.items.every(x=>x.findings.some(f=>f.code==='multiple-tax-years')),true);
 assert.equal(snap.items.every(x=>x.suggestedAction==='manual-review'&&x.availableForPurchase===false),true);
 assert.equal(snap.publicationAuthorized,false);
});
test('missing and conflicting evidence get attention; never guess sale status',()=>{
 const x=triageRecord(record('2024',{holdingType:'unknown',redemptionStatus:'unknown',
  verificationFlags:['redemption-date-conflicts-with-status']}),report);
 assert.equal(x.priority,'urgent');
 assert.deepEqual(x.findings.filter(f=>f.level==='urgent').map(f=>f.code),['conflicting-evidence']);
 assert.equal(x.availableForPurchase,false);
});
test('blank evidence remains unknown; invalid source record fails closed',()=>{
 const x=triageRecord(record('2017',{redemptionStatus:'unknown',holdingType:'unknown'}),{});
 assert.equal(x.priority,'review');
 assert.ok(x.findings.some(f=>f.code==='source-date-missing'));
 assert.throws(()=>triageRecord(record('2024',{availableForPurchase:true}),report));
});
test('summaries are aggregate counts and do not contain parcel-level data',()=>{
 const results=triageSnapshot({hash:'hash1',data:{...report,records:[record('2020')]}});
 const aggregate=summarizeForAI(results);
 assert.equal(aggregate.total,1);
 assert.equal(JSON.stringify(aggregate).includes('06186'),false);
});
test('owner-only API and UI require explicit manual action',()=>{
 const api=fs.readFileSync('netlify/functions/certificate-auto-review.mjs','utf8');
 const ui=fs.readFileSync('kinvest-liens/owner/certificates/index.html','utf8');
 assert.match(api,/if\(!user\.owner\)/);
 assert.match(api,/req\.headers\.get\('origin'\)/);
 assert.match(api,/NVIDIA_API_KEY/);
 assert.doesNotMatch(api,/syncReviewedCertificate|publishApprovedResearch|approved-research-releases-v1/);
 assert.match(ui,/Review All Counties/);
 assert.match(ui,/Open manual review/);
 assert.match(ui,/Nothing was published/);
});
