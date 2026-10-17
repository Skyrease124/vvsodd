import {readKey,saveKey,type SecretEnv} from './secret-store';
// AI image generation and editing through OpenRouter (default: a FLUX "klein" model), owner-only: image models cost money per image.
// The model id is a setting (saved encrypted) because OpenRouter's catalogue changes and the id cannot be checked from the build.
// A model id starting with "nvidia:" runs on NVIDIA's hosted API (same NVIDIA key as chat); anything else goes through OpenRouter.
export const DEFAULT_IMAGE_MODEL='nvidia:black-forest-labs/flux.3-image-klein';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers});
const MODEL=/^(?:nvidia:)?[a-z0-9][a-z0-9._-]{0,40}\/[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$/;
const DATA_URL=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const imageModel=async(env:SecretEnv)=>(await readKey(env,'OPENROUTER_IMAGE_MODEL'))||DEFAULT_IMAGE_MODEL;
// Pulls the first generated image out of the several shapes OpenRouter and its providers use.
export function extractImage(data:any):string|null{
 const art=data?.artifacts?.[0]?.base64??data?.image??data?.data?.[0]?.b64_json;
 if(typeof art==='string'&&art.length>100){if(DATA_URL.test(art))return art;if(/^[A-Za-z0-9+/=]+$/.test(art))return 'data:image/'+(art.startsWith('iVBOR')?'png':art.startsWith('UklGR')?'webp':'jpeg')+';base64,'+art;}
 const m=data?.choices?.[0]?.message;if(!m)return null;
 const fromImages=m.images?.find?.((i:any)=>typeof i?.image_url?.url==='string'||typeof i?.url==='string');
 const url=fromImages?.image_url?.url??fromImages?.url;if(typeof url==='string'&&DATA_URL.test(url))return url;
 if(Array.isArray(m.content)){for(const p of m.content){const u=p?.image_url?.url;if(typeof u==='string'&&DATA_URL.test(u))return u;}}
 if(typeof m.content==='string'){const x=m.content.match(/data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+/);if(x)return x[0];}
 return null;
}
export async function handleImageGenerate(request:Request,env:SecretEnv,admin:boolean,upstream:typeof fetch=fetch){
 const path=new URL(request.url).pathname;
 // Image models are paid (about $0.04 per image on OpenRouter), so only the owner can spend the OpenRouter credits.
 if(!admin)return json({error:'AI images are owner-only because each image costs money.'},403);
 try{
  if(path==='/api/image-model'&&request.method==='GET')return json({model:await imageModel(env),default:DEFAULT_IMAGE_MODEL});
  if(request.method!=='POST')return json({error:'Use POST.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Send JSON.'},415);
  const raw=await request.text();if(raw.length>7_000_000)return json({error:'That photo is too large. Try a smaller one.'},413);
  const b=JSON.parse(raw);
  if(path==='/api/image-model'){
   if(!admin)return json({error:'Only the owner can change the image model.'},403);
   if(typeof b.model!=='string'||!MODEL.test(b.model.trim()))return json({error:'Paste the model id exactly as OpenRouter shows it, like black-forest-labs/some-model.'},400);
   await saveKey(env,b.model.trim(),'OPENROUTER_IMAGE_MODEL');return json({model:b.model.trim()});
  }
  if(typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>1500)return json({error:'Describe the image in up to 1,500 characters.'},400);
  if(b.image!==undefined&&(typeof b.image!=='string'||!DATA_URL.test(b.image)||b.image.length>6_000_000))return json({error:'Send a JPEG, PNG or WebP photo under 4 MB.'},400);
  const model=await imageModel(env);
  if(model.startsWith('nvidia:'))return nvidiaImage(env,model.slice(7),b.prompt.trim(),b.image,upstream);
  const key=await readKey(env,'OPENROUTER_API_KEY');if(!key)return json({error:'Open Connect OpenRouter in the plus menu and add your OpenRouter key first.',code:'setup_required'},503);
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

// NVIDIA's hosted image API: POST ai.api.nvidia.com/v1/genai/<model>. Long jobs answer 202 and are polled until the deadline.
async function nvidiaImage(env:SecretEnv,model:string,prompt:string,image:string|undefined,upstream:typeof fetch){
 const key=await readKey(env);if(!key)return json({error:'SkyData needs its NVIDIA API key before it can make images.',code:'setup_required'},503);
 const deadline=Date.now()+26000,auth={Authorization:'Bearer '+key,Accept:'application/json'};
 const body={prompt,width:1024,height:1024,steps:28,cfg_scale:4,seed:0,...(image?{image}:{})};
 let r=await upstream('https://ai.api.nvidia.com/v1/genai/'+model,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(26000)});
 const reqId=r.headers.get('NVCF-REQID');
 while(r.status===202&&reqId&&Date.now()<deadline){await new Promise(x=>setTimeout(x,1500));r=await upstream('https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/'+reqId,{headers:auth,signal:AbortSignal.timeout(Math.max(2000,deadline-Date.now()))});}
 if(r.status===202)return json({error:'NVIDIA is still working on the image after 25 seconds. Try again; busy free endpoints can be slow. Model: '+model},504);
 if(!r.ok){
  let detail=(await r.text().catch(()=>'')).slice(0,1500);try{const j=JSON.parse(detail);detail=typeof j==='string'?j:j.detail||j.error?.message||j.error||j.message||detail;if(typeof detail!=='string')detail=JSON.stringify(detail);}catch{}
  detail=detail.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,500);
  console.warn('SkyData NVIDIA image request rejected',{status:r.status,model,detail:detail.slice(0,200)});
  return json({error:'NVIDIA refused the image request (HTTP '+r.status+')'+(detail?': '+detail:'.')+' Model: '+model},r.status===429?429:502);
 }
 const out=extractImage(await r.json().catch(()=>null));
 if(!out)return json({error:'NVIDIA answered but returned no image. Model: '+model},502);
 return json({image:out,model:'nvidia:'+model});
}
