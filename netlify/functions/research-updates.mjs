// Approved lien and land research update feed with a strictly server-enforced Pro head start.
// Does NOT alter free maps, Land for Sale, private certificate staging, or AI membership.
import crypto from 'node:crypto';
import * as auth from '../lib/auth.mjs';
import { getSnapshot } from './certificate-review.mjs';
import { audienceFor, isProAccount, makeRelease, safeResearchRecord, PRO_EARLY_ACCESS_MS } from '../lib/research-releases.mjs';

const INDEX='approved-research-releases-v1';
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff'}});
const permitted = new Set(['lien','land','tax_deed','property']);
function cleanIndex(value) {
  if (!value || !Array.isArray(value.list)) return [];
  return value.list.filter(item=>item && typeof item === 'object').slice(0,2000);
}
export default async function handler(req) {
  const u=new URL(req.url);
  const me=await auth.userFromCookie(req.headers.get('cookie'));
  if(req.method==='GET'){
    try {
      const type=u.searchParams.get('type')||'';
      const state=u.searchParams.get('state')||'';
      if(type && !permitted.has(type))return json(400,{ok:false,error:'Unknown research type'});
      if(state && !/^[A-Z]{2}$/.test(state))return json(400,{ok:false,error:'Invalid state'});
      const now=Date.now(),pro=isProAccount(me);
      const items=cleanIndex(await auth.kvGet(INDEX)).filter(item=>
        (!type||item.type===type)&&(!state||item.state===state)&&audienceFor(item,me,now)!=='none');
      // Never transmit early-access data, IDs or metadata to free visitors before expiry.
      const records=items.sort((a,b)=>b.proReleaseAt.localeCompare(a.proReleaseAt))
        .slice(0,150).map(safeResearchRecord);
      return json(200,{ok:true,records,access:pro?'pro':'free',earlyAccessHours:48,
        policy:'Pro sees new approved research releases first; Free sees them after 48 hours.',
        note:'No certificate or land listing is confirmed available for purchase.'});
    } catch(e) {console.error('research-updates GET',e);return json(503,{ok:false,error:'Research updates unavailable.'});}
  }
  if(req.method!=='POST')return json(405,{ok:false,error:'Method not allowed.'});
  if(!me)return json(401,{ok:false,error:'Please sign in.'});
  if(!me.owner)return json(403,{ok:false,error:'Owner only.'});
  if(req.headers.get('origin')!==u.origin)return json(403,{ok:false,error:'Invalid request origin.'});
  if(Number(req.headers.get('content-length')||0)>10000)return json(413,{ok:false,error:'Request too large.'});
  let b;try{b=await req.json();}catch{return json(400,{ok:false,error:'Invalid JSON.'});}
  if(b?.action!=='release')return json(400,{ok:false,error:'Unknown action.'});
  try {
    const id=crypto.randomUUID();
    if (b.type === 'lien') {
      const countyToSlug={'Wakulla':'wakulla','Palm Beach':'palm-beach','St. Johns':'st-johns'};
      const slug=countyToSlug[b.county];
      if (b.state!=='FL'||!slug) throw Error('Lien releases currently require a reviewed Florida county certificate.');
      if (typeof b.certificateKey!=='string'||b.certificateKey.length>250) throw Error('Enter the exact reviewed certificate key.');
      const snap=await getSnapshot(slug);
      const key=b.certificateKey.trim().toLowerCase();
      const row=snap.indexed.get(key);
      if (!row||row.parcelId!==b.parcelId||String(row.certificateNumber)!==String(b.certificateNumber)) throw Error('Certificate does not match current staged county data.');
      const digest=crypto.createHash('sha256').update(key).digest('hex');
      const review=await auth.kvGet('cert-review-'+digest);
      if (!review||review.decision!=='approved-for-research'||review.snapshotSha256!==snap.hash) throw Error('Current certificate must first be approved for research in Owner Dashboard → Certificate Review.');
      if (!review.evidenceUrl||b.evidenceUrl!==review.evidenceUrl) throw Error('Use the official URL approved during certificate review.');
    }
    const item=makeRelease({...b,id},new Date(),me.email);
    // This owner-triggered action is the separate publication approval step.
    // Nothing published automatically from the county import staging system.
    const old=cleanIndex(await auth.kvGet(INDEX));
    const next={schemaVersion:1,list:[item,...old].slice(0,2000)};
    const audit={...item,action:'manual-owner-approved-research-release',at:new Date().toISOString()};
    await auth.kvPut('research-release-audit-'+id,audit);
    await auth.kvPut(INDEX,next);
    return json(201,{ok:true,id,proReleaseAt:item.proReleaseAt,
      freeReleaseAt:new Date(Date.parse(item.proReleaseAt)+PRO_EARLY_ACCESS_MS).toISOString(),
      message:'Approved research update released to Pro now; Free after 48 hours. No public maps changed.'});
  }catch(e){return json(400,{ok:false,error:String(e.message||'Invalid update.').slice(0,200)});}
}
