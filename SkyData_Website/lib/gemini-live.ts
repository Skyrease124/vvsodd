import {geminiSpeechEnabled} from './voice-config';
import { isSiteAdmin } from './site-admin';
import { GoogleGenAI } from '@google/genai';
import { readKey,saveKey,type SecretEnv } from './secret-store';
import { issueCsrf,verifyCsrf } from './connection-page';
import { GEMINI_LIVE_MODEL,GEMINI_VOICES,GEMINI_SESSION_SECONDS,geminiLiveConfig } from './gemini-config';
const headers={'Cache-Control':'private, no-store'};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Embedded WebKit can use an opaque Origin; never accept cross-site fetch metadata.
export function geminiOriginAllowed(request:Request){const origin=request.headers.get('origin');const site=request.headers.get('sec-fetch-site');return site!=='cross-site'&&(origin===new URL(request.url).origin||(origin==='null'&&site==='same-origin'));}
export async function geminiReady(env:SecretEnv){return Boolean(await readKey(env,'GEMINI_API_KEY'))&&(env.GEMINI_FREE_TIER_CONFIRMED==='true'||await readKey(env,'GEMINI_FREE_TIER_CONFIRMED')==='true');}
export async function geminiConnection(request:Request,env:SecretEnv){
 let message='',ok=false,status=200;
 if(request.method==='POST'){
  try{
   const raw=await request.text();if(raw.length>4096)throw Error('Paste only the key.');const form=new URLSearchParams(raw);
   if(!geminiOriginAllowed(request)){status=403;throw Error('Open Connect Gemini Live from SkyData and try again.');}
   if(!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')){status=415;throw Error('Use the connection form to submit your key.');}
   if(!await verifyCsrf(form.get('csrf')||'',request,env)){status=403;throw Error('Your setup page expired. Use the refreshed form below to try again.');}
   if(form.get('free')!=='yes')throw Error('Confirm this key belongs to a Google project with billing disabled. Paid usage is not authorized.');
   const key=(form.get('key')||'').trim();if(key.length<20||key.length>1024||!/^[\x21-\x7e]+$/.test(key))throw Error('Paste your complete Gemini API key.');
   const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_LIVE_MODEL,{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error(response.status===429?'Google quota unavailable. No key saved.':'Google could not verify this key/model. Your existing configuration was preserved.');
   const model=await response.json() as {name?:string};if(model.name!=='models/'+GEMINI_LIVE_MODEL)throw Error('Unexpected Google model response.');
   await saveKey(env,key,'GEMINI_API_KEY');await saveKey(env,'true','GEMINI_FREE_TIER_CONFIRMED');ok=true;message='Gemini key saved encrypted. Model catalog checked; a live conversation has not yet been tested.';
  }catch(e){message=e instanceof Error?e.message:'Connection failed.';if(status===200)status=400;}
 }else if(request.method!=='GET')return new Response(null,{status:405});
 const csrf=await issueCsrf(request,env);
 return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Gemini Live · SkyData</title><style>body{background:#080d17;color:#f1f5fa;font:16px Arial;margin:0}main{max-width:480px;margin:6vh auto;padding:28px}p{line-height:1.6;color:#b7c9df}input,button{font:inherit;border-radius:12px;padding:16px;box-sizing:border-box}input[type=password],button{width:100%}input{background:#111d2e;color:white;border:1px solid #56718d}button{background:#9bdfff;margin-top:20px;border:0}a{color:#9bdfff}.result{border:1px solid #56718d;padding:16px}label{display:block;margin:16px 0}</style></head><body><main><h1>Connect Gemini Live</h1>${message?`<p class="result" role="status">${escape(message)}</p>`:''}<p>Model: ${GEMINI_LIVE_MODEL}. Gemini Flash text is optional in the model menus. Native audio uses this Live model and separate voice settings. Your NVIDIA keys and models stay connected. Google lists free-tier native audio, with project-specific quotas.</p><p>Use a key from a project with billing disabled. SkyData cannot determine your billing tier from this key or force a billed project to use free pricing. No paid fallback is enabled. Free-tier data may be used by Google to improve products.</p>${ok?'':`<form action="/connect-gemini" method="post"><input type="hidden" name="csrf" value="${escape(csrf)}"><label>Gemini API key<input type="password" name="key" required maxlength="1024" autocomplete="off" autocapitalize="none" spellcheck="false"></label><label><input type="checkbox" name="free" value="yes" required> I checked AI Studio: this key’s project has billing disabled and free-tier access.</label><button>Connect Gemini Live</button></form>`}<p><a href="/">Return to SkyData</a> · <a href="https://aistudio.google.com/usage?tab=rate-limit" target="_blank" rel="noopener noreferrer">Check Google quotas</a></p></main></body></html>`,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Referrer-Policy':'no-referrer'}});
}
export async function geminiToken(request:Request,env:SecretEnv,create?: (key:string,voice:string)=>Promise<{name?:string}>){
 if(request.method!=='DELETE'&&!await geminiSpeechEnabled(env))return Response.json({error:'This voice provider is disabled. Text chat remains available.',code:'DISABLED'},{status:503,headers});
 if(!geminiOriginAllowed(request))return Response.json({error:'Origin rejected.'},{status:403,headers});
 if(!env.DB)return Response.json({error:'Session protection unavailable.'},{status:503,headers});
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'Sign in.'},{status:403,headers});
 const id=user+':gemini-lease';
 if(request.method==='DELETE'){let data;try{const raw=await request.text();if(raw.length>100)throw Error();data=JSON.parse(raw) as {lease:number};if(!Number.isSafeInteger(data.lease)||data.lease<=0)throw Error();}catch{return Response.json({error:'Invalid lease.'},{status:400,headers});}await env.DB.prepare('UPDATE request_limits SET window = 0 WHERE id = ? AND count = ?').bind(id,data.lease).run();return Response.json({released:true},{headers});}
 if(request.method!=='POST')return Response.json({error:'Use POST.'},{status:405,headers});
 let lease=0;
 try{
  const raw=await request.text();if(raw.length>1024)return Response.json({error:'Request too large.'},{status:413,headers});const data=JSON.parse(raw);const admin=await isSiteAdmin(request,env);const voice=admin&&data.voice?data.voice:await selectedGeminiVoice(env);
  if(!GEMINI_VOICES.includes(voice))return Response.json({error:'Choose a supported voice.'},{status:400,headers});
  if(!await geminiReady(env))return Response.json({error:'Voice is not connected. The owner must connect a billing-disabled project.'},{status:503,headers});
  const now=Date.now();lease=crypto.getRandomValues(new Uint32Array(1))[0]||1;
  const row=await env.DB.prepare('INSERT INTO request_limits (id, window, count) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET window = excluded.window, count = excluded.count WHERE request_limits.window <= ? RETURNING count').bind(id,now+GEMINI_SESSION_SECONDS*1000,lease,now).first<{count:number}>();
  if(!row)return Response.json({error:'A voice session is already active. Stop it or wait five minutes.'},{status:409,headers});
  const key=(await readKey(env,'GEMINI_API_KEY'))!;
  const config=geminiLiveConfig(voice);
  const token=create?await create(key,voice):await new GoogleGenAI({apiKey:key,httpOptions:{apiVersion:'v1beta',timeout:15000}}).authTokens.create({config:{uses:1,expireTime:new Date(now+GEMINI_SESSION_SECONDS*1000).toISOString(),newSessionExpireTime:new Date(now+60000).toISOString(),liveConnectConstraints:{model:GEMINI_LIVE_MODEL,config:config as never}}});
  if(!token.name)throw Error('No token');
  return Response.json({token:token.name,lease,model:GEMINI_LIVE_MODEL,voice,config,maxSeconds:GEMINI_SESSION_SECONDS},{headers});
 }catch{if(lease)await env.DB.prepare('UPDATE request_limits SET window = 0 WHERE id = ? AND count = ?').bind(id,lease).run();return Response.json({error:'Voice connection unavailable. Check access or quota. No paid fallback.',retryable:false},{status:502,headers});}
}

export async function selectedGeminiVoice(env:SecretEnv){const saved=await readKey(env,'SKYDATA_VOICE');return GEMINI_VOICES.some(v=>v===saved)?saved!:'Charon';}
export async function geminiVoiceSettings(request:Request,env:SecretEnv){
 if(!await isSiteAdmin(request,env))return Response.json({error:'Owner access only.'},{status:403,headers});
 if(request.method==='GET')return Response.json({voice:await selectedGeminiVoice(env),voices:GEMINI_VOICES},{headers});
 if(request.method!=='POST')return Response.json({error:'Use POST.'},{status:405,headers});
 if(!geminiOriginAllowed(request))return Response.json({error:'Origin rejected.'},{status:403,headers});
 try{const raw=await request.text();if(raw.length>200)throw Error();const {voice}=JSON.parse(raw);if(!GEMINI_VOICES.includes(voice))throw Error();await saveKey(env,voice,'SKYDATA_VOICE');return Response.json({voice},{headers});}catch{return Response.json({error:'Could not save the voice selection.'},{status:400,headers});}
}
