import { GPT_OSS_MODEL, modelSettings } from './models';
export type SecretEnv = { AWS_ACCESS_KEY_ID?:string; AWS_SECRET_ACCESS_KEY?:string; AWS_SESSION_TOKEN?:string; AWS_REGION?:string; SKYDATA_VOICE?:string; GEMINI_API_KEY?:string; GEMINI_FREE_TIER_CONFIRMED?:string; KNOWLEDGE_SEMANTIC_CONTEXT?:string; KNOWLEDGE_SEMANTIC_ONLY?:string; INVITE_BRIDGE_SECRET?:string; INVITE_REQUESTS_URL?:string; DB?: D1Database; FILES?: R2Bucket; SKYDATA_SECRET_KEY?: string; SKYDATA_OWNER_ID?: string; WHISPER_BRIDGE?: string; DEEPSEEK_API_KEY?: string; NVIDIA_API_KEY?: string; NVIDIA_DEEPSEEK_API_KEY?: string; NVIDIA_GPT_OSS_API_KEY?: string; OPENROUTER_API_KEY?: string; OPENAI_API_KEY?: string; COINGECKO_API_KEY?: string; NVIDIA_VOICE_API_KEY?: string; NVIDIA_VISION_API_KEY?: string; TAVILY_API_KEY?: string; NVIDIA_MODEL?: string };
async function encryptionKey(env:SecretEnv) {
 if (!env.SKYDATA_SECRET_KEY || !/^[a-f0-9]{64}$/.test(env.SKYDATA_SECRET_KEY)) throw new Error('Secret storage is unavailable.');
 const bytes=Uint8Array.from(env.SKYDATA_SECRET_KEY.match(/../g)!,v=>parseInt(v,16));
 return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}
const encode=(bytes:Uint8Array)=>{let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
const decode=(text:string)=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export async function saveKey(env:SecretEnv,value:string,name='NVIDIA_API_KEY') {
 if (!env.DB) throw new Error('Secret storage is unavailable.');
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(env),new TextEncoder().encode(value));
 await env.DB.prepare('INSERT INTO secrets (name, ciphertext, iv) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv').bind(name,encode(new Uint8Array(encrypted)),encode(iv)).run();
}
export async function readKey(env:SecretEnv,name:'AWS_ACCESS_KEY_ID'|'AWS_SECRET_ACCESS_KEY'|'AWS_SESSION_TOKEN'|'SKYDATA_VOICE'|'GEMINI_API_KEY'|'GEMINI_FREE_TIER_CONFIRMED'|'DEEPSEEK_API_KEY'|'WHISPER_BRIDGE'|'NVIDIA_API_KEY'|'NVIDIA_VOICE_API_KEY'|'NVIDIA_VISION_API_KEY'|'TAVILY_API_KEY'|'NVIDIA_DEEPSEEK_API_KEY'|'NVIDIA_GPT_OSS_API_KEY'|'OPENROUTER_API_KEY'|'OPENAI_API_KEY'|'COINGECKO_API_KEY'='NVIDIA_API_KEY') {
 if(env[name])return env[name];
 if(!env.DB)return undefined;
 const row=await env.DB.prepare('SELECT ciphertext, iv FROM secrets WHERE name = ?').bind(name).first<{ciphertext:string;iv:string}>();
 if(!row)return undefined;
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(row.iv)},await encryptionKey(env),decode(row.ciphertext)));
}
export async function setupKey(request:Request,env:SecretEnv,deepseek=false,gpt=false) {
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='POST')return Response.json({error:'Use POST.'},{status:405,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403,headers});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Send JSON.'},{status:415,headers});
 try {
 const raw=await request.text();if(raw.length>2048)return Response.json({error:'The key is too long.'},{status:400,headers});
 const {key}=JSON.parse(raw);
 if(typeof key!=='string')return Response.json({error:deepseek?'Paste your DeepSeek API key in the key field.':'Paste your NVIDIA API key in the key field.'},{status:400,headers});
 // API keys are opaque; NVIDIA decides whether the token is valid.
 const value=key.trim().replace(/^Bearer\s+/i,'').replace(/^(["'])(.*)\1$/,'$2').trim();
 if(value.length<20||value.length>1024||!/^[\x21-\x7e]+$/.test(value))return Response.json({error:'Paste only the complete API key, without spaces or extra code.'},{status:400,headers});
 // Verify the shared NVIDIA credential without waiting for DeepSeek generation.
 if(deepseek){
 const response=await fetch('https://api.deepseek.com/models',{headers:{Authorization:`Bearer ${value}`},signal:AbortSignal.timeout(20000)});
 if(!response.ok)return Response.json({error:response.status===401||response.status===403?'DeepSeek rejected this key. Check that you copied the complete key.':'DeepSeek could not verify the key. Try again.'},{status:502,headers});
 const data=await response.json() as {data?:{id:string}[]};
 if(!data.data?.some(m=>m.id==='deepseek-flash')||!data.data?.some(m=>m.id==='deepseek-v4-pro'))return Response.json({error:'This DeepSeek account does not list both Flash and Pro. Your existing key was not changed.'},{status:502,headers});
 await saveKey(env,value,'DEEPSEEK_API_KEY');return Response.json({configured:true},{headers});
 }
 const verificationModel=gpt?GPT_OSS_MODEL:deepseek?'nvidia/nemotron-3.5-lightning-30b-a3b':env.NVIDIA_MODEL||'nvidia/nemotron-3-ultra-550b-a55b';
 const response=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${value}`,'Content-Type':'application/json'},body:JSON.stringify({model:verificationModel,messages:[{role:'user',content:'Reply with OK.'}],max_tokens:gpt?2048:32,stream:false,...modelSettings(verificationModel)}),signal:AbortSignal.timeout(60000)});
 if(!response.ok)return Response.json({error:response.status===401||response.status===403?'NVIDIA rejected this key. Check that you copied the complete key.':response.status===429?'NVIDIA is busy or your account limit was reached. Try connecting again shortly.':'NVIDIA could not verify the key. Try again.'},{status:502,headers});
 const data=await response.json() as {choices?:{message?:{content?:string}}[]};
 if(!data.choices?.[0]?.message?.content?.trim())return Response.json({error:'NVIDIA returned no reply. Try connecting again.'},{status:502,headers});
 await saveKey(env,value,gpt?'NVIDIA_GPT_OSS_API_KEY':deepseek?'NVIDIA_DEEPSEEK_API_KEY':'NVIDIA_API_KEY');
 return Response.json({configured:true},{headers});
 }catch(error){return Response.json({error:error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError')?'NVIDIA did not finish checking your key in time. Your key was not saved. Try again shortly.':'Could not verify or save your key. Please try again.'},{status:503,headers});}
}

export async function encryptStoredText(env:SecretEnv,value:string,context:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(context)},await encryptionKey(env),new TextEncoder().encode(value));
 return {version:1,ciphertext:encode(new Uint8Array(encrypted)),iv:encode(iv)};
}
export async function decryptStoredText(env:SecretEnv,value:{ciphertext:string;iv:string},context:string){
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(value.iv),additionalData:new TextEncoder().encode(context)},await encryptionKey(env),decode(value.ciphertext)));
}
