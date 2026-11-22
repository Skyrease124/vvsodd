// Research records are intentionally separate from GIS, parcel verification and publication.
export const researchKey='brain-reconciliation-research-v1-CO-larimer';
export const pilot=Object.freeze({
 id:'CO|Larimer|9701400014|', originalParcel:'9701400014', originalSchedule:'0155675',
 candidateParcel:'9701484001', candidateSchedule:'1688587'
});
export const larimerSources=Object.freeze([
 Object.freeze({id:'assessor',authority:'Larimer County Assessor',url:'https://www.larimer.gov/assessor/search',limit:2}),
 Object.freeze({id:'treasurer',authority:'Larimer County Treasurer',url:'https://www.larimer.gov/treasurer/thirdparty/liens/sale',limit:2}),
 Object.freeze({id:'recorder',authority:'Larimer County Clerk & Recorder',url:'https://www.larimer.gov/clerk/recording/easy-access',limit:2})
]);
export const newResearchState=()=>({paused:true,cursor:0,reservations:{},evidence:[],events:[]});
const token=value=>typeof value==='string'&&/^[A-Za-z0-9.-]{1,40}$/.test(value)?value:null;
const pairFields=['originalParcel','originalSchedule','candidateParcel','candidateSchedule'];
const matches=(document,record)=>pairFields.every(key=>document[key]===record[key]);

function documentFrom(source, raw){
 if(!raw||!['recorded_plat','assessor_history','treasurer_cross_reference'].includes(raw.type))return null;
 const effective=token(raw.receptionNumber||raw.reference);
 if(!effective)return null;
 const scopedType={recorder:'recorded_plat',assessor:'assessor_history',treasurer:'treasurer_cross_reference'};
 if(scopedType[source.id]!==raw.type)return null;
 return {type:raw.type,reference:effective,receptionNumber:token(raw.receptionNumber),
  legalDescription:typeof raw.legalDescription==='string'?raw.legalDescription.slice(0,300):null,
  relationship:['successor','split','unrelated'].includes(raw.relationship)?raw.relationship:null,
  ...Object.fromEntries(pairFields.map(key=>[key,token(raw[key])]))};
}

export function summarizeResearch(record,evidence=[],lastAttempt=null){
 const documents=evidence.filter(item=>item.document).map(item=>item.document);
 const assumptions=documents.filter(d=>d.relationship&&matches(d,record));
 const crossReferences=assumptions.filter(d=>d.type!=='recorded_plat');
 const plat=documents.find(d=>d.type==='recorded_plat'&&d.receptionNumber&&d.legalDescription&&matches(d,record));
 const assertions=assumptions.map(d=>d.relationship);
 const conflicting=assertions.includes('unrelated')||new Set(assertions).size>1||
  documents.some(d=>d.relationship&&d.originalParcel===record.originalParcel&&d.candidateParcel&&!matches(d,record));
 const supported=!!plat&&crossReferences.length>0&&!conflicting;
 const missing=[];
 if(!plat)missing.push('Recorded plat with reception number, legal lot description and both identifier pairs');
 if(!crossReferences.length)missing.push('Official Assessor history or Treasurer cross-reference linking both parcel and schedule pairs');
 return {status:conflicting?'Unresolved':supported?'Relationship Supported':documents.length?'Document Found':lastAttempt?'Unresolved':'Research Lead',
  relationship:supported?crossReferences[0].relationship:null,recordedDocument:plat?.receptionNumber??null,
  evidenceComplete:supported,conflicting,lastAttempt,missing,ownerReview:true,publicationAllowed:false};
}

export function nextResearchSource(state,sources=larimerSources) {
 let index=state.cursor;
 while(sources[index]&&(state.reservations[sources[index].id]??0)>=sources[index].limit)index++;
 const source=sources[index];
 return source?{...source,index,used:state.reservations[source.id]??0}:null;
}

