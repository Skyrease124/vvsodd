// Deterministic official-source checks. Geocoded points are never geometry evidence.
export const DETROIT_GIS='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const norm=x=>String(x??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const street=x=>String(x??'').split(',')[0].toUpperCase().replace(/\b(STREET|ST|AVENUE|AVE|ROAD|RD|BOULEVARD|BLVD)\.?$/,'').replace(/[^A-Z0-9]/g,'');
export function verifyOfficial(record,features){
 if(!record?.i||!record.p||record.g||record.cx)throw Error('Source record missing or already mapped');
 if(!Array.isArray(features)||features.length!==1)throw Error('Official result is missing or ambiguous');
 const f=features[0];
 if(norm(f.attributes?.parcel_number)!==norm(record.p))throw Error('Official parcel ID mismatch');
 if(!record.a||!f.attributes.address||street(record.a)!==street(f.attributes.address))throw Error('Official street address mismatch');
 const rings=f.geometry?.rings;
 if(!Array.isArray(rings)||rings.length!==1)throw Error('Unsupported official polygon');
 const ring=rings[0];
 if(!Array.isArray(ring)||ring.length<4||ring.length>6000||!ring.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=-83.4&&p[0]<=-82.8&&p[1]>=42.2&&p[1]<=42.5))throw Error('Invalid official coordinates');
 if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('Open official polygon');
 const bb=[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
 let area=0;for(let i=1;i<ring.length;i++)area+=(ring[i-1][0]-bb[0])*(ring[i][1]-bb[1])-(ring[i][0]-bb[0])*(ring[i-1][1]-bb[1]);
 if(Math.abs(area)<1e-12||bb[2]-bb[0]>0.02||bb[3]-bb[1]>0.02)throw Error('Degenerate or oversized official polygon');
 return {g:rings,bb,cx:[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2],officialObjectId:f.attributes.object_id,
  evidenceUrl:DETROIT_GIS,notes:'Automated verification matched parcel '+record.p+' and street address '+f.attributes.address+' between the county listing and official Detroit GIS; closed, nonzero polygon passed coordinate and size checks.',
  checks:['exact_parcel_identity','exact_street_address','official_polygon','bounded_closed_nonzero_geometry']};
}
