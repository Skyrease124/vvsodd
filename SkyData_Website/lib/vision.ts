import {naturalWritingInstructions} from './natural-writing';
import { cleanCameraReply } from './camera-reply';
import { validCameraFrames } from './camera-frames';
import { validProject, projectContext } from './projects';
import { streamReply } from './stream-reply';
import { isDirectDeepseek, DEEPSEEK_ENDPOINT, DEEPSEEK_MODEL, modelSettings } from './models';
import { validDocument, documentContext } from './document-attachment';
import { providerFetch, retryableStatus } from './provider-retry';
import { getLiveInfo } from './live-info';
import { cleanResponse, DIRECT_ANSWER_STYLE } from './clean-response';
import { isReplyLanguage, replyLanguageInstruction, questionInReplyLanguage } from './languages';
import { readKey, saveKey, type SecretEnv } from './secret-store';
export const VISION_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const headers={'Cache-Control':'private, no-store'};
const endpoint='https://integrate.api.nvidia.com/v1/chat/completions';
function errorFor(status:number){return status===401||status===403?'The camera API key was rejected. Reconnect camera with your complete key.':status===429?'Camera analysis is busy or your account limit was reached. Try again shortly.':'Could not analyze the attachment. Try a smaller file or try again.';}
export async function setupVisionKey(request:Request,env:SecretEnv){
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request is not allowed.'},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>2048)return Response.json({error:'Paste only your API key.'},{status:400,headers});
  const data=JSON.parse(raw);const key=typeof data.key==='string'?data.key.trim().replace(/^Bearer\s+/i,'').replace(/^(["'])(.*)\1$/,'$2').trim():'';
  if(key.length<20||key.length>1024||!/^\S+$/.test(key))return Response.json({error:'Paste the complete API key without extra code.'},{status:400,headers});
  const r=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:VISION_MODEL,messages:[{role:'user',content:'Reply with OK.'}],max_tokens:256,reasoning_budget:0,stream:false}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(60000)])});
  if(!r.ok)return Response.json({error:errorFor(r.status),retryable:retryableStatus(r.status)},{status:502,headers});
  const result=await r.json() as {choices?:{message?:{content?:string}}[]};
  if(!result.choices?.[0]?.message?.content?.trim())return Response.json({error:'The camera model returned no reply. Try connecting again.'},{status:502,headers});
  await saveKey(env,key,'NVIDIA_VISION_API_KEY');return Response.json({configured:true},{headers});
 }catch{return Response.json({error:'Could not verify or save your camera key. Try again.'},{status:503,headers});}
}
function validMedia(media:unknown):boolean{
 if(!media||typeof media!=='object')return false;const m=media as {kind?:string;data?:string;name?:string};
 return typeof m.name==='string'&&m.name.length<=300&&typeof m.data==='string'&&m.data.length<=16777300&&((m.kind==='audio'&&/^data:audio\/(mpeg|wav);base64,[A-Za-z0-9+/]+=*$/.test(m.data))||(m.kind==='video'&&/^data:video\/mp4;base64,[A-Za-z0-9+/]+=*$/.test(m.data)));
}
export async function handleVision(request:Request,env:SecretEnv,upstream:typeof fetch=fetch,gemini=false){
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request is not allowed.'},{status:403,headers});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Send JSON.'},{status:415,headers});
 try{
  const raw=await request.text();if(raw.length>24000000)return Response.json({error:'This photo conversation is too large. Start a new chat.'},{status:413,headers});
  const {messages,replyLanguage,voiceChat,webSearch,model,stream,research,naturalWriting}=JSON.parse(raw);
  if(naturalWriting!==undefined&&typeof naturalWriting!=='boolean')return Response.json({error:'Choose a valid writing setting.'},{status:400,headers});
  if(replyLanguage!==undefined&&!isReplyLanguage(replyLanguage))return Response.json({error:'Choose a valid reply language.'},{status:400,headers});
  if(!Array.isArray(messages)||!messages.length||messages.length>24||messages.at(-1).role!=='user'||messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>8000||(m.project!==undefined&&(m.role!=='user'||!validProject(m.project)))||(m.document!==undefined&&(m.role!=='user'||!validDocument(m.document)))||(m.media!==undefined&&(m.role!=='user'||!validMedia(m.media)||m.image!==undefined))||(m.cameraFrames!==undefined&&(m.role!=='user'||!validCameraFrames(m.cameraFrames)||m.media!==undefined||m.image!==undefined))||(m.image!==undefined&&(m.role!=='user'||typeof m.image!=='string'||m.image.length>1500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(m.image)))))return Response.json({error:'Enter a valid question and attachment (MP3, WAV, or MP4, up to 12 MB).'},{status:400,headers});
  if(!gemini&&model==='deepseek-v4-pro')return Response.json({error:'DeepSeek Pro is text-only. Choose Flash for images or another model for recordings.'},{status:400,headers});
  if(!gemini&&isDirectDeepseek(model)&&messages.some(m=>m.media))return Response.json({error:'Choose a camera model for audio or video attachments.'},{status:400,headers});
  const directDeepseek=!gemini&&isDirectDeepseek(model);
  const useDeepseek=directDeepseek||!gemini&&model===DEEPSEEK_MODEL&&!messages.some(m=>m.media);const selectedModel=directDeepseek?model:useDeepseek?DEEPSEEK_MODEL:VISION_MODEL;
  const key=gemini?await readKey(env,'GEMINI_API_KEY'):directDeepseek?await readKey(env,'DEEPSEEK_API_KEY'):useDeepseek?(await readKey(env,'NVIDIA_DEEPSEEK_API_KEY')||await readKey(env)) : await readKey(env,'NVIDIA_VISION_API_KEY');if(!key)return Response.json({error:'Connect camera first.'},{status:503,headers});
  const project=await projectContext(messages,request.headers.get('oai-authenticated-user-id'),env);
  const live=await getLiveInfo(messages,selectedModel,key,env,request.signal,webSearch===true,upstream,research===true);
  const cameraTurn=Boolean(messages.at(-1).cameraFrames);
  const contextMessages=cameraTurn&&voiceChat===true?messages.slice(-9):messages;
  const converted=contextMessages.map((message,i)=>{const m={...message,content:(i===contextMessages.length-1?questionInReplyLanguage(message.content,replyLanguage):message.content)+documentContext(message.document)};return ({role:m.role,content:m.cameraFrames?[{type:'text',text:m.content+'\nRecent live camera frames, oldest to newest. Ages are relative to the moment the question was submitted.'},...m.cameraFrames.flatMap((frame:{image:string;ageMs:number})=>[{type:'text',text:'Camera frame '+frame.ageMs+' ms before submission'},{type:'image_url',image_url:{url:frame.image}}])]:m.media?[{type:'text',text:m.content},{type:m.media.kind==='audio'?'audio_url':'video_url',[m.media.kind==='audio'?'audio_url':'video_url']:{url:m.media.data}}]:m.image?[{type:'text',text:m.content},{type:'image_url',image_url:{url:m.image}}]:m.content});});
  const r=await providerFetch(directDeepseek?DEEPSEEK_ENDPOINT:endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:selectedModel,messages:[{role:'system',content:'You are SkyData. Answer questions about the supplied photos, recordings, and videos. Be clear when details are unreadable, inaudible, or uncertain. You see or hear only submitted attachments. Live camera sequences contain recent frames in chronological order with their ages. Use them to understand visible movement and the latest scene. When the user asks what you see, directly describe visible objects and the scene in the latest supplied frames. Do not echo the question or answer with a greeting. Earlier assistant replies are conversation history, not evidence of what is currently visible. For "what about this", identify the main object in the newest frames, even if it differs from the prior turn. Do not say the scene is unchanged unless the user asks for a comparison and the supplied frames support it. Read brand names only when the label is legible; otherwise use a generic description and state uncertainty. You do not receive an uninterrupted video stream or frames after submission; never claim continuous monitoring or infer unseen changes. If only one image is supplied, use only what it shows. If a previous attachment is no longer provided, use prior conversation cautiously and ask for it again if needed.'+(live.context?' Live evidence: '+live.context:' No live lookup was performed for this turn.')+DIRECT_ANSWER_STYLE+naturalWritingInstructions(naturalWriting)+project+replyLanguageInstruction(replyLanguage)+(voiceChat===true?" This is a spoken conversation. Use one or two natural sentences about the main object unless the user asks for detail. Avoid listing every background item. Never repeat a sentence or paragraph. No Markdown.":"")},...converted],max_tokens:cameraTurn&&voiceChat===true?512:useDeepseek?8192:4096,stream:stream===true,...(useDeepseek?modelSettings(selectedModel):{reasoning_budget:0,temperature:.6})}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(180000)])},upstream);
  if(!r.ok)return Response.json({error:errorFor(r.status),retryable:retryableStatus(r.status)},{status:r.status===429?429:502,headers});
  if(stream===true)return streamReply(r,selectedModel,live.sources,request.signal);
  const data=await r.json() as {choices?:{message?:{content?:string}}[]};const rawContent=cleanResponse(data.choices?.[0]?.message?.content);const content=cameraTurn?cleanCameraReply(rawContent):rawContent;
  if(!content?.trim())return Response.json({error:'No attachment analysis was returned. Try again.'},{status:502,headers});
  return Response.json({content,model:selectedModel,sources:live.sources},{headers});
 }catch{return Response.json({error:'Attachment analysis timed out or failed. Try again.',retryable:!request.signal.aborted},{status:504,headers});}
}
