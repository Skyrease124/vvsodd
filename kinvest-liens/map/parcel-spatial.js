// Optional Turf.js computations for selected parcel maps.
// GIS footprint overlap is a research hint, never proof that land is vacant or developed.
(function(root){
  'use strict';
  const SQ_M_PER_ACRE=4046.8564224;
  const LEE_BOUNDS=[-82.35,25.8,-81.45,26.95];
  const validPoly=geometry=>geometry&&['Polygon','MultiPolygon'].includes(geometry.type)&&Array.isArray(geometry.coordinates)&&geometry.coordinates.length>0;
  const asFeature=geometry=>({type:'Feature',properties:{},geometry});
  function parcelFeature(r){
    if(!r||!Array.isArray(r.g)||!r.g.length||!Array.isArray(r.g[0])||r.g[0].length<4)return null;
    // Records in the existing map store a GeoJSON Polygon's coordinates in r.g.
    const geometry={type:'Polygon',coordinates:r.g};
    return validPoly(geometry)?asFeature(geometry):null;
  }
  function calculateAcreage(r,turf){
    if(!turf||typeof turf.area!=='function')return {status:'unavailable',reason:'Turf.js could not load'};
    const polygon=parcelFeature(r);
    if(!polygon)return {status:'unavailable',reason:'No usable parcel boundary'};
    try{
      const squareMeters=turf.area(polygon);
      if(!Number.isFinite(squareMeters)||squareMeters<=0)return {status:'unavailable',reason:'Invalid parcel geometry'};
      return {status:'measured',acres:squareMeters/SQ_M_PER_ACRE,squareFeet:squareMeters*10.7639104167};
    }catch{return {status:'unavailable',reason:'Parcel geometry could not be measured'};}
  }
  function buildingQueryBBox(r,d){
    if(!d||d.state!=='FL'||!/^Lee(?: County)?$/i.test(d.county||''))return null;
    const bb=r?.bb;
    if(!Array.isArray(bb)||bb.length!==4||bb.some(n=>!Number.isFinite(Number(n))))return null;
    const [west,south,east,north]=bb.map(Number);
    if(!(west<east&&south<north))return null;
    // A small cushion includes footprints whose boundary touches the parcel edge.
    const pad=0.00003;
    const box=[west-pad,south-pad,east+pad,north+pad];
    if(box[2]-box[0]>0.018||box[3]-box[1]>0.018||box[0]<LEE_BOUNDS[0]||box[1]<LEE_BOUNDS[1]||box[2]>LEE_BOUNDS[2]||box[3]>LEE_BOUNDS[3])return null;
    return box.map(n=>n.toFixed(6)).join(',');
  }
  function buildingOverlap(r,data,turf){
    const parcel=parcelFeature(r);
    if(!parcel||!turf||typeof turf.intersect!=='function'||typeof turf.area!=='function'||typeof turf.featureCollection!=='function')
      return {status:'unavailable',reason:'Parcel geometry or Turf.js unavailable'};
    if(!data||data.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.metadata||data.metadata.county!=='Lee')
      return {status:'unavailable',reason:'Official building data unavailable'};
    let count=0,invalid=0;
    for(const candidate of data.features){
      if(!validPoly(candidate?.geometry)){invalid++;continue;}
      try{
        const intersection=turf.intersect(turf.featureCollection([parcel,asFeature(candidate.geometry)]));
        if(intersection&&turf.area(intersection)>0.1)count++;
      }catch{invalid++;}
    }
    const partial=!!data.metadata.truncated||invalid>0;
    if(count>0)return {status:'overlap',count,partial};
    if(partial)return {status:'incomplete',count:0,reason:'Building result incomplete; no vacancy conclusion'};
    return {status:'no-overlap',count:0,partial:false};
  }
  root.PPAParcelSpatial={calculateAcreage,buildingQueryBBox,buildingOverlap};
})(typeof window!=='undefined'?window:globalThis);
