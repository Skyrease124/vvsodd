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
