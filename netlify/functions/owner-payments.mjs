// Read-only, owner-authorized Stripe analytics. No secrets or customer payment methods reach the browser.
import * as auth from '../lib/auth.mjs';
import * as S from '../lib/stripe.mjs';

const reply=(status,obj)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
const idOf=v=>typeof v==='string'?v:(v&&v.id)||null;
const kindOf=charge=>{
  const pi=typeof charge.payment_intent==='object'?charge.payment_intent:null;
  const meta=pi?.metadata||charge.metadata||{};
  if(meta.kind==='donation'||/PricePocketAsset donation/i.test(pi?.description||charge.description||''))return 'donations';
  if(charge.invoice || meta.kind==='subscription' || meta.subscription_id || /subscription|membership/i.test(pi?.description||charge.description||''))return 'pro';
  return 'other';
};
export default async req=>{
  if(req.method!=='GET')return reply(405,{error:'GET only'});
  const user=await auth.userFromCookie(req.headers.get('cookie')||'');
  if(!user)return reply(401,{error:'Sign in to your owner account'});
  if(!user.owner)return reply(403,{error:'Owner access only'});
  const cfg=await S.getConfig();
  if(!cfg)return reply(503,{error:'Stripe is not configured'});
  const url=new URL(req.url);
  const days=({'7':7,'30':30,'90':90,'365':365})[url.searchParams.get('days')]||30;
  const since=Math.floor(Date.now()/1000)-days*86400;
  const stripe=S.client(cfg);
  try{
    let starting_after,hasMore=true;
    const charges=[];
    // Safety cap: indicate partial coverage instead of pretending a capped result is complete.
    while(hasMore&&charges.length<1000){
      const page=await stripe.charges.list({created:{gte:since},limit:100,expand:['data.payment_intent'],...(starting_after?{starting_after}:{})});
      charges.push(...page.data);
      hasMore=!!page.has_more;
      starting_after=page.data.at(-1)?.id;
      if(!page.data.length)break;
    }
    const rows=charges.filter(c=>c.paid&&c.status==='succeeded'&&String(c.currency).toLowerCase()==='usd').map(c=>({
      id:c.id,date:new Date(c.created*1000).toISOString().slice(0,10),
      created:c.created,amount:c.amount,refunded:c.amount_refunded||0,
      kind:kindOf(c),currency:'usd',refundedFull:!!c.refunded
    }));
    const daily=new Map();
    for(const r of rows){
      if(!daily.has(r.date))daily.set(r.date,{date:r.date,pro:0,donations:0,other:0,refunds:0,count:0});
      const o=daily.get(r.date);o[r.kind]+=r.amount;o.refunds+=r.refunded;o.count++;
    }
    const series=[];
    for(let i=days-1;i>=0;i--){
      const d=new Date(Date.now()-i*86400000).toISOString().slice(0,10);
      series.push(daily.get(d)||{date:d,pro:0,donations:0,other:0,refunds:0,count:0});
    }
    const totals=rows.reduce((a,r)=>(a[r.kind]+=r.amount,a.refunds+=r.refunded,a.count++,a),{pro:0,donations:0,other:0,refunds:0,count:0});
    return reply(200,{ok:true,mode:cfg.mode,days,partial:hasMore,currency:'usd',totals,series,
      recent:rows.sort((a,b)=>b.created-a.created).slice(0,15).map(({id,date,amount,refunded,kind})=>({id,date,amount,refunded,kind}))});
  }catch(e){
    console.error('owner-payments Stripe read error',e?.type||'Error');
    return reply(502,{error:'Stripe reporting could not load. Check key permissions for reading Charges and PaymentIntents.'});
  }
};
