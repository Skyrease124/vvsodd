// Activation requires a separately reviewed, server-owned approval window.
// Only metadata has been reviewed. No parcel queries have run.
const miami=Object.freeze({
 id:'FL-miami-dade',county:'Miami-Dade',state:'FL',mode:'preview-research',enabled:false,
 source:'https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/6',
 authority:'https://www.miamidadepa.gov/pa/real-estate/property-search.page',
 metadata:'https://gisfs.miamidade.gov/mdarcgis/rest/services/MD_PA_PropertySearch/MapServer/layers',
 reviewedOrigin:'https://gisfs.miamidade.gov',format:'map-server',nativeWkid:2236,
 fields:Object.freeze({parcel:'FOLIO',address:'TRUE_SITE_ADDR'}),
 identifierFormat:'miami-folio',bounds:Object.freeze([-80.88,25.12,-80.00,25.99]),
 firstFolio:'30-3052-075-0060',
 terms:'https://www.miamidadepa.gov/pa/disclaimer.page',sourceTermsReviewed:false,
 requestLimit:3,operationMode:'pilot-prepared',approval:null
});
const broward=Object.freeze({
 id:'FL-broward',county:'Broward',state:'FL',mode:'preview-research',enabled:false,
 source:'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0',
 authority:'https://geodata.floridagio.gov/',
 attribution:'Florida Geographic Information Office · Florida Department of Revenue · Broward County Property Appraiser',
 metadata:'https://www.arcgis.com/home/item.html?id=efa909d6b1c841d298b0a649e7f71cf2',
 reviewedOrigin:'https://services9.arcgis.com',format:'feature-server',nativeWkid:6439,nativeAliases:Object.freeze([102967]),
 fields:Object.freeze({parcel:'PARCELNO',address:'PHY_ADDR1'}),
 jurisdiction:Object.freeze({field:'CO_NO',value:16}),
 identifierFormat:'broward-folio',parcelFieldLength:254,
 bounds:Object.freeze([-80.9,25.95,-80.0,26.36]),firstFolio:null,
 terms:'https://www.arcgis.com/home/item.html?id=efa909d6b1c841d298b0a649e7f71cf2',
 sourceTermsReviewed:false,requestLimit:3,operationMode:'pilot-prepared',approval:null
});
const pilots=Object.freeze({[miami.id]:miami,[broward.id]:broward});
export const pilotCountyIds=()=>Object.keys(pilots);
export const countyPilotDefinition=id=>Object.hasOwn(pilots,id)?pilots[id]:null;

export function pilotIdentifier(format,value){
 if(typeof value!=='string')return '';
 if(format==='broward-folio')return /^\d{12}$/.test(value)?value:'';
 return /^\d{13}$/.test(value)||/^\d{2}-\d{4}-\d{3}-\d{4}$/.test(value)?value.replaceAll('-',''):'';
}

export function eligiblePilotRows(config,raw){
 if(raw?.id!==config.id||!Array.isArray(raw.recs))throw Error('County dataset mismatch');
 const parcelCounts=new Map(),recordCounts=new Map();
 for(const row of raw.recs){
  const id=pilotIdentifier(config.identifierFormat,row?.p);
  parcelCounts.set(id,(parcelCounts.get(id)||0)+1);
  recordCounts.set(row?.i,(recordCounts.get(row?.i)||0)+1);
 }
 return raw.recs.filter(row=>typeof row?.i==='string'&&typeof row.p==='string'&&
  pilotIdentifier(config.identifierFormat,row.p)&&parcelCounts.get(pilotIdentifier(config.identifierFormat,row.p))===1&&recordCounts.get(row.i)===1&&!row.g&&!row.cx&&typeof row.a==='string'&&/^\s*\d+\s+\S/.test(row.a))
  .slice(0,10).map(row=>({i:row.i,p:row.p,a:row.a,dataset:config.id}));
}
