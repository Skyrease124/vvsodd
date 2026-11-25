import { researchKey,pilot,newResearchState } from './brain-reconciliation-research.mjs';

export const planningSource=Object.freeze({
 id:'fort_collins_planning',authority:'City of Fort Collins Planning',
 url:'https://accela-aca.fcgov.com/CitizenAccess/Cap/CapDetail.aspx?Module=Planning&TabName=Planning&agencyCode=FTCOLLINS&capID1=24CAP&capID2=00000&capID3=00142'
});
const maxBytes=512*1024;
const leaseMs=15000;

async function boundedText(response){
 const reader=response.body?.getReader();
 if(!reader)return '';
 const decoder=new TextDecoder();
 let size=0,text='';
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)return text+decoder.decode();
   size+=value.byteLength;
   if(size>maxBytes)throw Error('Record exceeds response limit');
   text+=decoder.decode(value,{stream:true});
  }
 }finally{
  await reader.cancel().catch(()=>{});
 }
}

export async function collectPlanningRecord({fetcher=fetch}={}){
 let httpStatus=null;
 try{
  const res=await fetcher(planningSource.url,{method:'GET',redirect:'manual',
   credentials:'omit',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});
  httpStatus=res.status;
  if(httpStatus===401||httpStatus===403||[301,302,303,307,308].includes(httpStatus))return {outcome:'restricted',httpStatus};
  if(httpStatus===404||httpStatus===410)return {outcome:'missing',httpStatus};
  if(!res.ok||!res.headers.get('content-type')?.toLowerCase().startsWith('text/html'))return {outcome:'unavailable',httpStatus};
  const html=await boundedText(res);
  const text=html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
   .replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/gi,' ').replace(/\s+/g,' ');
  if(/verify (?:that )?you are human|access denied|sign in to (?:continue|view this record)/i.test(text))return {outcome:'restricted',httpStatus};
  if(!/\bBDR240012\b/i.test(text)||!/\bGlover Estate\b/i.test(text)||
     !/\b741 Lindenmeier (?:Rd|Road)\b/i.test(text)||!/\b9701400014\b/.test(text))return {outcome:'missing',httpStatus};
  const decision=text.match(/\bDecision:\s*(Approved|Denied)\s+Decision Date:\s*(\d{2}\/\d{2}\/\d{4})\b/i);
  return {outcome:'document',httpStatus,document:{type:'planning_record',reference:'BDR240012',title:'Glover Estate',
   originalParcel:pilot.originalParcel,address:'741 Lindenmeier Rd, Fort Collins',
   decision:decision?.[1]?.toLowerCase()??null,decisionDate:decision?.[2]??null,
   relationship:null}};
 }catch{return {outcome:'unavailable',httpStatus};}
}

export function planningTestStatus(state,now=Date.now()){
 const test=state?.planningTest;
 if(!test)return 'available';
 if(test.completedAt)return 'completed';
 return test.leaseUntil>now?'running':'interrupted';
}

export async function runOnePlanningTest({storage,environment,confirmed,fetcher,now=()=>new Date()}){
 if(environment!=='deploy-preview'||confirmed!==true)throw Error('Owner-confirmed preview research only');
 const snapshot=await storage.read(researchKey);
 const state=snapshot?.data??newResearchState();
 const at=now();
 if(state.paused)return {status:'paused'};
 if(state.planningTest)return {status:planningTestStatus(state,at.getTime())};
 const claimed={...state,planningTest:{reservedAt:at.toISOString(),leaseUntil:at.getTime()+leaseMs}};
 const version=await storage.write(researchKey,claimed,snapshot?.etag??null);
 if(!version)return {status:'busy'};
 const result=await collectPlanningRecord({fetcher});
 const completedAt=now().toISOString();
 const evidence={sourceId:planningSource.id,authority:planningSource.authority,url:planningSource.url,
  at:completedAt,outcome:result.outcome,httpStatus:result.httpStatus,document:result.document??null};
 const event={id:pilot.id+'|planning-test|1',at:completedAt,sourceId:planningSource.id,outcome:result.outcome};
 const next={...claimed,planningTest:{...claimed.planningTest,completedAt},
  lastAttempt:evidence,evidence:[...state.evidence,evidence].slice(-50),events:[...state.events,event].slice(-50)};
 if(!await storage.write(researchKey,next,version))return {status:'interrupted'};
 return {status:'completed',outcome:result.outcome};
}
