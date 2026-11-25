import registry from './data/florida-gis-registry.json' with {type:'json'};

const key=value=>String(value??'').toLowerCase().replace(/saint/g,'st').replace(/[^a-z0-9]/g,'');
const byName=new Map(registry.counties.map(county=>[key(county.name),county]));
const slug=name=>name.toLowerCase().replace(/^saint /,'st ').replace(/[^a-z0-9]+/g,'-');

export const FLORIDA_READINESS=Object.freeze([
 'Source discovery needed','Source identified','Source validated','Connector implemented',
 'Awaiting eligible parcel data','Ready for owner-approved pilot',
 'Live verification completed','Publication approved'
]);

export function floridaCountyFor(dataset){
 return dataset?.state==='FL'?byName.get(key(dataset.county))??null:null;
}

export function withFloridaDirectory(datasets){
 const covered=new Set(datasets.map(floridaCountyFor).filter(Boolean));
 const existingIds=new Set(datasets.map(row=>row.id));
 const directoryOnly=registry.counties.filter(county=>!covered.has(county)).map(county=>{
  const id='FL-'+slug(county.name);
  return {id:existingIds.has(id)?'FL-registry-'+county.geoid:id,state:'FL',county:county.name,records:0,directoryOnly:true};
 });
 return [...datasets,...directoryOnly];
}

export function floridaReadiness(dataset,{implemented=false,eligible=null}={}){
 const county=floridaCountyFor(dataset);
 if(!county)return null;
 const source=registry.sources[county.sourceId];
 return {county,source,alternates:(county.alternateSourceIds||[]).map(id=>registry.sources[id]),evidence:registry.evidence,reviewedOn:registry.reviewedOn,eligible,
  status:FLORIDA_READINESS[implemented?(eligible===0?4:3):source?.status==='Source validated'?2:source?1:0],
  blockers:[
   ...(!implemented?['County-specific identifier and situs mapping not verified']:[]),
   ...(county.name==='Santa Rosa'&&eligible===0?[
    'All 1,729 unmapped source rows have Unknown situs; 1,727 carry the mineral-rights suffix'
   ]:[]),
   ...(eligible===0?['No eligible candidate in the current dataset']:[]),
   ...(eligible===null?['Eligible parcel count is unverified']:[]),
   'Live execution and publication require separate approval'
  ]};
}

export function reviewedFloridaSource(dataset){
 const county=floridaCountyFor(dataset);
 const source=registry.sources[county?.sourceId];
 if(!county||!source||source.status!=='Source validated')throw Error('Florida county source is not documented');
 return {county,source};
}
