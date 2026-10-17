import {readKey,saveKey,type SecretEnv} from './secret-store';
// AI image generation and editing through OpenRouter (default: a FLUX "klein" model). Owner-only while it is tested.
// The model id is a setting (saved encrypted) because OpenRouter's catalogue changes and the id cannot be checked from the build.
export const DEFAULT_IMAGE_MODEL='black-forest-labs/flux.2-klein-4b';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers});
const MODEL=/^[a-z0-9][a-z0-9._-]{0,40}\/[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$/;
const DATA_URL=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const imageModel=async(env:SecretEnv)=>(await readKey(env,'OPENROUTER_IMAGE_MODEL'))||DEFAULT_IMAGE_MODEL;
// Pulls the first generated image out of the several shapes OpenRouter and its providers use.
export function extractImage(data:any):string|null{
 const m=data?.choices?.[0]?.message;if(!m)return null;
 const fromImages=m.images?.find?.((i:any)=>typeof i?.image_url?.url==='string'||typeof i?.url==='string');
 const url=fromImages?.image_url?.url??fromImages?.url;if(typeof url==='string'&&DATA_URL.test(url))return url;
 if(Array.isArray(m.content)){for(const p of m.content){const u=p?.image_url?.url;if(typeof u==='string'&&DATA_URL.test(u))return u;}}
 if(typeof m.content==='string'){const x=m.content.match(/data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+/);if(x)return x[0];}
 return null;
}
export async function handleImageGenerate(request:Request,env:SecretEnv,admin:boolean,upstream:typeof fetch=fetch){
 const path=new URL(request.url).pathname;
 if(!admin)return json({error:'AI images are owner-only while they are being tested.'},403);
 try{
  if(path==='/api/image-model'&&request.method==='GET')return json({model:await imageModel(env),default:DEFAULT_IMAGE_MODEL});
  if(request.method!=='POST')return json({error:'Use POST.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Send JSON.'},415);
  const raw=await request.text();if(raw.length>7_000_000)return json({error:'That photo is too large. Try a smaller one.'},413);
  const b=JSON.parse(raw);
  if(path==='/api/image-model'){
   if(typeof b.model!=='string'||!MODEL.test(b.model.trim()))return json({error:'Paste the model id exactly as OpenRouter shows it, like black-forest-labs/some-model.'},400);
   await saveKey(env,b.model.trim(),'OPENROUTER_IMAGE_MODEL');return json({model:b.model.trim()});
  }
  if(typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>1500)return json({error:'Describe the image in up to 1,500 characters.'},400);
  if(b.image!==undefined&&(typeof b.image!=='string'||!DATA_URL.test(b.image)||b.image.length>6_000_000))return json({error:'Send a JPEG, PNG or WebP photo under 4 MB.'},400);
  const key=await readKey(env,'OPENROUTER_API_KEY');if(!key)return json({error:'Open Connect OpenRouter in the plus menu and add your OpenRouter key first.',code:'setup_required'},503);
  const model=await imageModel(env);
  const content=b.image?[{type:'text',text:b.prompt.trim()},{type:'image_url',image_url:{url:b.image}}]:b.prompt.trim();
  const ask=async(modalities:string[])=>upstream('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','X-Title':'SkyData'},body:JSON.stringify({model,messages:[{role:'user',content}],modalities,stream:false}),signal:AbortSignal.timeout(26000)});
  let r=await ask(['image']);
  if(r.status===400){const t=await r.clone().text().catch(()=>'');if(/modalit/i.test(t))r=await ask(['image','text']);}
  if(!r.ok){
   let detail=(await r.text().catch(()=>'')).slice(0,1500);try{const j=JSON.parse(detail);detail=typeof j.error==='string'?j.error:j.error?.message||j.message||detail;}catch{}
   detail=detail.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,400);
   console.warn('SkyData image request rejected',{status:r.status,model,detail:detail.slice(0,200)});
   return json({error:(r.status===401?'OpenRouter rejected the key. Open Connect OpenRouter and add it again.':r.status===429?'The free image model is busy or its limit was reached. Try again in a minute.':'OpenRouter refused the request (HTTP '+r.status+')'+(detail?': '+detail:'.'))+' Model: '+model},r.status===429?429:502);
  }
  const image=extractImage(await r.json().catch(()=>null));
  if(!image)return json({error:'The model answered but returned no image. Model: '+model+'. Check that this id is an image model.'},502);
  return json({image,model});
 }catch(e){
  const timeout=e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError');
  return json({error:timeout?'The image model took too long (over 25 seconds). Try again, or a shorter prompt.':'Image request could not complete.'},timeout?504:503);
 }
}
