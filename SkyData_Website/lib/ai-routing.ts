import type {SecretEnv} from './secret-store';

// Independent implementation. Endpoints are fixed: browser input can never supply an upstream URL.
export const PROVIDERS = {
 nvidia:{name:'NVIDIA NIM',key:'NVIDIA_API_KEY',models:'https://integrate.api.nvidia.com/v1/models',chat:'https://integrate.api.nvidia.com/v1/chat/completions',limits:'Account-specific limits. Hosted developer endpoints are for prototyping; production entitlement is separate.'},
 openrouter:{name:'OpenRouter',key:'OPENROUTER_API_KEY',models:'https://openrouter.ai/api/v1/models',chat:'https://openrouter.ai/api/v1/chat/completions',limits:'Free variants only. Account and model rate limits apply; no guaranteed allowance.'}
} as const;
export type Provider = keyof typeof PROVIDERS;
export type Task = 'chat'|'coding'|'research'|'translation';
export const TASKS:Task[]=['chat','coding','research','translation'];
export type Route={provider:Provider;model:string};
export type Settings={enabled:boolean;fallback:boolean;prototypeConfirmed:boolean;dailyAttempts:number;routes:Record<Task,Route[]>};
export type CatalogModel={id:string;free:boolean};
export type Catalog={provider:Provider;checked:number;status:string;models:CatalogModel[]};
export const defaults:Settings={enabled:false,fallback:false,prototypeConfirmed:false,dailyAttempts:50,routes:{chat:[],coding:[],research:[],translation:[]}};
export function normalizeSettings(v:any):Settings{
 if(!v||typeof v.enabled!=='boolean'||typeof v.fallback!=='boolean'||typeof v.prototypeConfirmed!=='boolean'||!Number.isInteger(v.dailyAttempts)||v.dailyAttempts<1||v.dailyAttempts>1000)throw Error('Invalid routing settings.');
 const routes={} as Settings['routes'];
 for(const task of TASKS){const list=v.routes?.[task];if(!Array.isArray(list)||list.length>3||list.some((r:any)=>!Object.hasOwn(PROVIDERS,r?.provider)||typeof r.model!=='string'||! /^[a-zA-Z0-9_.:/-]{1,160}$/.test(r.model)))throw Error('Select up to three catalog models per task.');routes[task]=list.map((r:Route)=>({provider:r.provider,model:r.model}));}
 return {enabled:v.enabled,fallback:v.fallback,prototypeConfirmed:v.prototypeConfirmed,dailyAttempts:v.dailyAttempts,routes};
}
export async function routingSettings(env:SecretEnv):Promise<Settings>{const row=await env.DB!.prepare("SELECT value FROM ai_router_settings WHERE id='global'").first<{value:string}>();return row?normalizeSettings(JSON.parse(row.value)):structuredClone(defaults);}
export function runtimeKey(env:SecretEnv,provider:Provider){return env[PROVIDERS[provider].key]?.trim();}
export async function catalogs(env:SecretEnv):Promise<Catalog[]>{const rows=await env.DB!.prepare('SELECT * FROM ai_provider_catalog').all<{provider:Provider;checked:number;status:string;models:string}>();return rows.results.map(r=>({...r,models:JSON.parse(r.models)}));}
async function boundedJson(response:Response,limit:number){
 const reader=response.body?.getReader();if(!reader)throw Error('Empty response');let bytes=0,text='';const decoder=new TextDecoder();
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>limit)throw Error('Response limit');text+=decoder.decode(chunk.value,{stream:true});}return JSON.parse(text+decoder.decode());}finally{await reader.cancel().catch(()=>{});}
}
export async function discover(env:SecretEnv,provider:Provider,upstream:typeof fetch=fetch):Promise<Catalog>{
 const key=runtimeKey(env,provider);let status='Missing runtime key',models:CatalogModel[]=[];
 if(key)try{
  const response=await upstream(PROVIDERS[provider].models,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000),redirect:'error'});
  status=response.ok?'Catalog reachable':`HTTP ${response.status}`;
  if(response.ok){const data=await boundedJson(response,3000000);if(!Array.isArray(data.data))throw Error();models=data.data.filter((m:any)=>typeof m.id==='string'&&/^[a-zA-Z0-9_.:/-]{1,160}$/.test(m.id)).slice(0,1500).map((m:any)=>({id:m.id,free:provider==='openrouter'&&m.id.endsWith(':free')&&m.pricing&&['prompt','completion','request'].every(k=>m.pricing[k]!==undefined&&Number(m.pricing[k])===0)}));}
 }catch{status='Catalog check failed';models=[];}
 const result={provider,checked:Date.now(),status,models};
 await env.DB!.prepare('INSERT INTO ai_provider_catalog(provider,checked,status,models) VALUES(?,?,?,?) ON CONFLICT(provider) DO UPDATE SET checked=excluded.checked,status=excluded.status,models=excluded.models').bind(provider,result.checked,status,JSON.stringify(models)).run();return result;
}
export function eligible(route:Route,settings:Settings,catalog:Catalog|undefined,env:SecretEnv){
 if(!runtimeKey(env,route.provider)||!catalog||catalog.status!=='Catalog reachable'||Date.now()-catalog.checked>3600000)return false;
 const model=catalog.models.find(m=>m.id===route.model);return !!model&&(route.provider==='nvidia'?settings.prototypeConfirmed:model.free);
}
export async function routeChat(env:SecretEnv,body:any,task:Task,signal:AbortSignal,upstream:typeof fetch=fetch):Promise<Response>{
 signal=AbortSignal.any([signal,AbortSignal.timeout(75000)]);
 const settings=await routingSettings(env);
 if(!settings.enabled)return Response.json({error:'Enable routing in Owner → AI models first.'},{status:503});
 const catalog=await catalogs(env),routes=settings.routes[task];
 const selected=(settings.fallback?routes:routes.slice(0,1)).filter(r=>eligible(r,settings,catalog.find(c=>c.provider===r.provider),env));
 if(!selected.length)return Response.json({error:'No eligible route. Check runtime keys, refresh catalogs, and select a permitted model.'},{status:503});
 const day=new Date().toISOString().slice(0,10);
 for(const route of selected){
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  // Atomic reservation counts failures too; no inference request escapes the daily cap.
  const budget=await env.DB!.prepare('INSERT INTO ai_router_budget(day,count) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count').bind(day,settings.dailyAttempts).first();
  if(!budget)return Response.json({error:'Routing daily attempt limit reached.'},{status:429});
  const started=Date.now();let response:Response;
  try{response=await upstream(PROVIDERS[route.provider].chat,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+runtimeKey(env,route.provider),'Content-Type':'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(25000)]),body:JSON.stringify({model:route.model,messages:body.messages,max_tokens:Math.min(body.max_tokens||4096,8192),stream:false,...(route.provider==='openrouter'?{provider:{max_price:{prompt:0,completion:0,request:0},allow_fallbacks:false}}:{})})});}catch{response=new Response(null,{status:502});}
  let data:any;let status=response.status;
  if(response.ok)try{data=await boundedJson(response,2000000);if(typeof data.choices?.[0]?.message?.content!=='string'||!data.choices[0].message.content.trim())throw Error();}catch{status=502;}
  const token=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0?Number(v):null;
  await env.DB!.prepare('INSERT INTO ai_router_usage(id,day,provider,model,task,status,latency,input_tokens,output_tokens) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),day,route.provider,route.model,task,status,Date.now()-started,token(data?.usage?.prompt_tokens),token(data?.usage?.completion_tokens)).run();
  if(status>=200&&status<300){
   const headers={'X-SkyData-Model':route.provider+'/'+route.model,'Cache-Control':'no-store'};
   // Buffer before delivery: fallback cannot duplicate a partial answer. Existing UI consumes SSE.
   if(body.stream)return new Response('data: '+JSON.stringify({choices:[{delta:{content:data.choices[0].message.content}}]})+'\n\ndata: [DONE]\n\n',{headers:{...headers,'Content-Type':'text/event-stream'}});
   return Response.json(data,{headers});
  }
  if(![429,500,502,503,504].includes(status))return Response.json({error:`${PROVIDERS[route.provider].name} rejected the request (HTTP ${status}).`},{status:status>=400&&status<=599?status:502});
 }
 return Response.json({error:'Configured routes are unavailable. No paid fallback was used.'},{status:503});
}
