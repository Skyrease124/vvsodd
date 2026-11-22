// Activation requires a separately reviewed, server-owned approval window.
// Indexed official metadata informed this proposal. The endpoint was not probed.
const miami=Object.freeze({
 id:'FL-miami-dade',county:'Miami-Dade',state:'FL',mode:'preview-research',enabled:false,
 source:'https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/6',
 authority:'https://www.miamidadepa.gov/pa/real-estate/property-search.page',
 metadata:'https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/layers',
 reviewedOrigin:'https://gisfs.miamidade.gov',format:'map-server',nativeWkid:2236,
 fields:Object.freeze({parcel:'FOLIO',address:'TRUE_SITE_ADDR'}),
 identifierFormat:'miami-folio',bounds:Object.freeze([-80.88,25.12,-80.00,25.99]),
 requestLimit:3,operationMode:'pilot-prepared',approval:null
});
export const pilotCountyIds=()=>[miami.id];
export const countyPilotDefinition=id=>id===miami.id?miami:null;

export function eligiblePilotRows(config,raw){
 if(raw?.id!==config.id||!Array.isArray(raw.recs))throw Error('County dataset mismatch');
 const parcelCounts=new Map(),recordCounts=new Map();
 for(const row of raw.recs){
  const id=typeof row?.p==='string'?row.p.replaceAll('-',''):null;
  parcelCounts.set(id,(parcelCounts.get(id)||0)+1);
  recordCounts.set(row?.i,(recordCounts.get(row?.i)||0)+1);
 }
 return raw.recs.filter(row=>typeof row?.i==='string'&&typeof row.p==='string'&&
  publishableIdentifier(row.p)&&parcelCounts.get(row.p.replaceAll('-',''))===1&&recordCounts.get(row.i)===1&&!row.g&&!row.cx&&typeof row.a==='string'&&/^\s*\d+\s+\S/.test(row.a))
  .slice(0,10).map(row=>({i:row.i,p:row.p,a:row.a,dataset:config.id}));
}
export function publishableIdentifier(value){
 return typeof value==='string'&&(/^[0-9]{13}$/.test(value)||/^\d{2}-\d{4}-\d{3}-\d{4}$/.test(value));
}
