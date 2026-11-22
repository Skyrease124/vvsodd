// Activation requires a separately reviewed, server-owned approval window.
// Only metadata has been reviewed. No parcel queries have run.
import {reviewedFloridaSource} from './brain-gis-florida-registry.mjs';

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
function floridaCadastral({id,county,identifierFormat,bounds}){
 const {county:entry,source}=reviewedFloridaSource({state:'FL',county});
 const item=source.termsUrl;
 return Object.freeze({
  id,county,state:'FL',mode:'preview-research',enabled:false,
  source:source.url,
  authority:'https://geodata.floridagio.gov/',
  attribution:'Florida Geographic Information Office · Florida Department of Revenue · '+county+' County Property Appraiser',
  metadata:item,reviewedOrigin:new URL(source.url).origin,format:'feature-server',
  nativeWkid:source.nativeWkid,nativeAliases:Object.freeze([source.nativeAlias]),
  fields:Object.freeze({parcel:source.parcelField,address:source.situsField}),
  jurisdiction:Object.freeze({field:source.countyField,value:entry.sourceCountyValue}),
  identifierFormat,parcelFieldLength:254,bounds:Object.freeze(bounds),firstFolio:null,
  terms:item,sourceTermsReviewed:false,requestLimit:3,operationMode:'pilot-prepared',approval:null
 });
}

const broward=floridaCadastral({id:'FL-broward',county:'Broward',
 identifierFormat:'broward-folio',bounds:[-80.9,25.95,-80.0,26.36]});
const palmBeach=floridaCadastral({id:'FL-palm-beach',county:'Palm Beach',
 identifierFormat:'palm-beach-pcn',bounds:[-80.90,26.31,-79.98,27.00]});
const santaRosa=floridaCadastral({id:'FL-santa-rosa',county:'Santa Rosa',
 identifierFormat:'santa-rosa-surface',bounds:[-87.37,30.30,-86.68,31.05]});
const pilots=Object.freeze({[miami.id]:miami,[broward.id]:broward,[palmBeach.id]:palmBeach,[santaRosa.id]:santaRosa});
export const pilotCountyIds=()=>Object.keys(pilots);
export const countyPilotDefinition=id=>Object.hasOwn(pilots,id)?pilots[id]:null;

export function pilotIdentifier(format,value){
 if(typeof value!=='string')return '';
 if(format==='broward-folio')return /^\d{12}$/.test(value)?value:'';
 if(format==='palm-beach-pcn')
  return /^\d{17}$/.test(value)||/^(?:\d{2}-){5}\d{3}-\d{4}$/.test(value)?value.replaceAll('-',''):'';
 if(format==='santa-rosa-surface'){
  const grouped=/^\d{2}-[1-9][NS]-\d{2}-[A-Z0-9]{4}-[A-Z0-9]{5}-[A-Z0-9]{4}$/;
  const compact=/^\d{2}[1-9][NS]\d{2}[A-Z0-9]{13}$/;
  return grouped.test(value)||compact.test(value)?value.replaceAll('-',''):'';
 }
 if(format==='miami-folio')
  return /^\d{13}$/.test(value)||/^\d{2}-\d{4}-\d{3}-\d{4}$/.test(value)?value.replaceAll('-',''):'';
 return '';
}

export function pilotQueryIdentifiers(format,value){
 const id=pilotIdentifier(format,value);
 if(!id)return [];
 if(format!=='santa-rosa-surface')return [id];
 return [id,[id.slice(0,2),id.slice(2,4),id.slice(4,6),id.slice(6,10),id.slice(10,15),id.slice(15)].join('-')];
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
