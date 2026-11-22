import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import * as auth from '../lib/brain-auth.mjs';
import { runConnectorTrial, rearmConnectorTrial } from '../lib/brain-gis-trial-checkpoint.mjs';

import { canDiagnoseLarimer, lookupLarimerAddress, larimerReconciliation } from '../lib/brain-larimer-address-diagnostic.mjs';
import { reconciliationCase, reconciliationQueue } from '../lib/brain-parcel-reconciliation.mjs';

const hostname='deploy-preview-454--pricepocketasset.netlify.app';
const dataset='CO-larimer';
const trialKey='brain-gis-trial-v1-'+dataset;
const diagnosticKey='brain-gis-address-diagnostic-v1-'+dataset;
const budgetKey='brain-gis-trial-budget-v1-'+dataset;
const limit=3;
const ids=['9701400014','8510310018','8510339002'];
const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex'}});
const count=snapshot=>snapshot?.data?.reserved??0;

async function reserve(expectedUsed) {
  const current=await auth.kvGetVersioned(budgetKey);
  const used=count(current);
  if(!Number.isSafeInteger(used)||used<0||used>=limit||(expectedUsed!==undefined&&used!==expectedUsed)||
     !await auth.kvPutVersioned(budgetKey,{reserved:used+1},current?.etag??null)) {
    throw Object.assign(Error('Larimer trial budget is exhausted or busy'),{code:'QUOTA'});
  }
}

async function handler(req,context) {
  const url=new URL(req.url);
  if(url.hostname!==hostname||context?.deploy?.context!=='deploy-preview'||!auth.isBrainPreview())return reply(404,{error:'PR #454 preview only'});
  if(!['GET','POST'].includes(req.method))return reply(405,{error:'GET or POST only'});
  const user=await auth.userFromCookie(req.headers.get('cookie')||'');
  if(!user?.owner)return reply(user?403:401,{error:'Owner access required'});
  if(req.method==='POST'&&req.headers.get('origin')!==url.origin)return reply(403,{error:'Invalid origin'});
  try{
    if(req.method==='GET'){
      const [trial,budget,diagnostic]=await Promise.all([
        auth.kvGetVersioned(trialKey),auth.kvGetVersioned(budgetKey),auth.kvGetVersioned(diagnosticKey)
      ]);
      const finding=larimerReconciliation(diagnostic?.data);
      const cases=reconciliationQueue(finding?[reconciliationCase({
        dataset,recordId:'CO|Larimer|9701400014|',
        original:finding.original,candidate:finding.candidate,
        sources:finding.sources,checkedAt:diagnostic?.data?.checkedAt
      })]:[]);
      return reply(200,{used:count(budget),limit,cursor:trial?.data?.cursor??0,
        retry:trial?.data?.retry??null,evidence:trial?.data?.evidence??[],parcelIds:ids,
        addressDiagnostic:diagnostic?.data??null,reconciliation:finding,
        reconciliationCases:cases,
        canRunAddressDiagnostic:canDiagnoseLarimer(trial?.data,count(budget),diagnostic)});
    }
    const raw=await req.text();
    let body;
    try{if(raw.length>128)throw Error();body=JSON.parse(raw);}catch{return reply(400,{error:'Invalid trial request'});}
    if(!['verify-next-larimer','rearm-larimer-review','diagnose-larimer-address'].includes(body?.action)||body.confirmed!==true)return reply(400,{error:'Explicit trial confirmation required'});
    if(body.action==='diagnose-larimer-address'){
      const [trial,budget,saved]=await Promise.all([
        auth.kvGetVersioned(trialKey),auth.kvGetVersioned(budgetKey),auth.kvGetVersioned(diagnosticKey)
      ]);
      if(!canDiagnoseLarimer(trial?.data,count(budget),saved))return reply(409,{error:'Final address diagnostic requires the original zero-result review and exactly one remaining slot'});
      try{await reserve(2);}catch(error){
        if(error.code==='QUOTA')return reply(429,{error:'Larimer trial slot unavailable'});
        throw error;
      }
      const diagnostic=await lookupLarimerAddress();
      if(!await auth.kvPutVersioned(diagnosticKey,diagnostic,null))throw Error('Diagnostic storage unavailable');
      return reply(200,{addressDiagnostic:diagnostic});
    }
    if(count(await auth.kvGetVersioned(budgetKey))>=limit)return reply(429,{error:'Larimer trial budget is exhausted'});
    const root=process.env.LAMBDA_TASK_ROOT||process.cwd();
    const data=JSON.parse(await readFile(join(root,'kinvest-liens/map/data/CO-larimer.json'),'utf8'));
    if(data.id!==dataset||!Array.isArray(data.recs))throw Error('Unexpected Larimer dataset');
    const records=ids.map(id=>{
      const matches=data.recs.filter(record=>record.p===id);
      if(matches.length!==1||matches[0].g||matches[0].cx)throw Error('Trial parcel missing, ambiguous, or already mapped');
      const {i,p,a}=matches[0];
      return {i,p,a:a==null?null:data.dict?.a?.[a]??a};
    });
    const overlay=await auth.kvGet('brain-map-county-v1-'+dataset);
    if(records.some(record=>overlay?.records?.[record.i]))return reply(409,{error:'A trial parcel already has a map correction'});
    const revision=createHash('sha256').update(JSON.stringify(records)).digest('hex');
    if(body.action==='rearm-larimer-review'){
      // Owner approves releasing only the current held parcel; no request is sent yet.
      const snapshot=await auth.kvGetVersioned(trialKey);
      const cursor=snapshot?.data?.cursor;
      if(!Number.isSafeInteger(cursor)||!records[cursor]||
         body.recordId!==records[cursor].i||
         snapshot?.data?.retry?.recordId!==body.recordId||
         snapshot?.data?.retry?.exhausted!==true)return reply(409,{error:'Exact held parcel review required'});
      try{
        const released=await rearmConnectorTrial({environment:context.deploy.context,dataset,revision,
          recordId:body.recordId,storage:{read:auth.kvGetVersioned,write:auth.kvPutVersioned}});
        return reply(200,released);
      }catch{return reply(409,{error:'Review checkpoint changed or unavailable. Refresh status.'});}
    }
    const result=await runConnectorTrial({environment:context.deploy.context,dataset,revision,records,reserve:()=>reserve(),
      storage:{read:auth.kvGetVersioned,write:auth.kvPutVersioned}});
    return reply(200,result);
  }catch{
    return reply(503,{error:'Larimer trial unavailable. Check saved status before retrying.'});
  }
}
export default auth.withBrainStore(handler);
