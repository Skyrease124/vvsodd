import { readKey, saveKey, type SecretEnv } from './secret-store';
import { issueCsrf, verifyCsrf } from './connection-page';
import { cleanTranscript } from './clean-response';
type Bridge={url:string;token:string};
const headers={'Cache-Control':'private, no-store'};
function bridgeURL(value:string){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname)||/(^|\.)(localhost|local|internal|test|invalid|example)$/i.test(u.hostname))throw Error('Use the public HTTPS address of your running bridge, without a path.');
 return u.origin;
}
async function config(env:SecretEnv):Promise<Bridge|null>{const raw=await readKey(env,'WHISPER_BRIDGE');if(!raw)return null;const c=JSON.parse(raw);return {url:bridgeURL(c.url),token:c.token};}
export async function whisperTranscript(bytes:Uint8Array,env:SecretEnv,signal:AbortSignal,upstream:typeof fetch=fetch):Promise<Response|null>{
 const c=await config(env);if(!c)return null;
 try{
  const r=await upstream(c.url+'/transcribe',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+c.token,'Content-Type':'audio/wav'},body:bytes as unknown as BodyInit,signal:AbortSignal.any([signal,AbortSignal.timeout(65000)])});
  if(!r.ok){await r.body?.cancel();return Response.json({error:r.status===401?'Reconnect your Whisper bridge.':'Whisper is temporarily unavailable. Your recording was not sent to another model.',retryable:r.status>=500||r.status===429},{status:502,headers});}
  const result=await r.json() as {text?:unknown};if(typeof result.text!=='string'||result.text.length>16000)throw Error('Invalid transcript');
  const text=cleanTranscript(result.text);return Response.json({text:text==='[NO_SPEECH]'?'':text.slice(0,8000),provider:'whisper'},{headers});
 }catch{return Response.json({error:'Could not reach Whisper. Check the bridge connection.',retryable:!signal.aborted},{status:504,headers});}
}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function handleWhisperConnection(request:Request,env:SecretEnv,upstream:typeof fetch=fetch){
 const csrf=await issueCsrf(request,env);let active=Boolean(await config(env));let message='';let status=200;
 if(request.method==='POST'){
  try{
   const origin=request.headers.get('origin');
   if(origin!==new URL(request.url).origin&&!(origin==='null'&&request.headers.get('sec-fetch-site')==='same-origin'))throw Error('Open this page from SkyData.');
   if(!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded'))throw Error('Use the form below.');
   const raw=await request.text();if(raw.length>4096)throw Error('Connection details are too long.');
   const f=new URLSearchParams(raw);if(!await verifyCsrf(f.get('csrf')||'',request,env))throw Error('This page expired. Try again.');
   if(f.get('action')==='disconnect'){await saveKey(env,'','WHISPER_BRIDGE');active=false;message='Whisper disconnected. SkyData is using its previous speech recognition.';}
   else{
    const url=bridgeURL((f.get('url')||'').trim());const token=(f.get('token')||'').trim();
    if(!/^[A-Za-z0-9_-]{32,256}$/.test(token))throw Error('Paste the complete bridge access token.');
    const r=await upstream(url+'/verify',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
    if(!r.ok){await r.body?.cancel();throw Error('The bridge could not verify access to Whisper. Check the server and its NVIDIA key.');}
    const data=await r.json() as {verified?:boolean;model?:string};if(data.verified!==true||data.model!=='whisper-large-v3')throw Error('This is not a verified Whisper bridge.');
    await saveKey(env,JSON.stringify({url,token}),'WHISPER_BRIDGE');active=true;message='Whisper connected. Voice chat now uses Whisper to recognize your speech.';
   }
  }catch(e){status=400;message=e instanceof Error?e.message:'Could not connect Whisper.';}
 }else if(request.method!=='GET')return new Response('Use GET or POST.',{status:405,headers});
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Whisper · SkyData</title><style>body{background:#080d17;color:#f1f5fa;font:16px Arial;margin:0}main{max-width:480px;margin:6vh auto;padding:28px}p{line-height:1.6;color:#b7c9df}label{display:block;margin:20px 0 10px}input,button{box-sizing:border-box;width:100%;padding:16px;font:inherit;border-radius:10px}input{background:#111d2e;color:white;border:1px solid #56718d}button{margin-top:20px;background:#9bdfff;color:#082036;border:0}a{color:#9bdfff}aside{padding:16px;border:1px solid #56718d;border-radius:10px}</style><main><h1>Whisper speech recognition</h1><p>${active?'Current speech recognition: Whisper.':'Current speech recognition is unchanged.'}</p>${message?`<aside role="status">${escape(message)}</aside>`:''}<p>Whisper needs a running bridge server. Enter its address and access token below. Your NVIDIA Whisper key goes into that server’s settings, not this form.</p><form method="post"><input type="hidden" name="csrf" value="${csrf}"><label for="url">Bridge HTTPS address</label><input type="url" id="url" name="url" required placeholder="https://your-bridge-host" autocomplete="off"><label for="token">Bridge access token</label><input type="password" id="token" name="token" required maxlength="256" autocomplete="off" autocapitalize="none" spellcheck="false"><button>Test and connect Whisper</button></form>${active?`<form method="post"><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="action" value="disconnect"><button>Use previous speech recognition</button></form>`:''}<p><a href="/" target="_top">Back to SkyData chat</a></p></main></html>`,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}
