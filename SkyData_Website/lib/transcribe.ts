import {voiceOriginAllowed} from './voice-config';
import { REPLY_LANGUAGES,isReplyLanguage } from './languages';
import { whisperTranscript } from './whisper';
import { providerFetch, retryableStatus } from './provider-retry';
import { cleanTranscript } from './clean-response';
import { readKey, type SecretEnv } from './secret-store';
import { VISION_MODEL } from './vision';
export async function handleTranscribe(request:Request,env:SecretEnv,upstream:typeof fetch=fetch){
 const headers={'Cache-Control':'private, no-store'};
 if(request.method!=='POST'||!voiceOriginAllowed(request))return Response.json({error:'Request is not allowed.'},{status:403,headers});
 if(!request.headers.get('content-type')?.includes('audio/wav'))return Response.json({error:'Send WAV audio.'},{status:415,headers});
 try{
  const language=request.headers.get('X-SkyData-Language')||'en';
  if(!isReplyLanguage(language))return Response.json({error:'Choose a valid speech language.'},{status:400,headers});
  const languageName=REPLY_LANGUAGES.find(item=>item.id===language)!.name;
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(bytes.length<44||bytes.length>2100000||new TextDecoder().decode(bytes.slice(0,4))!=='RIFF'||new TextDecoder().decode(bytes.slice(8,12))!=='WAVE')return Response.json({error:'Invalid voice recording.'},{status:400,headers});
  const whisper=await whisperTranscript(bytes,env,request.signal,upstream);
  if(whisper)return whisper;
  const key=await readKey(env,'NVIDIA_VISION_API_KEY');if(!key)return Response.json({error:'Connect camera and audio first to use voice chat.'},{status:503,headers});
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const payload={model:VISION_MODEL,messages:[{role:'user',content:[{type:'text',text:`The expected spoken language is ${languageName}. Preserve the original spoken language; do not translate into English. Transcribe the exact spoken words in this recording. Return ONLY the transcript, without explanations, headings, quotation marks, or a response to the speaker. If there is no intelligible speech, return exactly [NO_SPEECH].`},{type:'audio_url',audio_url:{url:'data:audio/wav;base64,'+btoa(binary)}}]}],max_tokens:4096,chat_template_kwargs:{enable_thinking:false},stream:false,temperature:0};
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(90000)]);
  const send=(body:object)=>providerFetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal},upstream);
  let r=await send(payload);
  // Hosted catalog and self-hosted NIM do not always accept the same optional fields.
  // Retry a rejected schema with the catalog's previously supported payload.
  if(r.status===400||r.status===422){
   console.warn('voice_transcription_compatibility_retry',{status:r.status});
   await r.body?.cancel();
   const {chat_template_kwargs,...compatible}=payload;
   r=await send({...compatible,reasoning_budget:0});
  }
  if(!r.ok){
   console.warn('voice_transcription_service_error',{status:r.status});
   const error=r.status===401||r.status===403?'NVIDIA rejected the audio API key. Reconnect camera and audio.':r.status===429?'The voice service is busy. Try again shortly.':r.status===400||r.status===422?'NVIDIA rejected the recording request. Voice transcription needs a service compatibility fix.':'NVIDIA transcription is unavailable right now. Try again shortly.';
   return Response.json({error,retryable:retryableStatus(r.status)},{status:502,headers});
  }
  const result=await r.json() as {choices?:{message?:{content?:string}}[]};const text=cleanTranscript(result.choices?.[0]?.message?.content);
  if(!text||text==='[NO_SPEECH]')return Response.json({text:''},{headers});
  return Response.json({text:text.slice(0,8000)},{headers});
 }catch(error){console.warn('voice_transcription_transport_error',{timeout:error instanceof Error&&error.name==='TimeoutError'});return Response.json({error:'The connection to NVIDIA transcription failed or timed out. Try again.',retryable:!request.signal.aborted},{status:504,headers});}
}
