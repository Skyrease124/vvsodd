// Owner-only certificate research review API. Never publishes or marks purchasable.
import crypto from 'node:crypto';
import * as auth from '../lib/auth.mjs';

const REPO='Skyrease124/vvsodd';
const CONFIG={
  wakulla:{label:'Wakulla',branch:'automation/wakulla-certificate-review',file:'fl-wakulla-certificate-export.json'},
  'palm-beach':{label:'Palm Beach',branch:'automation/palm-beach-certificate-review',file:'fl-palm-beach-certificate-export.json'},
  'st-johns':{label:'St. Johns',branch:'automation/st-johns-certificate-review',file:'fl-st-johns-unpaid-certificates.json'}
};
const CHOICES=new Set(['approved-for-research','needs-follow-up','rejected']);
const hosts=['wakullatax.com','pbctax.gov','sjctax.us','floridarevenue.com','lienhub.com','flataxsales.com'];
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff'}});
export function certificateKey(r){
  return [r.state,r.county,r.parcelId,r.certificateNumber,r.certificateYear||r.taxYear].map(v=>String(v||'').trim().toLowerCase()).join('|');
}
function keyHash(key){return crypto.createHash('sha256').update(key).digest('hex');}
export function evidenceAllowed(value){
  if(typeof value!=='string'||value.length>2000)return false;
  try{
    const u=new URL(value);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.some(h=>u.hostname.toLowerCase()===h||u.hostname.toLowerCase().endsWith('.'+h));
  }catch{return false;}
}
export function validateDecision(b,record){
  if(!b||typeof b!=='object'||!CHOICES.has(b.decision))throw Error('Invalid review decision');
  if(typeof b.reason!=='string'||b.reason.trim().length<12||b.reason.length>1000)throw Error('Explain the review in 12–1000 characters.');
  if(b.decision==='approved-for-research'&&!evidenceAllowed(b.evidenceUrl))throw Error('Approval requires an official HTTPS source URL.');
  if(b.evidenceUrl&&!evidenceAllowed(b.evidenceUrl))throw Error('Untrusted evidence URL.');
  if(!record||record.availableForPurchase!==false||record.status!=='unverified')throw Error('Unsafe source record.');
  return {decision:b.decision,reason:b.reason.trim(),evidenceUrl:b.evidenceUrl||null};
}
let cache=new Map();
export async function getSnapshot(slug){
  const cfg=CONFIG[slug];
  if(!cfg)throw Error('Unsupported county.');
  const old=cache.get(slug);
  if(old&&Date.now()-old.time<60000)return old.data;
  const url='https://api.github.com/repos/'+REPO+'/contents/county-import-staging/'+cfg.file+'?ref='+encodeURIComponent(cfg.branch);
  const headers={'Accept':'application/vnd.github.raw+json','User-Agent':'PricePocketAsset-owner-review'};
  if(process.env.GITHUB_REVIEW_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_REVIEW_TOKEN;
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!response.ok)throw Error('County staging source unavailable ('+response.status+').');
  const raw=await response.text();
  if(raw.length>12000000)throw Error('Source exceeded safe size.');
  let data;try{data=JSON.parse(raw);}catch{throw Error('County source response is not JSON. Check GitHub read access.');}
  if(!Array.isArray(data.records)||data.records.length>100000||data.records.length===0)throw Error('Missing county records.');
  if(data.records.some(r=>!r||r.state!=='FL'||r.county!==cfg.label||r.availableForPurchase!==false||r.status!=='unverified'))throw Error('County source integrity check failed.');
  const indexed=new Map();
  for(const r of data.records){
    const k=certificateKey(r);
    if(k.split('|').some(x=>!x)||indexed.has(k))throw Error('County records contain duplicate or incomplete certificate keys.');
    indexed.set(k,r);
  }
  const hash=crypto.createHash('sha256').update(raw).digest('hex');
  const snapshot={data,indexed,hash};
  cache.set(slug,{time:Date.now(),data:snapshot});
  return snapshot;
}
function brief(record,review){
  const names=['parcelId','certificateNumber','taxYear','certificateYear','holdingType','redemptionStatus',
    'taxDeedStatus','faceAmount','faceAmountRaw','certificateFaceAmountRaw','dueAmount','totalAmountRaw',
    'unpaidBalanceRaw','verificationFlags','certificateStatusRaw','certificateTypeRaw'];
  const item={certificateKey:certificateKey(record)};
  for(const name of names)if(record[name]!==undefined)item[name]=record[name];
  item.availableForPurchase=false;
  item.review=review||null;
  return item;
}
export default async function handler(req){
  const me=await auth.userFromCookie(req.headers.get('cookie'));
  if(!me)return reply(401,{ok:false,error:'Please sign in.'});
  if(!me.owner)return reply(403,{ok:false,error:'Owner only.'});
  if(req.method!=='GET'&&req.method!=='POST')return reply(405,{ok:false,error:'Unsupported method.'});
  if(req.method==='POST'){
    const origin=req.headers.get('origin');
    const host=new URL(req.url).origin;
    if(!origin||origin!==host)return reply(403,{ok:false,error:'Invalid request origin.'});
    if(Number(req.headers.get('content-length')||0)>12000)return reply(413,{ok:false,error:'Request too large.'});
  }
  try{
    const url=new URL(req.url);
    const slug=req.method==='GET'?url.searchParams.get('county'):null;
    if(req.method==='GET'){
      if(!slug){
        return reply(200,{ok:true,counties:Object.entries(CONFIG).map(([id,c])=>({id,label:c.label})),note:'Owner-only review; no certificate publication.'});
      }
      if(!CONFIG[slug])return reply(400,{ok:false,error:'Invalid county.'});
      const snap=await getSnapshot(slug);
      const q=String(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,100);
      const holding=String(url.searchParams.get('holding')||'');
      const redemption=String(url.searchParams.get('redemption')||'');
      const page=Math.max(0,Math.min(100000,Number.parseInt(url.searchParams.get('page')||'0',10)||0));
      let records=[...snap.indexed.values()].filter(r=>
        (!q||[r.parcelId,r.certificateNumber].some(v=>String(v||'').toLowerCase().includes(q)))&&
        (!holding||r.holdingType===holding)&&(!redemption||r.redemptionStatus===redemption));
      const subset=records.slice(page*40,page*40+40);
      const reviews=await Promise.all(subset.map(r=>auth.kvGet('cert-review-'+keyHash(certificateKey(r)))));
      const currentReviews=reviews.map(review=>review&&review.snapshotSha256===snap.hash?review:null);
      return reply(200,{ok:true,county:CONFIG[slug].label,sourceCheckedAt:snap.data.checkedAt||null,
        total:snap.indexed.size,matched:records.length,page,pageSize:40,snapshotSha256:snap.hash,
        records:subset.map((r,i)=>brief(r,currentReviews[i])),researchOnly:true});
    }
    const b=await req.json();
    if(!b||!CONFIG[b.county]||typeof b.certificateKey!=='string'||b.certificateKey.length>250)
      return reply(400,{ok:false,error:'Invalid county or certificate.'});
    const snap=await getSnapshot(b.county);
    const r=snap.indexed.get(b.certificateKey.trim().toLowerCase());
    if(!r)return reply(404,{ok:false,error:'Certificate not found in current county staging data.'});
    if(b.snapshotSha256!==snap.hash)return reply(409,{ok:false,error:'County snapshot changed. Reload before reviewing.'});
    const decision=validateDecision(b,r);
    const key=certificateKey(r),id=crypto.randomUUID(),when=new Date().toISOString();
    const receipt={id,at:when,county:CONFIG[b.county].label,certificateKey:key,reviewer:me.email,
      snapshotSha256:snap.hash,...decision,publicationAuthorized:false,availableForPurchase:false,
      meaning:'Research review only; no purchase availability or website publication.'};
    // Write audit entry before updating latest decision. Every decision creates a separate audit key.
    await auth.kvPut('cert-audit-'+id,receipt);
    await auth.kvPut('cert-review-'+keyHash(key),receipt);
    return reply(200,{ok:true,review:receipt});
  }catch(e){
    console.error('certificate review:',e?.message);
    return reply(503,{ok:false,error:String(e?.message||'Certificate review unavailable.').slice(0,170)});
  }
}
