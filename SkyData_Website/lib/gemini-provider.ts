import {geminiSpeechEnabled} from './voice-config';
import {isSiteAdmin} from './site-admin';
import {GEMINI_VOICES} from './gemini-config';
import {GoogleGenAI, type Part} from '@google/genai';
import {readKey,type SecretEnv} from './secret-store';
import {geminiReady,geminiOriginAllowed,selectedGeminiVoice} from './gemini-live';
import {GEMINI_TEXT_MODEL} from './models';
export {GEMINI_TEXT_MODEL} from './models';
export const GEMINI_TTS_MODEL='gemini-3.8-flash-lite-tts';
const headers={'Cache-Control':'private, no-store'};
function mediaPart(value:string):Part{const match=value.match(/^data:([^;]+);base64,([A-Za-z0-9+/]+=*)$/);if(!match)throw Error('Invalid attachment');return {inlineData:{mimeType:match[1],data:match[2]}};}
export function geminiParts(content:unknown):Part[]{
 if(typeof content==='string')return [{text:content}];
 if(!Array.isArray(content))throw Error('Invalid content');
 return content.map(p=>p.type==='text'?{text:p.text}:mediaPart(p.image_url?.url||p.audio_url?.url||p.video_url?.url));
}
// Explicit Gemini adapter. Text callers select it only for the Gemini model; camera callers use it for their dedicated media service.
export function geminiUpstream(env:SecretEnv,upstream:typeof fetch=fetch):typeof fetch{
 return (async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(url!=='https://integrate.api.nvidia.com/v1/chat/completions')return upstream(input,init);
  if(!await geminiReady(env))return Response.json({error:'SkyData connection is unavailable. No paid fallback.'},{status:503});
  const key=(await readKey(env,'GEMINI_API_KEY'))!;
  const body=JSON.parse(String(init?.body));
  const system=body.messages.filter((m:any)=>m.role==='system').map((m:any)=>m.content).join('\n');
  const contents=body.messages.filter((m:any)=>m.role!=='system').map((m:any)=>({role:m.role==='assistant'?'model':'user',parts:geminiParts(m.content)}));
  const config={systemInstruction:system,maxOutputTokens:body.max_tokens||4096,temperature:.6,abortSignal:init?.signal||undefined,httpOptions:{timeout:90000}};
  const ai=new GoogleGenAI({apiKey:key});
  try{
   if(!body.stream){const result=await ai.models.generateContent({model:GEMINI_TEXT_MODEL,contents,config});return Response.json({choices:[{message:{content:result.text||''}}],usage:result.usageMetadata},{headers:{'X-SkyData-Model':GEMINI_TEXT_MODEL}});}
   const chunks=await ai.models.generateContentStream({model:GEMINI_TEXT_MODEL,contents,config});
   const encoder=new TextEncoder();let cancelled=false;
   const stream=new ReadableStream<Uint8Array>({async start(controller){try{for await(const chunk of chunks){if(cancelled||init?.signal?.aborted)return;const text=chunk.text;if(text)controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n'));}if(!cancelled){controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();}}catch(e){if(!cancelled)controller.error(e);}},cancel(){cancelled=true;}});
   return new Response(stream,{headers:{'Content-Type':'text/event-stream','X-SkyData-Model':GEMINI_TEXT_MODEL}});
  }catch(e){const status=Number((e as {status?:number}).status)||502;return Response.json({error:'SkyData request failed. No paid fallback.'},{status:status>=400&&status<=599?status:502});}
 }) as typeof fetch;
}
export function pcmWav(data:string){const raw=Uint8Array.from(atob(data),c=>c.charCodeAt(0));const bytes=new Uint8Array(44+raw.length),view=new DataView(bytes.buffer);const ascii=(at:number,text:string)=>{for(let i=0;i<text.length;i++)bytes[at+i]=text.charCodeAt(i);};ascii(0,'RIFF');view.setUint32(4,36+raw.length,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,24000,true);view.setUint32(28,48000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,raw.length,true);bytes.set(raw,44);return bytes;}
export async function geminiSpeech(request:Request,env:SecretEnv,preview=false){
 if(request.method!=='DELETE'&&!await geminiSpeechEnabled(env))return Response.json({error:'This voice provider is disabled. Text chat remains available.',code:'DISABLED'},{status:503,headers});
 if(preview&&!await isSiteAdmin(request,env))return Response.json({error:'Owner access only.'},{status:403,headers});
 if(request.method!=='POST')return Response.json({error:'Use POST.'},{status:405,headers});
 if(!geminiOriginAllowed(request))return Response.json({error:'Origin rejected.'},{status:403,headers});
 try{const raw=await request.text();if(raw.length>6000)throw Error();const data=JSON.parse(raw);const text=preview?'Hi, I am SkyData. Here is a sample of my voice. How can I help you today?':data.text;const voice=preview?data.voice:await selectedGeminiVoice(env);if(preview&&!GEMINI_VOICES.some(v=>v===voice))return Response.json({error:'Choose a supported voice.'},{status:400,headers});if(typeof text!=='string'||!text.trim()||text.length>600)return Response.json({error:'Choose a shorter audio section.'},{status:400,headers});
  if(!await geminiReady(env))return Response.json({error:'Voice is not connected. No paid fallback.'},{status:503,headers});
  const ai=new GoogleGenAI({apiKey:(await readKey(env,'GEMINI_API_KEY'))!});
  const result=await ai.models.generateContent({model:GEMINI_TTS_MODEL,contents:[{role:'user',parts:[{text}]}],config:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}},abortSignal:request.signal,httpOptions:{timeout:60000}}});
  const part=result.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.mimeType?.startsWith('audio/'))?.inlineData;
  if(!part?.data)throw Error('NO_AUDIO');
  const mime=part.mimeType?.split(';')[0].toLowerCase();
  let bytes:Uint8Array;
  if(mime==='audio/wav'||mime==='audio/x-wav'){bytes=Uint8Array.from(atob(part.data),c=>c.charCodeAt(0));if(bytes.length<44||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WAVE')throw Error('INVALID_AUDIO');}
  else if(mime==='audio/pcm'||mime==='audio/l16'){if(part.mimeType?.includes('rate=')&&!part.mimeType.includes('rate=24000'))throw Error('INVALID_AUDIO');bytes=pcmWav(part.data);if((bytes.length-44)%2)throw Error('INVALID_AUDIO');}
  else throw Error('INVALID_AUDIO');
  if(bytes.length>12_000_000)throw Error('INVALID_AUDIO');
  return new Response(new Uint8Array(bytes).buffer,{headers:{...headers,'Content-Type':'audio/wav','X-Content-Type-Options':'nosniff'}});
 }catch(e){
  const status=Number((e as {status?:number}).status),reason=e instanceof Error?e.message:'';
  const code=status===429?'QUOTA':status===401?'KEY':status===403?'ACCESS':status===404?'MODEL':status===400?'REQUEST':reason==='NO_AUDIO'?'NO_AUDIO':reason==='INVALID_AUDIO'?'INVALID_AUDIO':request.signal.aborted?'CANCELLED':'PROVIDER';
  const messages:Record<string,string>={QUOTA:'Google voice quota is exhausted or rate-limited. Wait and check AI Studio quotas.',KEY:'Google rejected the API key. Reconnect Gemini with a valid key.',ACCESS:'Google denied speech-model access. Check API key restrictions and project permissions in AI Studio.',MODEL:'The speech model is unavailable for this project. Check model availability in AI Studio.',REQUEST:'Google rejected the voice request. Check the selected voice and speech model configuration.',NO_AUDIO:'Google returned no audio for this preview. Try again.',INVALID_AUDIO:'Google returned an unsupported or invalid audio format.',CANCELLED:'Voice request cancelled.',PROVIDER:'Google speech could not respond. Try again or check AI Studio service status.'};
  return Response.json({error:messages[code]+' No paid fallback.',code},{status:status===429?429:502,headers});
 }
}
