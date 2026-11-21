// Private owner-only MapTiler preview configuration.
// MapTiler browser keys are inherently client-visible; restrict the key by referrer
// and usage quotas in MapTiler Cloud. Never include other server credentials here.
import * as auth from '../lib/brain-auth.mjs';
import * as KEYS from '../lib/apikeys.mjs';
import correctionFeed from './brain-map-county.mjs';
const out=(code,p)=>new Response(JSON.stringify(p),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'private,no-store','X-Robots-Tag':'noindex,nofollow','Vary':'Cookie'}});
async function handler(req,context){
 if(req.method!=='GET')return out(405,{ok:false,error:'GET only'});
 const me=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!me?.owner)return out(me?403:401,{ok:false,error:'Owner access required'});
 await KEYS.load(true);
 const key=KEYS.keyOf('MAPTILER_API_KEY');
 const history=await auth.kvGet('brain-map-history-v1')||{entries:[]},correctionCounts={};
 const datasets=[...new Set((history.entries||[]).map(e=>e.dataset).filter(id=>/^[A-Z]{2}-[a-z0-9_-]{2,80}$/.test(id||'')))].slice(0,20);
 await Promise.all(datasets.map(async id=>{
  const response=await correctionFeed(new Request('https://preview.internal/?dataset='+id),context);
  if(response.ok)correctionCounts[id]=Object.keys((await response.json()).records||{}).length;
 }));
 return out(200,{ok:true,configured:!!key,key:key||null,correctionCounts,note:'Private test only. Keep API key restrictions and quotas enabled. Allow the exact preview origin when testing a Netlify preview.'});
}
export default auth.withBrainStore(handler);
