import { saveKey, type SecretEnv } from './secret-store';

export async function setupOpenRouterKey(request:Request,env:SecretEnv) {
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='POST')return Response.json({error:'Use POST.'},{status:405,headers});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403,headers});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Send JSON.'},{status:415,headers});
 try {
  const raw=await request.text();if(raw.length>2048)throw Error('Paste only your complete OpenRouter API key.');
  const {key}=JSON.parse(raw);
  if(typeof key!=='string')throw Error('Paste your OpenRouter API key.');
  const value=key.trim();
  if(value.length<20||value.length>1024||!/^[\x21-\x7e]+$/.test(value))throw Error('Paste only the complete key, without spaces or code.');
  // Authenticate the key independently of model capacity and inference quotas.
  const response=await fetch('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+value},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(response.status===401||response.status===403?'OpenRouter rejected this key. Copy the complete key and try again.':response.status===429?'OpenRouter key verification is temporarily rate limited. Try again shortly.':'OpenRouter could not verify this key. Try again shortly.');
  const data=await response.json() as {data?:{is_management_key?:boolean;is_provisioning_key?:boolean}};
  if(!data.data||typeof data.data!=='object')throw Error('OpenRouter returned an invalid verification response. Try again.');
  if(data.data.is_management_key||data.data.is_provisioning_key)throw Error('Use a regular OpenRouter API key for chat, not a management key.');
  await saveKey(env,value,'OPENROUTER_API_KEY');
  return Response.json({configured:true},{headers});
 }catch(error){return Response.json({error:error instanceof SyntaxError?'OpenRouter returned an invalid response. Try again.':error instanceof Error?error.message:'Could not connect OpenRouter.'},{status:502,headers});}
}
