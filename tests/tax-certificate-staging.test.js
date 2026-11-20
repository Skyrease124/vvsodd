'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeExport,parseCSV}=require('../scripts/stage-tax-certificates');
test('parses quoted fields with commas and newlines',()=>{
 assert.deepEqual(parseCSV('a,b\n"x,y","line\nnext"\n'),[['a','b'],['x,y','line\nnext']]);
});
test('stages certificate records but never claims availability',()=>{
 const r=normalizeExport('Parcel Number,Certificate Number,Tax Year,Face Amount\n123,ABC,2024,$120.50\n',{state:'FL',county:'Lee County'});
 assert.equal(r.readyToStage,true);
 assert.equal(r.accepted[0].status,'unverified');
 assert.equal(r.accepted[0].availableForPurchase,false);
 assert.equal(r.accepted[0].faceAmount,120.5);
});
test('blocks duplicate certificates and invalid money',()=>{
 const r=normalizeExport('parcel id,certificate number,face amount\n123,ABC,15\n123,ABC,22\n456,DEF,-20',{state:'FL',county:'Lee County'});
 assert.equal(r.readyToStage,false);assert.equal(r.summary.rejected,2);
});
test('rejects exports without parcel/certificate identifiers',()=>{
 assert.throws(()=>normalizeExport('name,amount\nBob,123',{state:'FL',county:'Lee County'}),/parcel AND certificate/);
});
