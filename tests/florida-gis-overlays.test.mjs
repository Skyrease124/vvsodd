import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateOverlayQuery,cleanGISFeatures} from '../netlify/functions/florida-gis-overlay.mjs';

test('official ArcGIS endpoints are fixed and restrict location/viewport',()=>{
 for(const [source,bbox] of [
  ['palm-parcels','-80.110,26.680,-80.108,26.682'],
  ['lee-parcels','-81.980,26.620,-81.978,26.622'],
  ['lee-buildings','-81.980,26.620,-81.978,26.622']
 ]){const v=validateOverlayQuery({source,bbox});assert.equal(v.box.length,4);assert.match(v.cfg.endpoint,/^https:\/\//);}
 for(const input of [
  {source:'evil',bbox:'-80.1,26.6,-80.09,26.61'},
  {source:'palm-parcels',bbox:'-80.1,26.6,-79.8,26.9'},
  {source:'lee-buildings',bbox:'-75,25,-74,26'},
  {source:'lee-buildings',bbox:'NaN,26.6,-81.8,26.7'},
  {source:'palm-parcels',bbox:'-80.1,26.6,-80.2,26.7'}
 ])assert.throws(()=>validateOverlayQuery(input));
});
test('GIS geometry sanitizer excludes untrusted attributes, points and caps geometry count',()=>{
 const polygon={type:'Polygon',coordinates:[[[-80.11,26.68],[-80.109,26.68],[-80.109,26.681],[-80.11,26.68]]]};
 const data={type:'FeatureCollection',features:[
  {type:'Feature',properties:{PARID:'12-34',owner:'Not for publishing'},geometry:polygon},
  {type:'Feature',properties:{PARID:'point'},geometry:{type:'Point',coordinates:[-80.1,26.6]}}
 ]};
 const clean=cleanGISFeatures(data,'parcels');
 assert.equal(clean.features.length,1);
 assert.equal(clean.features[0].properties.reference,'12-34');
 assert.equal(clean.features[0].properties.owner,undefined);
 assert.equal(clean.features[0].properties.gisType,'parcels');
 assert.throws(()=>cleanGISFeatures({error:{code:400}},'parcels'));
 const many=cleanGISFeatures({type:'FeatureCollection',features:Array.from({length:200},()=>data.features[0])},'parcels');
 assert.equal(many.features.length,125);
});
test('overlay is opt-in, visual-only and map modes continue sharing existing engine',()=>{
 const src=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
 assert.match(src,/let flGisOn=false/);
 assert.match(src,/function toggleFloridaGIS/);
 assert.match(src,/map\.getZoom\(\)<16/);
 assert.match(src,/map\.addSource\('fl-gis-parcels'/);
 assert.match(src,/map\.addSource\('fl-gis-buildings'/);
 assert.match(src,/map\.on\('moveend',queueFloridaGIS\)/);
 assert.match(src,/\/\.netlify\/functions\/florida-gis-overlay/);
 assert.doesNotMatch(src,/availableForPurchase\s*=\s*true/);
 const other=fs.readFileSync('tests/test_all_three_map_modes.mjs','utf8');
 assert.match(other,/homepage and AI Workshop both use full map engine iframe/);
 const server=fs.readFileSync('netlify/functions/florida-gis-overlay.mjs','utf8');
 assert.doesNotMatch(server,/certificate-review|syncReviewedCertificate|research-updates/);
});
