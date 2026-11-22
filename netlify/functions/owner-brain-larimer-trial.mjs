import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import * as auth from '../lib/brain-auth.mjs';
import { runConnectorTrial } from '../lib/brain-gis-trial-checkpoint.mjs';

const hostname='deploy-preview-454--pricepocketasset.netlify.app';
const dataset='CO-larimer';
const trialKey='brain-gis-trial-v1-'+dataset;
const budgetKey='brain-gis-trial-budget-v1-'+dataset;
const limit=3;
const ids=['9701400014','8510310018','8510339002'];
const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex'}});
const count=snapshot=>snapshot?.data?.reserved??0;

async function reserve() {
  const current=await auth.kvGetVersioned(budgetKey);
  const used=count(current);
  if(!Number.isSafeInteger(used)||used<0||used>=limit||
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
      const [trial,budget]=await Promise.all([auth.kvGetVersioned(trialKey),auth.kvGetVersioned(budgetKey)]);
      return reply(200,{used:count(budget),limit,cursor:trial?.data?.cursor??0,
        retry:trial?.data?.retry??null,evidence:trial?.data?.evidence??[],parcelIds:ids});
    }
    const raw=await req.text();
    let body;
    try{if(raw.length>128)throw Error();body=JSON.parse(raw);}catch{return reply(400,{error:'Invalid trial request'});}
    if(body?.action!=='verify-next-larimer'||body.confirmed!==true)return reply(400,{error:'Explicit trial confirmation required'});
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
    const result=await runConnectorTrial({environment:context.deploy.context,dataset,revision,records,reserve,
      storage:{read:auth.kvGetVersioned,write:auth.kvPutVersioned}});
    return reply(200,result);
  }catch{
    return reply(503,{error:'Larimer trial unavailable. Check saved status before retrying.'});
  }
}
export default auth.withBrainStore(handler);
