import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reviewHoldingType,reviewHoldingEvidence,matchReviewFilters} from '../netlify/lib/certificate-review-filters.mjs';

const source='https://www.pbctax.gov/wp-content/uploads/2026/11/County_Certs_PBCTax-11.2.26.xlsx';
const report={source,classification:'official county-held certificate file; verify availability with Tax Collector'};
const palm={state:'FL',county:'Palm Beach',parcelId:'74-42-43-13-17-004-0000',certificateNumber:'102',taxYear:'2017',
  sourceUrl:source,holdingType:'unknown',redemptionStatus:'unknown',status:'unverified',availableForPurchase:false};

test('official Palm Beach county-held report makes older staged rows visible through holding filter',()=>{
  assert.equal(reviewHoldingType(palm,report),'county-held');
  assert.equal(reviewHoldingEvidence(palm,report),'official-county-held-list');
  assert.equal(matchReviewFilters(palm,report,{holding:'county-held'}),true);
  assert.equal(matchReviewFilters(palm,report,{holding:'county-held',redemption:'reported-unredeemed'}),false);
  assert.equal(palm.holdingType,'unknown'); // original snapshot stays unmodified
  assert.equal(palm.availableForPurchase,false);
});
test('fail closed if source, label or county is not the documented Palm Beach list',()=>{
  assert.equal(reviewHoldingType({...palm,sourceUrl:'https://evil.example/x.xlsx'},report),'unknown');
  assert.equal(reviewHoldingType({...palm,county:'Wakulla'},report),'unknown');
  assert.equal(reviewHoldingType(palm,{...report,classification:'unverified'}),'unknown');
  assert.equal(reviewHoldingType(palm,{...report,source:'https://www.pbctax.gov/other.xlsx'}),'unknown');
  assert.equal(reviewHoldingType({...palm,sourceUrl:'http://www.pbctax.gov/x.xlsx'},report),'unknown');
  assert.equal(reviewHoldingType({...palm,holdingType:'individually-held'},report),'individually-held');
});
test('county, search and redemption filters remain separate and do not imply sale availability',()=>{
  assert.equal(matchReviewFilters(palm,report,{q:'102',holding:'county-held'}),true);
  assert.equal(matchReviewFilters(palm,report,{q:'NOT-REAL',holding:'county-held'}),false);
  assert.equal(matchReviewFilters(palm,report,{holding:'individually-held'}),false);
  assert.equal(matchReviewFilters(palm,report,{holding:'county-held',redemption:'unknown'}),true);
});
test('three map routes remain attached and research requires owner approval plus Pro-first gates',()=>{
  const home=fs.readFileSync('kinvest-liens/index.html','utf8');
  const ai=fs.readFileSync('kinvest-liens/ai/workshop.js','utf8');
  const map=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
  const api=fs.readFileSync('netlify/functions/certificate-review.mjs','utf8');
  const release=fs.readFileSync('netlify/lib/research-releases.mjs','utf8');
  const owner=fs.readFileSync('kinvest-liens/owner/certificates/index.html','utf8');
  assert.match(home,/\/map\/\?embed=1&home=1/);
  assert.match(ai,/embed:'1',picker:'1'/);
  assert.match(map,/researchUpdates = data\.records\.filter/);
  assert.match(api,/b\.publishApprovedResearch!==true/);
  assert.match(api,/matchReviewFilters\(r,snap\.data/);
  assert.match(release,/48 \* 60 \* 60 \* 1000/);
  assert.match(release,/item\.availableForPurchase !== false/);
  assert.match(owner,/el\('holding'\)\.value=''/);
});
