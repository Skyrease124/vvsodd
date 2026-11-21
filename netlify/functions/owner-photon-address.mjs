// Deprecated: owner searches are now automatically scheduled by the AI Brain.
// Do not trigger Photon public requests from page traffic or bypass the shared quota.
import * as auth from '../lib/auth.mjs';
export default async function(req){
 const user=await auth.userFromCookie(req.headers.get('cookie')||'');
 if(!user?.owner)return new Response(JSON.stringify({ok:false,error:'Owner access required'}),{status:user?403:401,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 return new Response(JSON.stringify({ok:false,error:'Manual Photon lookups are disabled. The AI Brain runs five address-discovery requests every four hours and stores results automatically.'}),{status:410,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
