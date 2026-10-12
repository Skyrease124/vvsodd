import { readKey, saveKey, type SecretEnv } from './secret-store';
const BASE='https://api.coingecko.com/api/v3';
const aliases:Record<string,string>={btc:'bitcoin',bitcoin:'bitcoin',eth:'ethereum',ethereum:'ethereum',sol:'solana',solana:'solana',doge:'dogecoin',dogecoin:'dogecoin',xrp:'ripple',ripple:'ripple',ada:'cardano',cardano:'cardano',bnb:'binancecoin',ltc:'litecoin',litecoin:'litecoin',avax:'avalanche-2',avalanche:'avalanche-2',link:'chainlink',chainlink:'chainlink',dot:'polkadot',polkadot:'polkadot',shib:'shiba-inu',pepe:'pepe',usdt:'tether',tether:'tether',usdc:'usd-coin'};
type Coin={id:string;name:string;symbol:string};
type Quote={usd:number;usd_24h_change:number|null;last_updated_at:number};
const cached=new Map<string,{expires:number;quotes:Record<string,Quote>}>();
const fault=(status:number)=>status===401||status===403?'CoinGecko rejected the Demo key. Update it in Connect crypto prices.':status===429?'CoinGecko’s request limit was reached. Try again later.':'CoinGecko prices are unavailable. Try again later.';
async function get(path:string,key:string,signal:AbortSignal,upstream:typeof fetch){
 const response=await upstream(BASE+path,{headers:{'x-cg-demo-api-key':key,Accept:'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});
 if(!response.ok)throw new Error(fault(response.status));
 return response.json();
}
export async function setupCoinGeckoKey(request:Request,env:SecretEnv,upstream:typeof fetch=fetch){
 const headers={'Cache-Control':'no-store'};
 const fail=(error:string,status=400)=>Response.json({error},{status,headers});
 if(request.method!=='POST')return fail('Use POST.',405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return fail('Request origin is not allowed.',403);
 if(!request.headers.get('content-type')?.includes('application/json'))return fail('Send JSON.',415);
 try{
 const raw=await request.text();if(raw.length>2048)return fail('Paste only your CoinGecko Demo API key.');
 const {key}=JSON.parse(raw);if(typeof key!=='string'||!/^[-A-Za-z0-9_]{10,1024}$/.test(key.trim()))return fail('Paste your complete CoinGecko Demo API key, without spaces or code.');
 const value=key.trim();const data=await get('/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true',value,request.signal,upstream) as {bitcoin?:{usd?:number}};
 if(typeof data?.bitcoin?.usd!=='number'||!Number.isFinite(data.bitcoin.usd)||data.bitcoin.usd<=0)throw Error('CoinGecko returned an invalid price. Your saved key was not changed.');
 await saveKey(env,value,'COINGECKO_API_KEY');cached.clear();
 return Response.json({configured:true},{headers});
 }catch(error){return fail(error instanceof Error&&error.message.startsWith('CoinGecko')?error.message:'Could not verify or save your CoinGecko key. Try again.',502);}
}
export function priceQuery(text:string):string[]|null{
 // Only explicit current-price questions use the quote service. Other conversations stay unchanged.
 const brief=text.trim().toLowerCase().replace(/[?!.]/g,'');
 const bareCoin=Boolean(aliases[brief.replace(/^(?:and|what about|how about)\s+/, '').replace(/^\$/,'')]);
 if(text.length>400||/\b(historical|yesterday|last week|predict|forecast|should|buy|sell|future|tomorrow)\b/i.test(text)||(!bareCoin&&!(/\b(prices?|worth|trading at|quote)\b/i.test(text)||/\bhow much (?:is|are)\b/i.test(text))))return null;
 const found=Object.keys(aliases).filter(alias=>new RegExp('\\b'+alias+'\\b','i').test(text));
 if(found.length)return [...new Set(found.map(a=>aliases[a]))].slice(0,10);
 const match=text.match(/(?:price(?:s)? (?:of|for)|how much is|what(?:'s| is))\s+\$?([a-z0-9][a-z0-9 -]{0,50}?)(?:\s+(?:worth|price|trading|right now|today|in usd|in dollars)|[?!]|$)/i);
 if(!match)return null;
 const query=match[1].trim();if(/^(?:stocks?|shares?|apple|tesla|nvidia|gold|silver|it|this|that|the)\b/i.test(query))return null;
 return ['search:'+query];
}
export function cryptoPriceQuestion(messages:{role:string;content:string}[]):string {
 const text=messages.at(-1)?.content||'';
 if(priceQuery(text))return text;
 // Short follow-ups inherit the last price request, not the model's request for a key.
 const followup=/^(?:demo|pro|yes|ok(?:ay)?|try again|check again|refresh|what(?:'s| is) (?:it|the price)(?: now)?|how much(?: now)?|(?:i|it)[\s\S]{0,80}(?:key|api|connected)|(?:already|just)[\s\S]{0,60}(?:key|api|connected))[.!? ]*$/i.test(text.trim());
 if(!followup)return text;
 for(const message of messages.slice(-9,-1).reverse()){
  if(message.role==='user'&&priceQuery(message.content))return message.content;
 }
 return text;
}
export async function cryptoConnectionContext(env:SecretEnv){
 const connected=Boolean(await readKey(env,'COINGECKO_API_KEY'));
 return ` Never ask users to paste API keys, passwords, or secrets into chat. Keys are entered only in the owner-only connection pages. CoinGecko Demo crypto prices are ${connected?'already connected and the key is saved on the server; do not ask for its key or plan tier':'not connected; the owner can use /connect-crypto'}. Current crypto price requests are handled by SkyData's server. If this turn contains no retrieved quote, do not invent a price or claim you can fetch one yourself. Ask the user for the coin name and a price request, such as “XRP price”.`;
}
export async function cryptoPriceReply(text:string,env:SecretEnv,signal:AbortSignal,upstream:typeof fetch=fetch){
 const query=priceQuery(text);if(!query)return null;
 const key=await readKey(env,'COINGECKO_API_KEY');
 if(!key)return {content:'Connect CoinGecko in the owner’s plus menu to check crypto prices. Stock prices are not connected.',sources:[]};
 try{
 let coins:Coin[]=query.map(id=>({id,name:id==='ripple'?'XRP':Object.keys(aliases).find(a=>aliases[a]===id&&a.length>4)||id,symbol:''}));
 if(query[0].startsWith('search:')){
 const term=query[0].slice(7);const data=await get('/search?query='+encodeURIComponent(term),key,signal,upstream) as {coins?:Coin[]};
 const matches=(Array.isArray(data?.coins)?data.coins:[]).filter((c:Coin)=>typeof c.id==='string'&&/^[a-z0-9-]+$/.test(c.id)&&typeof c.name==='string'&&typeof c.symbol==='string') as Coin[];
 const exact=matches.filter(c=>c.id.toLowerCase()===term.toLowerCase()||c.name.toLowerCase()===term.toLowerCase()||c.symbol.toLowerCase()===term.toLowerCase());
 if(exact.length!==1)return {content:exact.length>1?'Several coins use that name or symbol. Ask using the full CoinGecko coin ID, such as “bitcoin price”.':'I could not identify that cryptocurrency. Try its full name or CoinGecko coin ID. Stock prices are not connected.',sources:[]};
 coins=exact;
 }
 const ids=coins.map(c=>c.id).sort().join(',');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
 const cacheId=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')+':'+ids;
 const entry=cached.get(cacheId);
 let quotes=entry&&entry.expires>Date.now()?entry.quotes:undefined;
 if(!quotes){
 quotes=await get('/simple/price?ids='+encodeURIComponent(ids)+'&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true',key,signal,upstream) as Record<string,Quote>;
 for(const coin of coins){const q=quotes[coin.id];if(!q||typeof q.usd!=='number'||!Number.isFinite(q.usd)||q.usd<=0||typeof q.last_updated_at!=='number'||!Number.isFinite(q.last_updated_at)||q.last_updated_at<=0||q.last_updated_at>Date.now()/1000+300)throw Error('CoinGecko did not return a valid price and update time. Try again later.');}
 if(cached.size>=100)cached.delete(cached.keys().next().value!);
 cached.set(cacheId,{expires:Date.now()+60000,quotes});
 }
 const content=coins.map(c=>{const q=quotes![c.id];const amount=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:q.usd<1?10:2}).format(q.usd);const change=typeof q.usd_24h_change==='number'&&Number.isFinite(q.usd_24h_change)?` · 24h: ${q.usd_24h_change>=0?'+':''}${q.usd_24h_change.toFixed(2)}%`:'';const time=new Date(q.last_updated_at*1000).toISOString();const stale=Date.now()/1000-q.last_updated_at>300?'\nThis quote is more than five minutes old.':'';return `**${c.name.charAt(0).toUpperCase()+c.name.slice(1)}: ${amount} USD**${change}\nUpdated: ${time}${stale}`;}).join('\n\n')+'\n\nData provided by [CoinGecko](https://www.coingecko.com). Quotes may be cached for 60 seconds.';
 return {content,sources:[{title:'CoinGecko',url:'https://www.coingecko.com'}]};
 }catch(error){return {content:error instanceof Error&&error.message.startsWith('CoinGecko')?error.message:'Could not retrieve a verified crypto price. Try again later.',sources:[]};}
}
