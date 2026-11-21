// Private owner-only MapTiler preview configuration.
// MapTiler browser keys are inherently client-visible; restrict the key by referrer
// and usage quotas in MapTiler Cloud. Never include other server credentials here.
import * as auth from '../lib/auth.mjs';
import * as KEYS from '../lib/apikeys.mjs';
const out=(code,p)=>new Response(JSON.stringify(p),{status:code,headers:{'Content-Type':'application/json','Cache-Control':'private,no-store','X-Robots-Tag':'noindex,nofollow','Vary':'Cookie'}});
export default async function(req){
 if(req.method!=='GET')return out(405,{ok:false,error:'GET only'});
 const me=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!me?.owner)return out(me?403:401,{ok:false,error:'Owner access required'});
 await KEYS.load(true);
 const key=KEYS.keyOf('MAPTILER_API_KEY');
 return out(200,{ok:true,configured:!!key,key:key||null,note:'Private test only. Restrict API key to pricepocketasset.com and set MapTiler Cloud usage limits. Do not use free plan for commercial production.'});
}
