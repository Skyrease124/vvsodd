// Production-only Netlify scheduler. Disabled by default. This must never run
// on a Deploy Preview: previews use a separate persistent namespace.
import * as auth from '../lib/brain-auth.mjs';
import {runScheduledWayne} from './owner-brain-wayne-run.mjs';
const KEY='owner-brain-wayne-schedule-audit-v1';
const CONTROL='owner-brain-wayne-scheduler-control-v1';
// In production the owner website controls this persistent toggle; missing means OFF.
const enabled=async()=>{
 const setting=await auth.kvGet(CONTROL);
 return setting?.enabled===true && setting?.approvedForProduction===true;
};
export const config={schedule:'*/30 * * * *'};
export default async function scheduled(req,context){
 if(context?.deploy?.context!=='production'||context.deploy.published!==true)return new Response(null,{status:204});
 const start=new Date().toISOString();
 const isEnabled=await enabled();
 // The schedule is deliberately inert until production release approval.
 if(!isEnabled){console.log('Scheduled Wayne worker disabled by website owner control');return new Response(null,{status:204});}
 let info={at:start,status:'running',environment:'production'};
 try{
  const synthetic=new Request('https://pricepocketasset.com/.netlify/functions/owner-brain-wayne-run',{method:'POST'});
  const result=await runScheduledWayne(synthetic,context);
  const body=await result.json();
  info={...info,status:result.ok?'completed':'blocked',httpStatus:result.status,
   state:body.state||null,cursor:Number.isSafeInteger(body.cursor)?body.cursor:null,
   attempted:Number(body.attempted||0),published:Number(body.published||0),
   dailyUsed:Number(body.dailyUsed||0),retryAt:body.retry?.nextAt||null,
   reason:result.ok?null:String(body.error||'Worker blocked').slice(0,160)};
  console.log('Scheduled Wayne batch',JSON.stringify(info));
 }catch(e){
  info={...info,status:'error',reason:String(e.message||e).slice(0,160)};
  console.error('Scheduled Wayne batch failed',info.reason);
 }
 // Never let an audit-write failure trigger an automatic replay.
 try{
  const last=await auth.kvGet(KEY)||{runs:0};
  await auth.kvPut(KEY,{runs:(last.runs||0)+1,last:info});
 }catch(e){console.error('Wayne scheduled audit unavailable',String(e.message||e).slice(0,120));}
 return new Response(null,{status:204});
}
