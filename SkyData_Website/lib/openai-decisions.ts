import { saveKey, type SecretEnv } from './secret-store';

export const DECISIONS_MODEL = 'gpt-6-luna';
export const DECISIONS_ENDPOINT = 'https://api.openai.com/v1/decisions';
export const decisionsError = (status:number) => status===401||status===403
 ? 'OpenAI could not authorize Decisions. Check your key and project access.'
 : status===429 ? 'OpenAI reached a usage or rate limit. Check your API billing and limits, then try again.'
 : 'OpenAI Decisions is unavailable. Your input is kept; try again later.';

export async function setupOpenAIKey(request:Request,env:SecretEnv,upstream:typeof fetch=fetch) {
 const headers={'Cache-Control':'no-store'};
 const fail=(error:string,status:number)=>Response.json({error},{status,headers});
 if(request.method!=='POST')return fail('Use POST.',405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Request origin is not allowed.',403);
 if(!request.headers.get('content-type')?.includes('application/json'))return fail('Send JSON.',415);
 try {
  const raw=await request.text();if(raw.length>2048)return fail('Paste only your complete OpenAI API key.',400);
  const {key}=JSON.parse(raw);
  if(typeof key!=='string'||!/^sk-[\x21-\x7e]{17,1021}$/.test(key.trim()))return fail('Paste your complete OpenAI API key, without spaces or code.',400);
  const value=key.trim();
  // Verify the exact endpoint and model before replacing the saved connection.
  const response=await upstream(DECISIONS_ENDPOINT,{method:'POST',headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},body:JSON.stringify({model:DECISIONS_MODEL,input:'The item is broken.',questions:[{name:'connection_check',type:'predicate',instructions:'Does the text say the item is broken?'}]}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)return fail(decisionsError(response.status),response.status===429?429:502);
  const data=await response.json() as {answers?:{name?:string;type?:string;probability?:number}[]};
  const answer=data.answers?.find(a=>a.name==='connection_check');
  if(answer?.type!=='predicate'||typeof answer.probability!=='number'||!Number.isFinite(answer.probability)||answer.probability<0||answer.probability>1)return fail('OpenAI returned an invalid connection check. Your saved key was not changed.',502);
  await saveKey(env,value,'OPENAI_API_KEY');
  return Response.json({configured:true},{headers});
 }catch{return fail('Could not verify or save your OpenAI key. Try again.',503);}
}
