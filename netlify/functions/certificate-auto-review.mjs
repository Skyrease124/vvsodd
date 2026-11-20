// Owner-only automated triage. No review decisions, publication or purchase-state changes.
import * as auth from '../lib/auth.mjs';
import {getSnapshot} from './certificate-review.mjs';
import {triageSnapshot,summarizeForAI} from '../lib/certificate-auto-triage.mjs';
import {complete} from '../lib/llm.mjs';

const COUNTIES=new Set(['wakulla','palm-beach','st-johns']);
const reply=(code,obj)=>new Response(JSON.stringify(obj),{status:code,headers:{
  'Content-Type':'application/json','Cache-Control':'private, no-store','X-Robots-Tag':'noindex,nofollow'}});
const storeKey=county=>'cert-triage-v1-'+county;
const textSummary=r=>r.total+' certificates analyzed. '+r.counts.urgent+' urgent conflicts, '+
  r.counts.review+' require verification and '+r.counts.routine+' routine. No record has been approved.';
export default async function handler(req){
  const user=await auth.userFromCookie(req.headers.get('cookie'));
  if(!user)return reply(401,{ok:false,error:'Please sign in.'});
  if(!user.owner)return reply(403,{ok:false,error:'Owner only.'});
  if(!['GET','POST'].includes(req.method))return reply(405,{ok:false,error:'Unsupported method.'});
  const url=new URL(req.url);
  if(req.method==='POST'){
    if(req.headers.get('origin')!==url.origin)return reply(403,{ok:false,error:'Invalid origin.'});
    if(Number(req.headers.get('content-length')||0)>4000)return reply(413,{ok:false,error:'Request too large.'});
  }
  try{
    const body=req.method==='POST'?await req.json():null;
    const county=req.method==='POST'?body?.county:url.searchParams.get('county');
    if(!COUNTIES.has(county))return reply(400,{ok:false,error:'Unsupported county.'});
    const snap=await getSnapshot(county);
    if(req.method==='GET'){
      const stored=await auth.kvGet(storeKey(county));
      if(!stored||stored.snapshotSha256!==snap.hash)
        return reply(200,{ok:true,county,needsScan:true,total:snap.indexed.size,
          message:'No current analysis. Scan this county before reviewing.'});
      const page=Math.min(9999,Math.max(0,Number.parseInt(url.searchParams.get('page')||'0',10)||0));
      const priority=['urgent','review','routine'].includes(url.searchParams.get('priority'))?url.searchParams.get('priority'):'';
      const items=priority?stored.items.filter(x=>x.priority===priority):stored.items;
      return reply(200,{ok:true,county,needsScan:false,summary:stored.summary,scannedAt:stored.scannedAt,
        aiSummary:stored.aiSummary||null,aiModel:stored.aiModel||null,matched:items.length,
        page,items:items.slice(page*30,page*30+30),snapshotSha256:stored.snapshotSha256});
    }
    // A scan is a private recommendation only; the owner must use existing individual review for publication.
    const result=triageSnapshot(snap);
    let aiSummary=null,aiModel=null;
    if(body?.useAI===true && process.env.NVIDIA_API_KEY){
      try{
        const prompt='Write 2 short sentences summarizing the counts and missing evidence. '+
          'No record is verified for purchase or publication. Do not recommend approval, infer status, or invent facts.';
        const response=await complete({key:process.env.NVIDIA_API_KEY},prompt,
          JSON.stringify(summarizeForAI(result)),{maxTokens:150,timeoutMs:12000});
        aiSummary=String(response.text).slice(0,900);
        aiModel=response.model;
      }catch(e){console.warn('Optional triage AI summary unavailable:',e?.message);}
    }
    const stored={snapshotSha256:result.snapshotSha256,scannedAt:new Date().toISOString(),
      items:result.items,summary:{total:result.total,counts:result.counts,sourceCheckedAt:result.sourceCheckedAt,
        message:textSummary(result),ownerApprovalRequired:true,publicationAuthorized:false,
        availableForPurchase:false},aiSummary,aiModel};
    await auth.kvPut(storeKey(county),stored);
    return reply(200,{ok:true,county,scannedAt:stored.scannedAt,summary:stored.summary,
      aiSummary,aiModel,needsScan:false,matched:result.total,page:0,items:stored.items.slice(0,30)});
  }catch(e){
    console.error('Certificate triage:',e?.message);
    return reply(503,{ok:false,error:'Private certificate review is temporarily unavailable.'});
  }
}
