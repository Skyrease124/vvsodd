import { setupCoinGeckoKey } from './crypto-prices';
import { setupOpenAIKey } from './openai-decisions';
import { setupOpenRouterKey } from './openrouter';
import { setupWebKey } from './live-info';
import { setupVisionKey } from './vision';
import { setupVoiceKey } from './voice';
import { setupKey, type SecretEnv } from './secret-store';

const escape = (value:string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function connectionPage(message = '', connected = false, status = 200, csrf = '', voice = false, vision = false, web = false, deepseek = false, gpt = false, router = false, openai = false, coingecko = false) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Connect ${coingecko?'CoinGecko':openai?'OpenAI Decisions':'AI'} · SkyData</title><style>body{margin:0;background:#080d17;color:#f1f5fa;font-family:Arial,sans-serif}main{max-width:480px;margin:8vh auto;padding:28px}h1{font-size:30px}p{line-height:1.6;color:#b7c9df}label{display:block;margin-bottom:12px}input,button{box-sizing:border-box;width:100%;font:inherit;font-size:16px;border-radius:10px;padding:16px}input{border:1px solid #56718d;background:#111d2e;color:white}button{margin-top:18px;background:#9bdfff;border:0;color:#082036;cursor:pointer}a{color:#9bdfff;display:inline-block;margin-top:24px}.result{padding:18px;border:1px solid ${connected?'#76d9ad':'#ffb8ba'};border-radius:10px;color:${connected?'#76d9ad':'#ffb8ba'}}</style></head><body><main><h1>${connected?(coingecko?'Crypto prices connected':openai?'OpenAI Decisions connected':router?'OpenRouter connected':gpt?'GPT-OSS connected':deepseek?'DeepSeek connected':web?'Web search connected':vision?'Camera connected':voice?'Voice connected':'Connected to SkyData'):(coingecko?'Connect crypto prices':openai?'Connect OpenAI Decisions':router?'Connect OpenRouter':gpt?'Connect GPT-OSS':deepseek?'Connect DeepSeek':web?'Connect SkyData web search':vision?'Connect SkyData camera':voice?'Connect SkyData voice':'Connect SkyData')}</h1>${message?`<p class="result" role="${connected?'status':'alert'}">${escape(message)}</p>`:''}${connected?'':`<p>${coingecko?'Paste your CoinGecko Demo API key here. Connecting checks one Bitcoin price using your free allowance.':openai?'Paste your OpenAI API key for the Decisions beta here. Connecting sends one small paid test request.':router?'Paste your OpenRouter API key for Luna Decisions here.':gpt?'Paste your separate NVIDIA API key for GPT-OSS 20B here.':deepseek?'Paste your DeepSeek API key here to connect Flash and Pro. These paid models are currently owner-only.':web?'Get your Tavily API key from <a href="https://app.tavily.com" target="_blank" rel="noopener noreferrer">Tavily</a>, then paste it here.':vision?'Paste your NVIDIA Nano Omni API key here.':voice?'Paste your NVIDIA Magpie voice key here.':'Paste your NVIDIA API key here.'} SkyData verifies it ${coingecko?'with CoinGecko':openai?'with OpenAI':router?'with OpenRouter':deepseek?'with DeepSeek':web?'with Tavily':'with NVIDIA'} and saves it encrypted.</p><form action="${coingecko?'/connect-crypto':openai?'/connect-openai':router?'/connect-openrouter':gpt?'/connect-gpt':deepseek?'/connect-deepseek':web?'/connect-web':vision?'/connect-camera':voice?'/connect-voice':'/connect'}" method="post"><input type="hidden" name="csrf" value="${escape(csrf)}"><label for="key">${coingecko?'CoinGecko Demo':openai?'OpenAI':router?'OpenRouter':deepseek?'DeepSeek':web?'Tavily':'NVIDIA'} API key</label><input id="key" name="key" type="password" required maxlength="1024" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Paste your complete API key"><button type="submit">Connect</button><p id="progress" role="status">Checking can take up to a minute. The result will appear on this page.</p></form>`}<a href="/" target="_top">Back to SkyData chat</a></main><script>document.querySelector('form')?.addEventListener('submit',function(){const b=this.querySelector('button');b.textContent='Connecting…';b.disabled=true;document.getElementById('progress').textContent='Checking your key. Please wait…';});</script></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}

async function csrfKey(env:SecretEnv) {
  if(!env.SKYDATA_SECRET_KEY)throw new Error('Connection security unavailable');
  return crypto.subtle.importKey('raw',new TextEncoder().encode('skydata-connect-csrf:'+env.SKYDATA_SECRET_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export async function issueCsrf(request:Request,env:SecretEnv) {
  const payload=Date.now()+'.'+hex(crypto.getRandomValues(new Uint8Array(16)));
  const signature=await crypto.subtle.sign('HMAC',await csrfKey(env),new TextEncoder().encode(payload+':'+request.headers.get('oai-authenticated-user-id')));
  return payload+'.'+hex(new Uint8Array(signature));
}
export async function verifyCsrf(token:string,request:Request,env:SecretEnv) {
  const parts=token.split('.');
  if(parts.length!==3||!/^\d{13}$/.test(parts[0])||!/^[a-f0-9]{32}$/.test(parts[1])||!/^[a-f0-9]{64}$/.test(parts[2]))return false;
  const age=Date.now()-Number(parts[0]);if(age<0||age>600000)return false;
  const signature=Uint8Array.from(parts[2].match(/../g)!,v=>parseInt(v,16));
  return crypto.subtle.verify('HMAC',await csrfKey(env),signature,new TextEncoder().encode(parts[0]+'.'+parts[1]+':'+request.headers.get('oai-authenticated-user-id')));
}
export async function handleConnectionPage(request:Request, env:SecretEnv, voice=false, vision=false, web=false, deepseek=false,gpt=false,router=false,openai=false,coingecko=false) {
  try {
    const csrf=await issueCsrf(request,env);
    const page=(message='',connected=false,status=200)=>connectionPage(message,connected,status,csrf,voice,vision,web,deepseek,gpt,router,openai,coingecko);
    if(request.method==='GET')return page();
    if(request.method!=='POST')return page('Use the Connect button to submit your key.',false,405);
    // Embedded app browsers may submit same-origin forms with an opaque Origin.
    // A signed, expiring, user-bound token protects that flow from cross-site writes.
    const origin=request.headers.get('origin');
    if(origin!==new URL(request.url).origin && !(origin==='null'&&request.headers.get('sec-fetch-site')==='same-origin'))return page('Open the connection page from SkyData and try again.',false,403);
    if(!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded'))return page('Use the key field below.',false,415);
    const body=await request.text();
    if(body.length>4096)return page('Paste only your API key, without extra code.',false,400);
    const form=new URLSearchParams(body);
    if(!await verifyCsrf(form.get('csrf')||'',request,env))return page('The setup page expired. Paste your key below and try again.',false,403);
    const key=form.get('key');
    const setupRequest=new Request(new URL('/api/setup',request.url),{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(request.url).origin},body:JSON.stringify({key})});
    const response=await (coingecko?setupCoinGeckoKey(setupRequest,env):openai?setupOpenAIKey(setupRequest,env):(router?setupOpenRouterKey:web?setupWebKey:vision?setupVisionKey:voice?setupVoiceKey:setupKey)(setupRequest,env,deepseek,gpt));
    const result=await response.json() as {configured?:boolean;error?:string};
    return response.ok&&result.configured?page(coingecko?'Your CoinGecko key was verified and saved. Return to chat and ask “What is Bitcoin’s price?”':openai?'Your OpenAI key was verified and saved. Open Decisions from the chat menu to try it.':router?'Your OpenRouter key was verified and saved. Return to SkyData to use Luna Decisions.':deepseek?'Your DeepSeek key was verified and saved for Flash and Pro. Return to chat and select either model.':'Your key was verified and saved. You can return to chat.',true):page(result.error||'Could not connect. Please try again.',false,response.status);
  } catch {return connectionPage('Could not connect. Reload this page and try again.',false,503,'',voice,vision,web,deepseek,gpt,router,openai,coingecko);}
}
