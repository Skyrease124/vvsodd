import { VOICE_LANGUAGES } from './languages';
import { providerFetch, retryableStatus } from './provider-retry';
import { readKey, saveKey, type SecretEnv } from './secret-store';

export const DEBATE_VOICES=['Aria','Jason','Leo'] as const;
const endpoint='https://877104f7-e885-42b9-8de8-f6e4c6303969.invocation.api.nvcf.nvidia.com/v1/audio/synthesize';
class VoiceError extends Error {constructor(message:string,public retryable=false){super(message);}}
const headers={'Cache-Control':'private, no-store'};

function providerError(status:number){
 return status===400||status===413?'NVIDIA rejected this audio section. Try a shorter reply.':status===401||status===403?'NVIDIA rejected the voice key. Check that the key has access to Magpie.':status===429?'NVIDIA’s voice service is busy or your account limit was reached. Try again shortly.':'NVIDIA could not generate the audio. Try again.';
}
export async function synthesize(text:string,key:string,signal:AbortSignal,upstream:typeof fetch=fetch,voice:string='Aria',replyLanguage:string='en'){
 if(!text.trim()||text.length>600)throw new VoiceError('This audio section is too long. Refresh SkyData and try Listen again.');
 const form=new FormData();
 const locale=VOICE_LANGUAGES[replyLanguage];
 if(!locale)throw new VoiceError('This language supports text replies only. Choose a supported voice language.');
 let selectedVoice='Magpie-Multilingual.EN-US.'+voice;
 if(replyLanguage!=='en'){
  // Discover the actual hosted catalog; do not guess speakers or silently use English.
  const catalog=await providerFetch(endpoint.replace('/synthesize','/list_voices'),{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])},upstream);
  if(!catalog.ok)throw new VoiceError('Could not check available voices. Try again shortly.',retryableStatus(catalog.status));
  const names=new Set<string>();
  const collect=(value:unknown):void=>{if(typeof value==='string'&&/^Magpie-Multilingual\.[A-Z]{2}-[A-Z]{2}\.[\w -]+$/.test(value))names.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){collect(k);collect(v);}};
  collect(await catalog.json());
  const prefixes=[`Magpie-Multilingual.${locale.tts.toUpperCase()}.`,...(replyLanguage==='ar'?['Magpie-Multilingual.AR-AR.']:[])];
  const matches=[...names].filter(name=>prefixes.some(prefix=>name.startsWith(prefix)));
  selectedVoice=matches.find(name=>name.endsWith('.'+voice))||matches[0]||'';
  if(!selectedVoice)throw new VoiceError('This language is not available on your connected voice service yet. Text replies still work.');
 }
 form.set('text',text);form.set('language',locale.tts);form.set('voice',selectedVoice);
 form.set('encoding','LINEAR_PCM');form.set('sample_rate_hz','22050');
 const response=await providerFetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.any([signal,AbortSignal.timeout(60000)])},upstream);
 if(!response.ok){console.warn('NVIDIA voice request rejected',{status:response.status,characters:text.length});throw new VoiceError(providerError(response.status),retryableStatus(response.status));}
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length<44||new TextDecoder().decode(bytes.slice(0,4))!=='RIFF'||new TextDecoder().decode(bytes.slice(8,12))!=='WAVE')throw new VoiceError('NVIDIA returned no playable audio. Try again.');
 return bytes;
}
export async function setupVoiceKey(request:Request,env:SecretEnv){
 if(request.method!=='POST')return Response.json({error:'Use POST.'},{status:405,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>2048)return Response.json({error:'Paste only the voice API key.'},{status:400,headers});
  const payload=JSON.parse(raw);const key=typeof payload.key==='string'?payload.key.trim().replace(/^Bearer\s+/i,'').replace(/^(["'])(.*)\1$/,'$2').trim():'';
  if(key.length<20||key.length>1024||!/^\S+$/.test(key))return Response.json({error:'Paste the complete voice API key, without extra code.'},{status:400,headers});
  await synthesize('Hello. I am SkyData.',key,request.signal);
  await saveKey(env,key,'NVIDIA_VOICE_API_KEY');
  return Response.json({configured:true},{headers});
 }catch(e){return Response.json({error:e instanceof VoiceError?e.message:'Could not connect the voice. Try again.'},{status:502,headers});}
}
export async function handleVoice(request:Request,env:SecretEnv){
 if(request.method!=='POST')return Response.json({error:'Use POST.'},{status:405,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403,headers});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Send JSON.'},{status:415,headers});
 try{
  const raw=await request.text();if(raw.length>60000)return Response.json({error:'This reply is too long to read aloud.'},{status:413,headers});
  const {text,voice='Aria',replyLanguage='en'}=JSON.parse(raw);
  if(typeof replyLanguage!=='string'||!VOICE_LANGUAGES[replyLanguage])return Response.json({error:'This language supports text replies only. Choose a supported voice language.'},{status:400,headers});
  if(!DEBATE_VOICES.some(v=>v===voice))return Response.json({error:'Choose a supported voice.'},{status:400,headers});
  if(typeof text!=='string'||!text.trim()||text.length>600)return Response.json({error:'This audio section is too long. Refresh SkyData and try Listen again.'},{status:400,headers});
  const key=await readKey(env,'NVIDIA_VOICE_API_KEY');
  if(!key)return Response.json({error:'Connect your Magpie voice key first.'},{status:503,headers});
  const bytes=await synthesize(text,key,request.signal,fetch,voice,replyLanguage);
  return new Response(bytes,{headers:{...headers,'Content-Type':'audio/wav','X-Content-Type-Options':'nosniff'}});
 }catch(e){return Response.json({error:e instanceof VoiceError?e.message:'Could not generate audio. Try again.',retryable:e instanceof VoiceError?e.retryable:!request.signal.aborted},{status:502,headers});}
}
