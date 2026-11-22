import * as auth from '../lib/brain-auth.mjs';
import { researchKey,pilot,larimerSources,newResearchState,summarizeResearch } from '../lib/brain-reconciliation-research.mjs';

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
   return response(200,{pilot,sources:larimerSources,paused:state.paused,executionEnabled:false,
    evidence:state.evidence,...summarizeResearch(pilot,state.evidence,state.lastAttempt)});
  }
  let body;try{const raw=await req.text();if(raw.length>128)throw Error();body=JSON.parse(raw);}catch{return response(400,{error:'Invalid request'});}
  if(body?.confirmed!==true||!['pause','resume'].includes(body.action))return response(400,{error:'Confirm pause or resume'});
  const snapshot=await auth.kvGetVersioned(researchKey);
  const state=snapshot?.data??newResearchState();
  const paused=body.action==='pause';
  if(state.paused!==paused&&!await auth.kvPutVersioned(researchKey,{...state,paused},snapshot?.etag??null))return response(409,{error:'Research state changed. Refresh.'});
  return response(200,{paused,executionEnabled:false});
 }catch{return response(503,{error:'Reconciliation research status unavailable'});}
}
export default auth.withBrainStore(handler);
