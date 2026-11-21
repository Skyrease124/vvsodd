// Netlify scheduled source monitor: one allowlisted free source every two hours.
// Three sources rotate through six-hour checks. No Firecrawl or model calls.
import crypto from 'node:crypto';
import * as brain from '../lib/brain-auth.mjs';
import {SOURCE_REGISTRY,researchKey,safeScrapeExcerpt,compareSource} from '../lib/owner-intelligence-sources.mjs';
import {sourceCooldown} from '../lib/owner-firecrawl-quota.mjs';
import {saveSourceLead} from '../lib/brain-source-leads.mjs';
const STATUS='brain-source-monitor-status-v1';
const norm=x=>String(x??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
async function data(path){
 const r=await fetch('https://pricepocketasset.com'+path,{signal:AbortSignal.timeout(4500)});if(!r.ok)throw Error('Map data HTTP '+r.status);
 const raw=await r.text();if(raw.length>12000000)throw Error('Map data too large');return JSON.parse(raw);
}
export async function sourceDataset(source){
 const index=await data('/map/index.json');
 const matches=(index.datasets||[]).filter(d=>d.state==='FL'&&norm(d.county)===norm(source.county)&&/^[A-Za-z0-9_-]+\.json$/.test(d.file||''));
 if(matches.length!==1)return null;
 const dataset=await data('/map/data/'+matches[0].file);
 for(const record of dataset.recs||[])for(const [key,dict] of Object.entries(dataset.dict||{}))if(record[key]!=null)record[key]=dict[record[key]];
 return dataset;
}
async function handler(){
 const previous=await brain.kvGet(STATUS)||{runs:0,cursor:0};
 const state={...previous,runs:(previous.runs||0)+1,state:'running',lastStarted:new Date().toISOString(),lastError:null};
 const source=SOURCE_REGISTRY[(previous.cursor||0)%SOURCE_REGISTRY.length];
 try{
  if((await brain.kvGet('owner-brain-scanner-v1'))?.status==='paused'){state.state='paused';return;}
  state.cursor=((previous.cursor||0)+1)%SOURCE_REGISTRY.length;state.sourceId=source.id;
  const prior=await brain.kvGet(researchKey(source.id));
  if(sourceCooldown(prior,'official',new Date())){state.state='cooldown';return;}
  const response=await fetch(source.url,{redirect:'manual',signal:AbortSignal.timeout(6500),headers:{Accept:'text/html, text/plain'}});
  if(!response.ok||response.status>=300)throw Error('Official source HTTP '+response.status);
  if(!/text\/(html|plain)/i.test(response.headers.get('content-type')||''))throw Error('Unsupported source content type');
  const raw=await response.text();if(raw.length>1000000)throw Error('Official source too large');
  const excerpt=safeScrapeExcerpt(raw);if(excerpt.length<100)throw Error('Official source contains too little usable text');
  const hash=crypto.createHash('sha256').update(excerpt).digest('hex'),comparison=compareSource(prior,{hash,excerpt});
  const saved={checkedAt:new Date().toISOString(),provider:'official',hash,excerpt:excerpt.slice(0,3000),changed:comparison.changed,reviewStatus:comparison.status,
   summary:null,aiStatus:'disabled',error:null,previousCheckedAt:prior?.checkedAt||null,actor:'scheduled-source-monitor'};
  await brain.kvPut(researchKey(source.id),saved);
  const lead=await saveSourceLead(source,saved,brain,sourceDataset);
  state.state='idle';state.checked=(state.checked||0)+1;state.linkedCases=lead.recordIds.length;state.lastResult=lead.status;
 }catch(e){state.state='error';state.lastError=String(e.message).slice(0,180);}
 finally{state.lastCompleted=new Date().toISOString();await brain.kvPut(STATUS,state);}
}
export const config={schedule:'10 */2 * * *'};
export default brain.withBrainStore(handler);
