import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync('kinvest-liens/map/parcel-spatial.js','utf8');
const context={window:{}};
vm.runInNewContext(src,context);
const g=context.window.PPAParcelSpatial;
const rec={g:[[[-81.9,26.6],[-81.899,26.6],[-81.899,26.601],[-81.9,26.601],[-81.9,26.6]]],
 bb:[-81.9,26.6,-81.899,26.601]};
const fakeTurf={
 area:f=>f?.geometry?.coordinates===rec.g?4046.8564224:5,
 featureCollection:features=>({type:'FeatureCollection',features}),
 intersect:collection=>collection.features[1].properties?.noIntersection?null:
   ({type:'Feature',geometry:{type:'Polygon',coordinates:collection.features[1].geometry.coordinates}})
};
test('Turf measures parcel acreage from actual polygon geometry, not reported acreage',()=>{
 const result=g.calculateAcreage({...rec,ac:200},fakeTurf);
 assert.equal(result.status,'measured');
 assert.ok(Math.abs(result.acres-1)<1e-7);
 assert.equal(g.calculateAcreage({ac:2},fakeTurf).status,'unavailable');
 assert.equal(g.calculateAcreage(rec,null).status,'unavailable');
});
test('building footprint queries cover every county; Lee keeps its official layer and bounds',()=>{
 assert.equal(g.buildingQueryBBox(rec,{state:'FL',county:'Lee'}).split(',').length,4);
 assert.equal(g.buildingQueryBBox(rec,{state:'FL',county:'Lee County'}).split(',').length,4);
 assert.equal(g.buildingSource({state:'FL',county:'Lee'}),'lee-buildings');
 assert.equal(g.buildingSource({state:'FL',county:'Palm Beach'}),'osm-buildings');
 assert.equal(g.buildingQueryBBox(rec,{state:'FL',county:'Palm Beach'}).split(',').length,4);
 assert.equal(g.buildingQueryBBox(rec,{state:'AL',county:'Mobile'}).split(',').length,4);
 assert.equal(g.buildingQueryBBox(rec,null),null);
 assert.equal(g.buildingQueryBBox({...rec,bb:[-81.9,26.6,-81.8,26.7]},{state:'FL',county:'Lee'}),null);
 assert.equal(g.buildingQueryBBox({...rec,bb:[-81.9,26.6,-81.8,26.7]},{state:'AL',county:'Mobile'}),null);
});
test('mapped building intersection is an evidence signal, not proof of occupancy or vacancy',()=>{
 const fc={type:'FeatureCollection',metadata:{county:'Lee',truncated:false},
 features:[{geometry:{type:'Polygon',coordinates:rec.g}}]};
 const overlap=g.buildingOverlap(rec,fc,fakeTurf);
 assert.equal(overlap.status,'overlap');assert.equal(overlap.count,1);
 assert.equal(g.buildingOverlap(rec,{...fc,features:[]},fakeTurf).status,'no-overlap');
 assert.equal(g.buildingOverlap(rec,{...fc,metadata:{county:'Lee',truncated:true},features:[]},fakeTurf).status,'incomplete');
 assert.equal(g.buildingOverlap(rec,{...fc,features:[{geometry:null}]},fakeTurf).status,'incomplete');
 assert.equal(g.buildingOverlap(rec,{...fc,metadata:{county:'Palm Beach'}},fakeTurf).status,'unavailable');
 assert.equal(g.buildingOverlap(rec,{...fc,metadata:{county:'OSM',source:'osm',truncated:false}},fakeTurf).status,'overlap');
 assert.equal(g.buildingOverlap(rec,null,fakeTurf).status,'unavailable');
});
test('map only adds two Turf analyses to property details and does not modify tax sale status',()=>{
 const map=fs.readFileSync('kinvest-liens/map/parcel-map.js','utf8');
 const html=fs.readFileSync('kinvest-liens/map/index.html','utf8');
 const css=fs.readFileSync('kinvest-liens/map/parcel-map.css','utf8');
 assert.match(html,/@turf\/turf@7\.2\.0\/turf\.min\.js/);
 assert.match(html,/parcel-spatial\.js/);
 assert.ok(html.indexOf('parcel-spatial.js')<html.indexOf('parcel-map.js'));
 assert.match(map,/function spatialPanel\(r,d\)/);
 assert.match(map,/bd\.appendChild\(spatialPanel\(r,d\)\)/);
 assert.match(map,/info\.appendChild\(spatialPanel\(r,d\)\)/);
 assert.match(map,/source:'lee-buildings'/);
 assert.match(map,/Not confirmation of vacant land/);
 assert.match(css,/\.pm-spatial/);
 assert.doesNotMatch(src,/availableForPurchase|publicationAuthorized|autoApprove|vacant\s*=/);
 assert.doesNotThrow(()=>new vm.Script(map));
});
