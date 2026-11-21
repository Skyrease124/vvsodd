// Read-only nationwide map coverage + owner-assisted NVIDIA research.
// Never writes to parcel datasets, maps, approved research, or public releases.
import * as auth from '../lib/auth.mjs';
import * as RL from '../lib/ratelimit.mjs';
import * as keys from '../lib/keystore.mjs';
import { complete } from '../lib/llm.mjs';

const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'}});
const root='https://pricepocketasset.com';
const plain=s=>String(s||'').slice(0,250);
async function readStatic(path) {
  const response=await fetch(root+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Static map data unavailable');
  const body=await response.text();
  if(body.length>500000)throw Error('Map index too large');
  return JSON.parse(body);
}
function validDatasets(index) {
  return (index.datasets||[]).filter(x=>/^[A-Z]{2}-[A-Za-z0-9_-]+$/.test(x.id||'')&&/^[A-Za-z0-9_-]+\.json$/.test(x.file||''));
}
function synopsis(d) {
  return {id:d.id,state:d.state,county:d.county,records:d.records||0,mapped:d.mapped||0,missing:Math.max(0,(d.records||0)-(d.mapped||0)),updated:d.updated||null,
    sourceCount:(d.sources||[]).length,sourceUrls:(d.sources||[]).filter(x=>/^https:\/\//.test(x)).slice(0,4),
    gis:d.gis&&/^https:\/\//.test(d.gis.url||'')?{name:d.gis.name||'GIS source',url:d.gis.url}:null};
}
async function datasetDetail(d) {
  const ds=await readStatic('/map/data/'+d.file);
  // Show source identifiers for owner investigation, not unverified coordinates.
  const raw=(ds.recs||[]).filter(r=>!r.cx&&!r.g);
  return {dataset:synopsis(d),examples:raw.slice(0,30).map(r=>({parcelId:plain(r.p),recordId:plain(r.i),taxYear:plain(r.ty)})),sampleSize:Math.min(raw.length,30),
     sampleOnly:true,geometryWritten:false};
}
export default async req=>{
  if(req.method!=='GET'&&req.method!=='POST')return json(405,{error:'GET or POST only'});
  const user=await auth.userFromCookie(req.headers.get('cookie')||'');
  if(!user)return json(401,{error:'Owner sign-in required'});
  if(!user.owner)return json(403,{error:'Owner access only'});
  try{
    const u=new URL(req.url);
    const index=await readStatic('/map/index.json');
    const datasets=validDatasets(index);
    const id=u.searchParams.get('id')||'';
    if(req.method==='GET') {
      if(id) {
        const d=datasets.find(x=>x.id===id);
        if(!d)return json(404,{error:'County dataset not found'});
        return json(200,{ok:true,...await datasetDetail(d)});
      }
      const summary=datasets.map(synopsis);
      const totals=summary.reduce((a,d)=>(a.records+=d.records,a.mapped+=d.mapped,a.missing+=d.missing,a.counties++,a),{records:0,mapped:0,missing:0,counties:0});
      return json(200,{ok:true,built:index.built||null,totals,datasets:summary,
        notes:'Coverage is from the existing published map index; this feature never modifies property boundaries or public listings.'});
    }
    if(req.headers.get('origin')!==u.origin)return json(403,{error:'Invalid origin'});
    const body=await req.text();
    if(body.length>1500)return json(413,{error:'Request too large'});
    let input;try{input=JSON.parse(body)}catch{return json(400,{error:'Invalid JSON'})}
    if(input.action!=='research'||typeof input.id!=='string')return json(400,{error:'Unsupported action'});
    const d=datasets.find(x=>x.id===input.id);
    if(!d)return json(404,{error:'County not found'});
    if(d.mapped>=d.records)return json(409,{error:'This county has no missing map positions in the current index.'});
    if(!(await RL.hit('coverage-ai:'+user.email,5,86400000)).ok)return json(429,{error:'Daily AI research limit reached (5 per day).'});
    const cfg=await keys.getConfig();if(!cfg)return json(503,{error:'NVIDIA AI is not configured.'});
    const urls=(d.sources||[]).filter(x=>/^https:\/\//.test(x)).slice(0,4);
    if(d.gis?.url&&/^https:\/\//.test(d.gis.url))urls.push(d.gis.url);
    const system='You are a cautious county parcel GIS research assistant. You have NO browsing or image access. Only use the provided metadata and known URLs. Never invent URLs, parcel coordinates, boundaries, owner facts, or assert an unverified match. Return a short owner-facing plan for locating official county GIS parcel geometry, validating parcel IDs, and safely handling no match. Clearly mark which URL is a general landing page versus a parcel feature endpoint if known. Do not claim you visited the sites.';
    const prompt=JSON.stringify({state:d.state,county:d.county,missing:Math.max(0,d.records-d.mapped),availableSourceUrls:urls,task:'How to investigate missing parcels without overwriting verified records?'});
    const out=await complete(cfg,system,prompt,{maxTokens:420,timeoutMs:16000});
    return json(200,{ok:true,model:out.model,analysis:out.text,verified:false,webSearched:false,geometryWritten:false,
      warning:'AI planning only. URLs and matches must be independently verified against official county sources.'});
  }catch(e){console.error('Owner map coverage:',String(e?.message||e).slice(0,150));
    return json(503,{error:'Map coverage is temporarily unavailable. No map data was changed.'});}
};
