import { connectorFor, verifyTrial } from './brain-gis-connectors.mjs';

// Explicit preview trial only, with caller-supplied versioned storage and budget.
// The owner-only trial endpoint supplies the isolated budget and storage.
export async function runConnectorTrial({environment,dataset,revision,records,storage,reserve,fetcher,now=()=>new Date()}) {
  if(environment!=='deploy-preview'||connectorFor(dataset)?.mode!=='test-only')throw Error('Preview trial only');
  if(typeof revision!=='string'||!revision||typeof reserve!=='function')throw Error('Trial revision and budget required');
  const key='brain-gis-trial-v1-'+dataset;
  const snapshot=await storage.read(key);
  let state=snapshot?.data??{revision,cursor:0,retry:null,evidence:[]};
  if(state.revision!==revision)throw Error('Source revision changed; review existing checkpoint');
  const at=now().getTime();
  if(state.lockUntil>at)return {status:'busy',cursor:state.cursor};
  if(state.retry?.exhausted||state.retry?.nextAt>at)return {status:'retry_hold',cursor:state.cursor,retry:state.retry};
  if(!records[state.cursor])return {status:'complete',cursor:state.cursor};
  const lease=await storage.write(key,{...state,lockUntil:at+60000},snapshot?.etag??null);
  if(!lease)return {status:'busy',cursor:state.cursor};
  const record=records[state.cursor];
  try{
    if(records.filter(r=>r?.i===record.i).length!==1)throw Error('Duplicate trial record');
    const evidence=await verifyTrial({dataset,record,reserve,fetcher,now});
    state={...state,cursor:state.cursor+1,retry:null,evidence:[...state.evidence,evidence].slice(-50)};
  }catch(error){
    if(error.code!=='QUOTA'){
      const attempts=(state.retry?.attempts??0)+1;
      state={...state,retry:{recordId:record.i,attempts,
        exhausted:!error.retryable||attempts>=3,nextAt:now().getTime()+60000*attempts,
        checkedAt:error.diagnostics?.checkedAt??now().toISOString(),source:connectorFor(dataset).source,
        reason:String(error.message).slice(0,140),diagnostics:error.diagnostics??null}};
    }
  }
  if(!await storage.write(key,{...state,lockUntil:null},lease))throw Error('Trial checkpoint changed');
  return {status:state.retry?'retry_hold':state.cursor===(snapshot?.data?.cursor??0)?'budget_hold':'recorded',cursor:state.cursor,retry:state.retry};
}
