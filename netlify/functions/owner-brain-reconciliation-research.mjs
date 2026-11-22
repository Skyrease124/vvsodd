import { randomUUID } from 'node:crypto';
import * as auth from '../lib/brain-auth.mjs';
import { researchKey,pilot,larimerSources,newResearchState,summarizeResearch,nextResearchSource,runParcelResearch } from '../lib/brain-reconciliation-research.mjs';

import { planningSource, planningTestStatus, runOnePlanningTest } from '../lib/brain-reconciliation-planning-test.mjs';

import { sourceDescriptors, collectSourceMetadata } from '../lib/brain-reconciliation-source-adapters.mjs';

const response=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex'}});
async function handler(req,context){
 const url=new URL(req.url);
 if(url.hostname!=='deploy-preview-454--pricepocketasset.netlify.app'||context?.deploy?.context!=='deploy-preview'||!auth.isBrainPreview())return response(404,{error:'PR #454 preview only'});
 if(!['GET','POST'].includes(req.method))return response(405,{error:'GET or POST only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return response(user?403:401,{error:'Owner access required'});
 if(req.method==='POST'&&req.headers.get('origin')!==url.origin)return response(403,{error:'Invalid origin'});
 try{
  if(req.method==='GET'){
   const state=(await auth.kvGetVersioned(researchKey))?.data??newResearchState();
   return response(200,{pilot,sources:[planningSource,...sourceDescriptors],paused:state.paused,executionEnabled:false,planningTestStatus:planningTestStatus(state),
    nextSource:nextResearchSource(state),retryAt:state.retryAt??null,
    sourceProgress:{reviewed:nextResearchSource(state)?.index??larimerSources.length,total:larimerSources.length},
    researchBusy:(state.lockUntil??0)>Date.now(),events:state.events,evidence:state.evidence,...summarizeResearch(pilot,state.evidence,state.lastAttempt)});
  }
  let body;try{const raw=await req.text();if(raw.length>128)throw Error();body=JSON.parse(raw);}catch{return response(400,{error:'Invalid request'});}
  if(body?.confirmed!==true||!['pause','resume','run-one-planning-test','run-next-source'].includes(body.action))return response(400,{error:'Explicit owner confirmation required'});
  if(body.action==='run-next-source'){
   if(!larimerSources.some(s=>s.id===body.sourceId)||!Number.isSafeInteger(body.used)||body.used<0)return response(400,{error:'Confirm the displayed source and request count'});
   const before=(await auth.kvGetVersioned(researchKey))?.data;
   if(planningTestStatus(before)!=='completed')return response(409,{error:'Finish the existing planning test before running another source'});
   const result=await runParcelResearch({environment:context.deploy.context,enabled:true,key:researchKey,record:pilot,
    sources:larimerSources,storage:{read:auth.kvGetVersioned,write:auth.kvPutVersioned},collect:collectSourceMetadata,
    expected:{id:body.sourceId,used:body.used}});
   const complete=['metadata','document','missing','restricted','unavailable'].includes(result.status);
   return response(complete?200:409,complete?result:{...result,error:'Research source unavailable: '+result.status});
  }
  if(body.action==='run-one-planning-test'){
   const result=await runOnePlanningTest({environment:context.deploy.context,confirmed:true,
    storage:{read:auth.kvGetVersioned,write:auth.kvPutVersioned}});
   return response(result.status==='completed'?200:409,result.status==='completed'?result:
    {...result,error:'Research test unavailable: '+result.status});
  }
  const snapshot=await auth.kvGetVersioned(researchKey);
  const state=snapshot?.data??newResearchState();
  if(planningTestStatus(state)==='running'||state.lockUntil>Date.now())return response(409,{error:'Research test in progress'});
  const paused=body.action==='pause';
  if(state.paused!==paused&&!await auth.kvPutVersioned(researchKey,{...state,paused,events:[...state.events,{id:'owner-control-'+randomUUID(),at:new Date().toISOString(),sourceId:'owner',outcome:paused?'paused':'resumed'}].slice(-50)},snapshot?.etag??null))return response(409,{error:'Research state changed. Refresh.'});
  return response(200,{paused,executionEnabled:false});
 }catch{return response(503,{error:'Reconciliation research status unavailable'});}
}
export default auth.withBrainStore(handler);
