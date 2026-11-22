import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import * as auth from '../lib/brain-auth.mjs';
import {countyPilotDefinition,eligiblePilotRows} from '../lib/brain-gis-pilot-registry.mjs';
import {countyCheckpointKey,readCountyBudget,runCountyResearch,SHARED_COUNTY_DAILY_LIMIT} from '../lib/brain-gis-county-worker.mjs';

const previewOrigin='https://deploy-preview-454--pricepocketasset.netlify.app';
const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex'}});
async function handler(req,context){
 const url=new URL(req.url);
 if(context?.deploy?.context!=='deploy-preview'||url.origin!==previewOrigin||!auth.isBrainPreview())
  return reply(404,{error:'PR #454 preview only'});
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return reply(user?403:401,{error:'Owner access required'});
 if(!['GET','POST'].includes(req.method))return reply(405,{error:'GET or POST only'});
 const config=countyPilotDefinition(url.searchParams.get('dataset'));
 if(!config)return reply(404,{error:'County pilot unavailable'});
 const storage={read:auth.kvGetVersioned,write:auth.kvPutVersioned};
 const key=countyCheckpointKey(config.id);
 const active=config.enabled&&config.approval?.day===new Date().toISOString().slice(0,10);
 try{
  const root=join(process.env.LAMBDA_TASK_ROOT||process.cwd(),'kinvest-liens','map','data');
  const data=JSON.parse(await readFile(join(root,config.id+'.json'),'utf8'));
  const rows=eligiblePilotRows(config,data);
  const revision=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const saved=await storage.read(key),state=saved?.data;
  const cursor=state?.cursor??0;
  if(req.method==='GET'){
   const [quota,overlay]=await Promise.all([readCountyBudget(storage),auth.kvGet('brain-map-county-v1-'+config.id)]);
   const published=rows.filter(row=>{const patch=overlay?.records?.[row.i];
    return patch?.verifiedGeometry===true&&patch.i===row.i&&patch.p===row.p&&Array.isArray(patch.g)&&patch.g.length;}).length;
   const used=quota?.counties?.[config.id]??0;
   return reply(200,{active,cursor,eligible:rows.length,processed:cursor,
    verifiedEvidence:Object.keys(state?.evidence||{}).length,published,review:state?.review||{},
    lastSuccessfulAt:state?.lastSuccessfulAt??null,sourceHealth:state?.sourceHealth??null,
    paused:state?.paused===true,sharedRemaining:Math.max(0,SHARED_COUNTY_DAILY_LIMIT-(quota?.total??0)),
    countyRemaining:Math.max(0,config.requestLimit-used),pilotLimit:3,
    blockers:active?[]:['Owner approval for a live pilot is pending']});
  }
  if(req.headers.get('origin')!==url.origin)return reply(403,{error:'Invalid origin'});
  const raw=await req.text();
  if(raw.length>600)return reply(400,{error:'Request too large'});
  let body;
  try{body=JSON.parse(raw);}catch{return reply(400,{error:'Invalid request'});}
  if(body?.confirmed!==true||!['run','pause','resume','retry'].includes(body.action))
   return reply(400,{error:'Explicit owner confirmation required'});
  if(!active)return reply(409,{error:'County pilot awaits explicit approval and activation'});
  if(body.cursor!==cursor||state&&state.revision!==revision)
   return reply(409,{error:'Saved county checkpoint changed'});
  if(['pause','resume'].includes(body.action)){
   if(Date.parse(state?.lockedUntil)>Date.now())return reply(409,{error:'Wait for the active batch to finish'});
   const next={...(state||{revision,cursor,review:{},evidence:{},retryHistory:[],events:[]}),paused:body.action==='pause'};
   next.eventSequence=(next.eventSequence??0)+1;
   next.events=[...next.events,{id:next.eventSequence,at:new Date().toISOString(),status:next.paused?'owner_paused':'owner_resumed'}].slice(-100);
   if(!await storage.write(key,next,saved?.etag??null))return reply(409,{error:'Saved county checkpoint changed'});
   return reply(200,{paused:next.paused});
  }
  if(body.action==='retry'&&(!Number.isSafeInteger(body.review?.index)||typeof body.review?.parcelId!=='string'||
    typeof body.review?.checkedAt!=='string'))return reply(400,{error:'Exact review entry required'});
  const result=await runCountyResearch({config,rows,revision,storage,
   authorization:{owner:true,preview:true,confirmed:true,dataset:config.id,permitId:config.approval.id,cursor},
   retry:body.action==='retry'?body.review:null});
  return reply(200,{cursor:result.cursor,sourceHealth:result.sourceHealth??null});
 }catch(error){
  if(error.scope==='control')return reply(409,{error:error.message});
  return reply(503,{error:'County pilot status temporarily unavailable'});
 }
}
export default auth.withBrainStore(handler);
