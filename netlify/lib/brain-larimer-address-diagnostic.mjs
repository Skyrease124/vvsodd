import { connectorFor } from './brain-gis-connectors.mjs';

export const larimerDiagnosticRecord = 'CO|Larimer|9701400014|';
const source = connectorFor('CO-larimer').source;
const where = "LOCADDRESS = '741 LINDENMEIER RD' AND LOCCITY = 'FORT COLLINS'";
const fields = 'PARCELNUM,SCHEDNUM,LOCADDRESS,LOCCITY,OBJECTID_1';
const address = '741 LINDENMEIER RD';
const city = 'FORT COLLINS';

export function canDiagnoseLarimer(trial,used,saved) {
  return !saved&&used===2&&trial?.cursor===0&&trial.retry?.recordId===larimerDiagnosticRecord&&
    trial.retry.exhausted===true&&trial.retry.diagnostics?.reasonCode==='zero_results';
}

const clean = (value, pattern) => typeof value==='string'&&pattern.test(value.trim())?value.trim():null;
const exactLabel = (value, expected) => typeof value==='string'&&value.trim().toUpperCase()===expected?expected:null;

// This query can return a research lead. It cannot verify identity or publish.
export async function lookupLarimerAddress({fetcher=fetch,now=()=>new Date()}={}) {
  const params=new URLSearchParams({f:'json',where,outFields:fields,resultRecordCount:'2',returnGeometry:'false'});
  const result={kind:'address_research_only',recordId:larimerDiagnosticRecord,source,where,
    checkedAt:null,httpStatus:null,arcgisStatus:null,transferLimit:null,resultCount:null,status:'provider_unavailable',rows:[]};
  const finish=()=>({...result,checkedAt:now().toISOString()});
  try{
    const response=await fetcher(source+'/query?'+params,{redirect:'error',signal:AbortSignal.timeout(8000)});
    result.httpStatus=response.status;
    if(!response.ok)return finish();
    const raw=await response.text();
    if(raw.length>65536){result.status='invalid_response';return finish();}
    const data=JSON.parse(raw);
    result.arcgisStatus=Number.isSafeInteger(data?.error?.code)?data.error.code:null;
    result.transferLimit=Boolean(data?.exceededTransferLimit);
    if(data?.error)return finish();
    if(!Array.isArray(data?.features)){result.status='invalid_response';return finish();}
    result.resultCount=data.features.length;
    if(result.transferLimit||result.resultCount>2){result.status='incomplete';return finish();}
    result.rows=data.features.map(feature=>{
      const a=feature?.attributes;
      return {
      parcelId:clean(a?.PARCELNUM,/^[0-9.-]{1,16}$/),
      schedule:clean(a?.SCHEDNUM,/^[RPMrpm]?[0-9]{1,7}$/),
      address:exactLabel(a?.LOCADDRESS,address),
      city:exactLabel(a?.LOCCITY,city),
      objectId:Number.isSafeInteger(a?.OBJECTID_1)&&a.OBJECTID_1>0?a.OBJECTID_1:null
      };
    });
    result.status=result.resultCount===0?'no_results':result.resultCount===2?'ambiguous':
      result.rows[0].address&&result.rows[0].city?'research_lead':'address_mismatch';
    return finish();
  }catch{return finish();}
}

// Source-controlled research notes plus the timestamp from the saved preview
// response. This read-only projection cannot promote a parcel or edit its ID.
const reconciliationSources=Object.freeze([
  Object.freeze({
    authority:'Larimer County Treasurer', date:'2026-11-11',
    url:'https://www.larimer.gov/treasurer/thirdparty/liens/sale',
    finding:'The saved sale import lists parcel 9701400014 and schedule 0155675 for 741 Lindenmeier Rd.'
  }),
  Object.freeze({
    authority:'City of Fort Collins Planning', date:'2024-11-13', reviewedAt:'2026-11-22T02:09:07Z',
    url:'https://accela-aca.fcgov.com/CitizenAccess/Cap/CapDetail.aspx?Module=Planning&TabName=Planning&agencyCode=FTCOLLINS&capID1=24CAP&capID2=00000&capID3=00142',
    finding:'Glover Estate review BDR240012 approved a minor subdivision with plat at this address and identifies parcel 9701400014. The original parcel description starts from offsets near the southeast corner of Section 1, Township 7, Range 69 and runs 136 feet west, 43 north, 136 east and 43 south. This is the planning record’s description of the original tract; it supplies no Recorder reception number or current parcel cross-reference.'
  }),
  Object.freeze({
    authority:'Larimer County Clerk & Recorder', date:'2026-11-22',
    url:'https://www.larimer.gov/clerk/recording/easy-access',
    finding:'Easy Access provides a recorded-document index. Anonymous users cannot view document images. No recorded Glover Estate plat or reception number was located in the publicly accessible sources reviewed.'
  }),
  Object.freeze({
    authority:'Larimer County Assessor', date:'2026-11-22',
    url:'https://www.larimer.gov/assessor/search',
    finding:'The Assessor offers parcel and schedule searches. No Assessor parcel-history record linking these two identifier pairs was located in the publicly accessible sources reviewed.'
  })
]);

export function larimerReconciliation(diagnostic) {
  const row=diagnostic?.rows?.[0];
  if(diagnostic?.kind!=='address_research_only'||diagnostic.recordId!==larimerDiagnosticRecord||
     diagnostic.status!=='research_lead'||diagnostic.resultCount!==1||diagnostic.rows?.length!==1||
     diagnostic.source!==source||diagnostic.transferLimit!==false||
     row?.parcelId!=='9701484001'||row.schedule!=='1688587'||row.objectId!==5665923||
     row.address!==address||row.city!==city||!Number.isFinite(Date.parse(diagnostic.checkedAt)))return null;
  return {
    status:'unresolved',
    original:{parcelId:'9701400014',schedule:'0155675'},
    candidate:{parcelId:row.parcelId,schedule:row.schedule,objectId:row.objectId},
    explanation:'The planning approval documents a subdivision proposal and the original tract description. It does not distinguish a whole-parcel renumbering, a split affecting only part of that tract, or a different legal parcel sharing the address.',
    sources:[...reconciliationSources,{
      authority:'Larimer County Tax Parcels GIS', date:diagnostic.checkedAt, url:source,
      finding:'The stored address query returned parcel 9701484001, schedule 1688587, and object 5665923 at the same situs address.'
    }],
    nextEvidence:'Obtain the recorded Glover Estate plat image, reception number, and date. Compare its parent description and recorded lots with the original tract, then obtain the Assessor split or renumbering history linking each parcel and schedule to a recorded lot. Keep on owner review until confirmed.'
  };
}
