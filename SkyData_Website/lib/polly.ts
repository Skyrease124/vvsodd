import { PollyClient, DescribeVoicesCommand, SynthesizeSpeechCommand, type Voice, type SynthesizeSpeechCommandInput } from '@aws-sdk/client-polly';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';
import { readKey,saveKey,type SecretEnv } from './secret-store';
import { isSiteAdmin } from './site-admin';
import { issueCsrf,verifyCsrf } from './connection-page';
import { accessPage,escape } from './access';
import { POLLY_ENGINES,voiceSettings,normalizeVoiceSettings,voiceOriginAllowed,type VoiceSettings,type PollyEngine } from './voice-config';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export type PollyTransport={send:(command:DescribeVoicesCommand|SynthesizeSpeechCommand,options?:{abortSignal?:AbortSignal})=>Promise<any>};
export class PollyError extends Error {constructor(message:string,public code='VOICE_UNAVAILABLE',public status=503){super(message);}}
export function pollyConnectionDiagnostic(error:unknown){
 const e=error as {name?:unknown;message?:unknown;cause?:{name?:unknown;message?:unknown};$metadata?:{httpStatusCode?:unknown}};
 const known=/^(AccessDeniedException|UnauthorizedException|InvalidSignatureException|SignatureDoesNotMatch|UnrecognizedClientException|InvalidClientTokenId|ExpiredTokenException|TimeoutError|AbortError|ThrottlingException|TooManyRequestsException|TypeError|ReferenceError|Error)$/;
 const name=typeof e?.name==='string'&&known.test(e.name)?e.name:'UnknownError';
 const text=[e?.name,e?.message,e?.cause?.name,e?.cause?.message].filter(v=>typeof v==='string').join(' ');
 const category=/AccessDenied|Unauthorized/.test(text)?'permission':/InvalidSignature|SignatureDoesNotMatch|UnrecognizedClient|InvalidClientTokenId|ExpiredToken/.test(text)?'credentials':/Timeout|Abort|timed out/i.test(text)?'timeout':/Throttl|TooMany/.test(text)?'rate-limit':/fetch failed|Failed to fetch|NetworkError|ENOTFOUND|ECONN/i.test(text)?'network':/crypto|not implemented|not supported|is not defined/i.test(text)?'runtime':'unavailable';
 const httpStatus=typeof e?.$metadata?.httpStatusCode==='number'?e.$metadata.httpStatusCode:undefined;
 // Never emit exception messages, request headers, URLs, or credential values.
 return {name,category,...(httpStatus!==undefined?{httpStatus}:{})};
}
export function pollyError(error:unknown){
 if(error instanceof PollyError)return error;
 const name=(error as {name?:string})?.name||'';
 if(/AccessDenied|Unauthorized|InvalidSignature|UnrecognizedClient|ExpiredToken/.test(name))return new PollyError('Voice access was denied. The owner can check the speech credentials and permissions.','ACCESS',403);
 if(/Throttl|TooMany|LimitExceeded/.test(name))return new PollyError('Voice is temporarily rate-limited. Text chat is still available.','RATE_LIMIT',429);
 if(/EngineNotSupported|InvalidParameter|InvalidSsml/.test(name))return new PollyError('That voice and speech engine combination is unavailable. Choose a compatible voice.','COMPATIBILITY',400);
 return new PollyError('Voice is unavailable. Your text response is preserved.','VOICE_UNAVAILABLE',503);
}
export async function pollyReady(env:SecretEnv){return Boolean(await readKey(env,'AWS_ACCESS_KEY_ID')&&await readKey(env,'AWS_SECRET_ACCESS_KEY'));}
async function client(env:SecretEnv):Promise<PollyTransport>{
 const accessKeyId=await readKey(env,'AWS_ACCESS_KEY_ID'),secretAccessKey=await readKey(env,'AWS_SECRET_ACCESS_KEY'),sessionToken=await readKey(env,'AWS_SESSION_TOKEN');
 if(!accessKeyId||!secretAccessKey)throw new PollyError('Voice is not connected. The owner can connect the speech service in Voice Management.','NOT_CONFIGURED');
 return new PollyClient({region:'us-east-1',credentials:{accessKeyId,secretAccessKey,...(sessionToken?{sessionToken}:{})},requestHandler:new FetchHttpHandler({requestTimeout:60000}),maxAttempts:1});
}
// Short-lived server-only catalog; never substitute a hardcoded voice/engine list.
const catalogs=new WeakMap<object,{expires:number;voices:Voice[]}>();
export async function pollyVoices(env:SecretEnv,transport?:PollyTransport):Promise<Voice[]>{
 const saved=env.DB&&catalogs.get(env.DB);if(!transport&&saved&&saved.expires>Date.now())return saved.voices;
 const api=transport||await client(env);let voices:Voice[]=[],NextToken:string|undefined;const seen=new Set<string>();
 do {const result=await api.send(new DescribeVoicesCommand({IncludeAdditionalLanguageCodes:true,...(NextToken?{NextToken}:{})})).catch(error=>{throw pollyError(error);});voices.push(...(result.Voices||[]));NextToken=result.NextToken;if(NextToken){if(seen.has(NextToken))throw new PollyError('The voice catalog could not load.');seen.add(NextToken);}}while(NextToken);
 voices=voices.filter(v=>v.Id&&v.SupportedEngines?.length);
 if(!transport&&env.DB)catalogs.set(env.DB,{expires:Date.now()+300000,voices});return voices;
}
export function compatibleVoice(voices:Voice[],engine:PollyEngine,id:string){const voice=voices.find(v=>v.Id===id&&v.SupportedEngines?.includes(engine));if(!voice)throw new PollyError('Choose a voice compatible with this speech engine.','COMPATIBILITY',400);return voice;}
export function pollyInput(text:string,settings:VoiceSettings,voice:Voice):SynthesizeSpeechCommandInput{
 const speed=settings.engine==='generative'?1:settings.speed;
 const escaped=text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
 return {Engine:settings.engine,VoiceId:voice.Id,LanguageCode:voice.LanguageCode,OutputFormat:'mp3',SampleRate:'24000',TextType:speed===1?'text':'ssml',Text:speed===1?text:`<speak><prosody rate="${Math.round(speed*100)}%">${escaped}</prosody></speak>`};
}
const month=()=>new Date().toISOString().slice(0,7);
async function activity(env:SecretEnv,id:string,settings:VoiceSettings,characters:number,cost:number|null,status:string,code:string|null=null){await env.DB!.prepare('INSERT INTO polly_activity (id,created,engine,voice,characters,estimated_cost,status,code) VALUES (?,?,?,?,?,?,?,?)').bind(id,Date.now(),settings.engine,settings.voice,characters,cost,status,code).run();}
async function reserve(env:SecretEnv,settings:VoiceSettings,characters:number){
 const price=settings.prices[settings.engine],cost=price===null?null:characters*price/1000000,m=month();
 await env.DB!.prepare('INSERT INTO polly_months (month) VALUES (?) ON CONFLICT DO NOTHING').bind(m).run();
 const row=await env.DB!.prepare('UPDATE polly_months SET characters=characters+?,requests=requests+1,estimated_cost=estimated_cost+?,unpriced_characters=unpriced_characters+? WHERE month=? AND characters+?<=? AND (? IS NULL OR (unpriced_characters=0 AND estimated_cost+?<=?)) RETURNING characters').bind(characters,cost||0,cost===null?characters:0,m,characters,settings.monthlyCharacters,settings.monthlyBudget,cost||0,settings.monthlyBudget).first();
 if(!row)throw new PollyError('The voice usage safeguard has been reached. Text chat remains available.','USAGE_LIMIT',429);
 return cost;
}
async function cacheKey(user:string,text:string,settings:VoiceSettings){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([user,text,settings.engine,settings.voice,settings.speed])));return 'polly-audio/'+Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')+'.mp3';}
export async function pollySpeech(request:Request,env:SecretEnv,preview=false,transport?:PollyTransport){
 const fail=(e:unknown)=>{const error=pollyError(e);return Response.json({error:error.message,code:error.code,retryable:error.status===429&&error.code!=='USAGE_LIMIT'},{status:error.status,headers});};
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return Response.json({error:'Sign in to use voice.'},{status:403,headers});
 if(preview&&!await isSiteAdmin(request,env))return Response.json({error:'Owner access only.'},{status:403,headers});
 if(request.method!=='POST')return Response.json({error:'Use POST.'},{status:405,headers});
 if(!voiceOriginAllowed(request))return Response.json({error:'Origin rejected.'},{status:403,headers});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Send JSON.'},{status:415,headers});
 if(!env.DB)return fail(new PollyError('Voice usage protection is unavailable.'));
 let settings:VoiceSettings|undefined,characters=0,id=crypto.randomUUID(),lease='',apiCalled=false;
 try{
  const raw=await request.text();if(raw.length>8000)throw new PollyError('Choose a shorter speech sample.','REQUEST',413);const data=JSON.parse(raw);
  if(typeof data.text!=='string'||!data.text.trim()||Array.from(data.text).length>2500)throw new PollyError('Use between 1 and 2,500 characters per speech section.','REQUEST',400);
  const text=data.text.trim();characters=Array.from(text).length;settings=await voiceSettings(env);
  if(!preview&&(!settings.enabled||settings.provider!=='polly'))throw new PollyError('Voice output is disabled. Text chat remains available.','DISABLED');
  if(preview){if(!POLLY_ENGINES.includes(data.engine)||typeof data.voice!=='string')throw new PollyError('Choose a valid voice and engine.','REQUEST',400);settings={...settings,engine:data.engine,voice:data.voice,speed:data.speed??settings.speed};settings=normalizeVoiceSettings(settings);}
  const key=await cacheKey(user,text,settings);
  const cached=env.FILES&&await env.FILES.get(key);if(cached&&Number(cached.customMetadata?.expires)>Date.now()){await activity(env,id,settings,characters,0,'cached');return new Response(cached.body,{headers:{...headers,'Content-Type':'audio/mpeg'}});}
  const voices=await pollyVoices(env,transport),voice=compatibleVoice(voices,settings.engine,settings.voice);
  lease=key;const now=Date.now();const lock=await env.DB.prepare('INSERT INTO polly_leases (id,expires) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET expires=excluded.expires WHERE polly_leases.expires<=? RETURNING expires').bind(lease,now+90000,now).first();
  if(!lock){lease='';throw new PollyError('This audio is already being prepared. Please wait.','IN_PROGRESS',429);}
  const cost=await reserve(env,settings,characters);
  // Reservations remain counted on ambiguous failures: a cancelled response may still incur AWS charges.
  await activity(env,id,settings,characters,cost,'pending');
  apiCalled=true;const response=await (transport||await client(env)).send(new SynthesizeSpeechCommand(pollyInput(text,settings,voice)),{abortSignal:AbortSignal.any([request.signal,AbortSignal.timeout(60000)])});
  if(!response.AudioStream)throw new PollyError('The speech service returned no audio.');
  const bytes=new Uint8Array(await response.AudioStream.transformToByteArray());if(bytes.length<1||bytes.length>12000000)throw new PollyError('The speech service returned invalid audio.');
  await env.DB.prepare("UPDATE polly_activity SET status='success' WHERE id=?").bind(id).run();
  if(env.FILES)try{await env.FILES.put(key,bytes,{httpMetadata:{contentType:'audio/mpeg'},customMetadata:{expires:String(Date.now()+86400000)}});}catch{/* Cache failure must not discard successfully generated audio. */}
  return new Response(bytes.buffer,{headers:{...headers,'Content-Type':'audio/mpeg'}});
 }catch(e){const error=e instanceof SyntaxError?new PollyError('Send valid voice settings.','REQUEST',400):pollyError(e);if(settings)try{if(apiCalled)await env.DB.prepare("UPDATE polly_activity SET status='failed',code=? WHERE id=?").bind(error.code,id).run();else await activity(env,id,settings,characters,null,'rejected',error.code);}catch{}return fail(error);
 }finally{if(lease)await env.DB.prepare('DELETE FROM polly_leases WHERE id=?').bind(lease).run();}
}
export async function pollyManagement(request:Request,env:SecretEnv,transport?:PollyTransport){
 if(!await isSiteAdmin(request,env))return Response.json({error:'Owner access only.'},{status:403,headers});
 if(!env.DB)return Response.json({error:'Settings storage is unavailable.'},{status:503,headers});
 try{
  if(request.method==='POST'){
   if(!voiceOriginAllowed(request))return Response.json({error:'Origin rejected.'},{status:403,headers});
   const raw=await request.text();if(raw.length>5000)throw new PollyError('Settings too large.','REQUEST',413);let settings:VoiceSettings;try{settings=normalizeVoiceSettings(JSON.parse(raw));}catch{throw new PollyError('Choose valid voice settings, compatible limits, and prices for every engine when using a dollar limit.','REQUEST',400);}
   if(settings.provider==='polly'&&settings.enabled)compatibleVoice(await pollyVoices(env,transport),settings.engine,settings.voice);
   await env.DB.prepare("INSERT INTO polly_settings (id,value) VALUES ('global',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(JSON.stringify(settings)).run();return Response.json({settings},{headers});
  }
  if(request.method!=='GET')return Response.json({error:'Use GET or POST.'},{status:405,headers});
  const settings=await voiceSettings(env);let voices:Voice[]=[],catalogError='';const configured=transport?true:await pollyReady(env);
  if(configured)try{voices=await pollyVoices(env,transport);}catch(e){catalogError=pollyError(e).message;}
  const totals=await env.DB.prepare('SELECT * FROM polly_months WHERE month=?').bind(month()).first<{characters:number;requests:number;estimated_cost:number;unpriced_characters:number}>();
  const byEngine=await env.DB.prepare("SELECT engine,COUNT(*) AS requests,SUM(characters) AS characters,SUM(estimated_cost) AS estimatedCost,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failures FROM polly_activity WHERE created>=? AND status IN ('pending','success','failed') GROUP BY engine").bind(Date.parse(month()+'-01T00:00:00Z')).all();
  const recent=await env.DB.prepare('SELECT created,engine,voice,characters,status,code FROM polly_activity ORDER BY created DESC LIMIT 30').all();
  const lifetime=await env.DB.prepare('SELECT SUM(requests) AS requests,SUM(characters) AS characters FROM polly_months').first();
  const failures=await env.DB.prepare("SELECT COUNT(*) AS count FROM polly_activity WHERE status IN ('failed','rejected')").first();
  const day=new Date().getUTCDate(),days=new Date(new Date().getUTCFullYear(),new Date().getUTCMonth()+1,0).getUTCDate();
  const charPercent=(totals?.characters||0)/settings.monthlyCharacters*100,costPercent=settings.monthlyBudget?(totals?.estimated_cost||0)/settings.monthlyBudget*100:0;
  return Response.json({settings,configured,catalogError,voices:voices.map(v=>({id:v.Id,name:v.Name,language:v.LanguageName,languageCode:v.LanguageCode,engines:v.SupportedEngines})),usage:{month:month(),requests:totals?.requests||0,characters:totals?.characters||0,estimatedCost:totals?.unpriced_characters?null:totals?.estimated_cost??null,unpricedCharacters:totals?.unpriced_characters||0,projectedCharacters:Math.round((totals?.characters||0)/day*days),byEngine:byEngine.results,recent:recent.results,lifetime,failures:failures?.count||0,alert:Math.max(charPercent,costPercent)>=settings.alertPercent},region:'us-east-1'},{headers});
 }catch(e){const error=pollyError(e);return Response.json({error:error.message,code:error.code},{status:error.status,headers});}
}
export async function pollyConnection(request:Request,env:SecretEnv){
 if(!await isSiteAdmin(request,env))return accessPage('Owner access only','<p>Only the owner can connect voice.</p>',403);
 let message='',error='',stage='form';
 const reference=crypto.randomUUID();
 if(request.method==='POST')try{
  if(!voiceOriginAllowed(request))throw new PollyError('Open this form from SkyData.');const raw=await request.text();if(raw.length>4096)throw new PollyError('Submit only the requested credentials.');const form=new URLSearchParams(raw);if(!await verifyCsrf(form.get('csrf')||'',request,env))throw new PollyError('This setup form expired. Reload and try again.');
  const accessKeyId=(form.get('access')||'').trim(),secretAccessKey=(form.get('secret')||'').trim();if(!/^[A-Z0-9]{16,128}$/.test(accessKeyId)||! /^[A-Za-z0-9/+=]{20,256}$/.test(secretAccessKey))throw new PollyError('Enter the complete access key ID and secret access key.');
  stage='aws-verification';
  const api=new PollyClient({region:'us-east-1',credentials:{accessKeyId,secretAccessKey},requestHandler:new FetchHttpHandler({requestTimeout:15000}),maxAttempts:1});await api.send(new DescribeVoicesCommand({}),{abortSignal:AbortSignal.timeout(15000)});
  stage='encrypted-save';
  if(!env.DB)throw new Error('Storage unavailable');
  // Validate encryption before writing either key; D1 batch saves both atomically.
  const oldDB=env.DB!;const statements:D1PreparedStatement[]=[];const staging={...env,DB:{...oldDB,prepare:(sql:string)=>({bind:(...values:unknown[])=>({run:async()=>{statements.push(oldDB.prepare(sql).bind(...values));}})})} as unknown as D1Database};
  await saveKey(staging,accessKeyId,'AWS_ACCESS_KEY_ID');await saveKey(staging,secretAccessKey,'AWS_SECRET_ACCESS_KEY');await oldDB.batch(statements);catalogs.delete(oldDB);message='Credentials saved encrypted. Voice discovery is verified. Use a preview to verify speech permission.';
 }catch(e){
  const diagnostic=pollyConnectionDiagnostic(e),{category}=diagnostic;
  console.error(JSON.stringify({event:'polly_connection_failed',stage,...diagnostic,reference}));
  error=stage==='form'?pollyError(e).message:stage==='encrypted-save'?'AWS verified your key, but SkyData could not save it securely. This connection was not saved.':category==='permission'?'AWS denied voice discovery. Check polly:DescribeVoices permission. Your keys were not saved.':category==='credentials'?'AWS rejected authentication. Check the matching access key ID and secret. Your keys were not saved.':category==='timeout'?'AWS verification timed out. Your keys were not saved. Try again.':category==='rate-limit'?'AWS verification is rate-limited. Your keys were not saved. Try again shortly.':'SkyData could not complete AWS verification. Your keys were not saved.';
  if(stage==='aws-verification'&&category==='network')error='SkyData could not reach AWS Polly. Your keys were not saved.';
  if(stage==='aws-verification'&&category==='runtime')error='SkyData encountered a server compatibility error while verifying AWS. Your keys were not saved.';
  error+=' Diagnostic: '+diagnostic.name+(diagnostic.httpStatus?' (HTTP '+diagnostic.httpStatus+')':'')+'. Reference: '+reference;
 }
 else if(request.method!=='GET')return new Response(null,{status:405});
 const csrf=await issueCsrf(request,env);
 return accessPage('Connect Amazon Polly',`<p>Region: US East (N. Virginia), us-east-1. Your site stays on its existing hosting.</p>${message?`<p class="success">${escape(message)}</p>`:''}${error?`<p class="error" role="alert">${escape(error)}</p>`:''}<section class="panel"><p>Use an IAM key with only <code>polly:DescribeVoices</code> and <code>polly:SynthesizeSpeech</code> permissions on <code>*</code>. These operations do not support voice-specific resource ARNs. No administrator access is needed.</p><p>Credentials are encrypted in the existing server-side secret store. You can alternatively configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY as server runtime secrets; AWS_REGION must be us-east-1.</p><form method="post" action="/connect-polly"><input type="hidden" name="csrf" value="${escape(csrf)}"><label>Access key ID<input name="access" required autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="128"></label><label>Secret access key<input name="secret" type="password" required autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="256"></label><button>Verify and connect</button></form></section><p>AWS billing depends on your account. No free allowance is assumed. Speech previews count toward your usage safeguards.</p><a class="button" href="/owner/voice">Open Voice Management</a>`);
}
