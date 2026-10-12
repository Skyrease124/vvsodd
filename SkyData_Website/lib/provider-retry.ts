const temporary = new Set([429, 500, 502, 503, 504]);
export function retryableStatus(status:number){return temporary.has(status);}
function pause(ms:number,signal?:AbortSignal|null){
 return new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  const abort=()=>{clearTimeout(timer);reject(signal?.reason);};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
 });
}
export async function providerFetch(url:string,init:RequestInit,upstream:typeof fetch=fetch,wait=pause){
 for(let attempt=0;attempt<3;attempt++){
  let response:Response;
  try{response=await upstream(url,init);}catch(error){
   if(init.signal?.aborted||attempt===2)throw error;
   await wait(800*2**attempt,init.signal);continue;
  }
  if(!retryableStatus(response.status)||attempt===2)return response;
  const seconds=Number(response.headers.get('retry-after'));
  const delay=Math.max(800*2**attempt,Number.isFinite(seconds)?Math.min(5000,seconds*1000):0);
  await response.body?.cancel();
  await wait(delay,init.signal);
 }
 throw new Error('Voice service did not respond.');
}
