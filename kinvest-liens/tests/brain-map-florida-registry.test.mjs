import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {floridaCountyFor,floridaReadiness,withFloridaDirectory} from '../../netlify/lib/brain-gis-florida-registry.mjs';
import {countyPilotDefinition,eligiblePilotRows} from '../../netlify/lib/brain-gis-pilot-registry.mjs';
import {createCountyConnector} from '../../netlify/lib/brain-gis-universal.mjs';

const read=async path=>JSON.parse(await fs.readFile(path,'utf8'));
const registry=await read('netlify/lib/data/florida-gis-registry.json');
const refs=await read('tools/florida-gis/official-identifiers.json');

test('all 67 audited rows preserve separate Census and tax department identifiers',()=>{
 assert.equal(registry.counties.length,67);
 for(const field of ['name','countyFips','geoid','fdorCode','sourceCountyValue'])
  assert.equal(new Set(registry.counties.map(row=>row[field])).size,67,field);
 for(const row of registry.counties){
  const original=refs.find(item=>item.name===row.name);
  assert.ok(original,row.name);
  assert.match(row.countyFips,/^\d{3}$/);
  assert.match(row.geoid,/^12\d{3}$/);
  assert.equal(row.geoid,original.stateFips+original.countyFips);
  assert.equal(row.fdorCode,original.fdorCode);
  assert.equal(row.sourceCountyValue,Number(original.fdorCode));
  assert.equal(row.liveExecutionEnabled,false);
  assert.equal(row.publicationEnabled,false);
  assert.equal(row.countyEvidenceStatus,'unverified');
  assert.ok(registry.sources[row.sourceId].evidence.length);
 }
 assert.equal(floridaCountyFor({state:'FL',county:'Miami-Dade'}).geoid,'12086');
 assert.equal(floridaCountyFor({state:'FL',county:'Miami-Dade'}).sourceCountyValue,23);
 assert.equal(floridaCountyFor({state:'FL',county:'St. Johns'}).countyFips,'109');
 assert.equal(floridaCountyFor({state:'MI',county:'Monroe'}),null);
});

test('audit keeps original and corrected FIPS for every county',async()=>{
 const audit=await read('tools/florida-gis/directory.audit.json');
 const fips=audit.filter(row=>row.field==='County_FIPS');
 assert.equal(fips.length,67);
 assert.ok(fips.every(row=>/^\d{2}$/.test(row.original)&&/^\d{3}$/.test(row.corrected)));
 for(const row of registry.counties)assert.equal(fips.find(item=>item.county===row.name).corrected,row.countyFips);
});

test('directory adds read-only choices without replacing existing map dataset IDs',async()=>{
 const index=await read('kinvest-liens/map/index.json');
 const out=withFloridaDirectory(index.datasets);
 assert.equal(new Set(out.map(row=>row.id)).size,out.length);
 assert.deepEqual(out.slice(0,index.datasets.length),index.datasets);
 assert.equal(out.filter(row=>row.state==='FL').length,67);
 for(const id of ['FL-broward','FL-palm-beach','FL-santa-rosa'])
  assert.equal(floridaReadiness(out.find(row=>row.id===id),{implemented:true,eligible:0}).status,'Awaiting eligible parcel data');
 assert.equal(floridaReadiness(out.find(row=>row.id==='FL-miami-dade'),{implemented:true,eligible:10}).status,'Connector implemented');
 const santa=await read('kinvest-liens/map/data/FL-santa-rosa.json');
 assert.equal(eligiblePilotRows(countyPilotDefinition(santa.id),santa).length,0);
});

test('registry documents one official source and rejects unapproved source schema or format',async()=>{
 const source=Object.values(registry.sources);
 assert.equal(source.length,2);
 assert.equal(registry.sources['santa-rosa-open-data'].situsField,null);
 assert.equal(source[0].layerId,0);
 assert.equal(source[0].geometryType,'esriGeometryPolygon');
 assert.equal(source[0].nativeWkid,6439);
 assert.equal(source[0].requiredOutputWkid,4326);
 const config=countyPilotDefinition('FL-broward');
 assert.throws(()=>createCountyConnector({...config,format:'shapefile'},{reserve:async()=>{}}),/Invalid/);
 const connector=createCountyConnector(config,{reserve:async()=>{},fetcher:async()=>Response.json({
  geometryType:'esriGeometryPolygon',capabilities:'Query',extent:{spatialReference:{wkid:6439}},fields:[]
 })});
 const discovery=await connector.discover();
 assert.equal(discovery.schema.compatible,false);
});
