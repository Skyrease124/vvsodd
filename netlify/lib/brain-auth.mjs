// Share account authentication, but keep Brain state isolated on Deploy Previews.
import { AsyncLocalStorage } from 'node:async_hooks';
import { getDeployStore, getStore } from '@netlify/blobs';
import { readWayneQuota, reserveWayneRequest } from './brain-wayne-gis-quota.mjs';
import * as auth from './auth.mjs';
export * from './auth.mjs';
const scope=new AsyncLocalStorage();
// File-based build uploads target the default deploy store, not a named store.
// Isolated from production by a dedicated, fixed preview-only namespace.
// Unlike a deploy store, a site-level store survives newer PR #452 previews.
const previewStore=()=>getStore({name:'ppa-brain-preview-integration',consistency:'strong'});
const previewSeed=()=>getDeployStore({consistency:'strong'});
const SEEDED=new Set(['brain-source-events-v1','owner-brain-approvals-v1',
 'brain-map-county-v1-MI-wayne','brain-map-history-v1','brain-map-publication-status-v1']);
export const isBrainPreview=()=>scope.getStore()?.preview===true;
// API budgets and provider controls remain shared; a preview must not reset them.
const isolated=k=>isBrainPreview()&&!k.includes('usage')&&k!=='owner-ai-research-api-controls';
export function withBrainStore(handler){
 return (req,context)=>scope.run(context?.deploy?
  {preview:context.deploy.context==='deploy-preview',environment:context.deploy.context}:
  (scope.getStore()||{preview:false}),()=>handler(req,context));
}
export async function kvGet(k){
 if(!isolated(k))return auth.kvGet(k);
 const existing=await previewStore().get(k,{type:'json'});
 if(existing!=null)return existing;
 // Preview build uploads are seed data only, never overwrite persistent changes.
 if(SEEDED.has(k))return previewSeed().get(k,{type:'json'});
 return null;
}
export const kvPut=(k,v)=>isolated(k)?previewStore().setJSON(k,v):auth.kvPut(k,v);
export const kvDel=k=>isolated(k)?previewStore().delete(k):auth.kvDel(k);
export async function kvList(prefix){
 if(!isolated(prefix))return auth.kvList(prefix);
 return (await previewStore().list({prefix})).blobs.map(b=>b.key);
}

// Versioned reads intentionally skip deploy seeds. Only live state is writable.
const versionedStore = key => isolated(key)
  ? previewStore()
  : auth.accountBlobStore();
export const kvGetVersioned = key => versionedStore(key).getWithMetadata(key, { type: 'json' });
export async function kvPutVersioned(key, value, etag) {
  if (etag !== null && !etag) throw new Error('Missing storage version');
  const result = await versionedStore(key).setJSON(key, value,
    etag === null ? { onlyIfNew: true } : { onlyIfMatch: etag });
  if (!result.modified) return null;
  if (!result.etag) throw new Error('Missing write version');
  return result.etag;
}

function requireWayneQuotaContext() {
  if (!['production', 'deploy-preview'].includes(scope.getStore()?.environment)) {
    throw Object.assign(Error('GIS quota unavailable in this deploy context'), { code: 'QUOTA' });
  }
}
export function readWayneGisQuota() {
  requireWayneQuotaContext();
  return readWayneQuota({ read: kvGetVersioned });
}
export async function reserveWayneGisRequest() {
  requireWayneQuotaContext();
  try {
    return await reserveWayneRequest({ read: kvGetVersioned, write: kvPutVersioned });
  } catch (error) {
    if (error.code === 'QUOTA') throw error;
    throw Object.assign(Error('GIS budget temporarily unavailable', { cause: error }), { code: 'QUOTA', quotaState: 'quota_unavailable' });
  }
}
export async function fetchWayneGis(url, options) {
  await reserveWayneGisRequest();
  return fetch(url, { ...options, redirect: 'error' });
}