// One bounded action. Production and unattended callers cannot enable it.
export async function runParcelResearch({environment,enabled=false,key,record,sources,storage,collect,expected,now=()=>new Date()}){
 if(environment!=='deploy-preview'||!enabled)throw Error('Preview research execution is disabled');
 if(!/^brain-reconciliation-research-v1-[A-Z]{2}-[a-z0-9-]+$/.test(key)||typeof collect!=='function')throw Error('Invalid research configuration');
 const snapshot=await storage.read(key);
 const state=snapshot?.data??newResearchState();
 const start=now().getTime();
 if(state.paused)return {status:'paused'};
 if(state.lockUntil>start)return {status:'busy'};
 if(state.retryAt>start)return {status:'backoff'};
 const source=nextResearchSource(state,sources);
 if(!source)return {status:'complete'};
 const approved=larimerSources.find(item=>item.id===source.id&&item.url===source.url&&item.authority===source.authority);
 if(!approved||source.limit!==approved.limit||key!==researchKey||record.id!==pilot.id||!matches(record,pilot))throw Error('Source or record not approved');
 const url=new URL(source.url);
 if(url.protocol!=='https:'||url.username||url.password||!source.authority||
    !Number.isInteger(source.limit)||source.limit<1||source.limit>3)throw Error('Invalid reviewed source');
 const used=source.used;
 if(expected&&(expected.id!==source.id||expected.used!==used))return {status:'stale'};
 if(used>=source.limit)return {status:'source_limit'};
 const eventId=record.id+'|'+source.id+'|'+(used+1);
 const started=expected?[...state.events,{id:eventId+'|started',at:new Date(start).toISOString(),sourceId:source.id,outcome:'started'}].slice(-50):state.events;
 const claimed={...state,events:started,cursor:source.index,lockUntil:start+60000,reservations:{...state.reservations,[source.id]:used+1}};
 const lease=await storage.write(key,claimed,snapshot?.etag??null);
 if(!lease)return {status:'busy'};
 let result;
 try{result=await collect(source,record,{signal:AbortSignal.timeout(8000)});}catch{result={status:'unavailable'};}
 const status=['document','missing','restricted','unavailable','metadata'].includes(result?.status)?result.status:'unavailable';
 const document=status==='document'?documentFrom(source,result.document):null;
 const outcome=status==='document'&&!document?'missing':status;
 const at=now().toISOString();
 const httpStatus=Number.isInteger(result?.httpStatus)&&result.httpStatus>=100&&result.httpStatus<=599?result.httpStatus:null;
 const metadata=outcome==='metadata'?{
  title:typeof result.metadata?.title==='string'?result.metadata.title.slice(0,80):null,
  imageAccess:result.metadata?.imageAccess==='authorized_access_required'?'authorized_access_required':'not_checked'
 }:null;
 const evidence={sourceId:source.id,authority:source.authority,url:source.url,at,outcome,document,metadata,httpStatus};
 const duplicate=state.evidence.some(e=>e.sourceId===source.id&&e.document?.reference===document?.reference&&e.outcome===outcome&&
   JSON.stringify(e.document??null)===JSON.stringify(document));
 const event={id:eventId,at,sourceId:source.id,outcome,httpStatus};
 const retry=outcome==='unavailable'&&used+1<source.limit;
 const next={...claimed,lockUntil:null,cursor:retry?source.index:source.index+1,
  retryAt:retry?now().getTime()+60000*2**used:null,lastAttempt:evidence,
  evidence:duplicate?state.evidence:[...state.evidence,evidence].slice(-50),
  events:[...claimed.events,event].slice(-50)};
 if(expected&&document&&summarizeResearch(record,next.evidence).conflicting&&!summarizeResearch(record,state.evidence).conflicting){
  next.events=[...next.events,{id:eventId+'|conflict',at,sourceId:source.id,outcome:'conflict'}].slice(-50);
 }
 if(!await storage.write(key,next,lease))return {status:'checkpoint_changed'};
 return {status:outcome,cursor:next.cursor};
}
