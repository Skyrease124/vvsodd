// Share account authentication, but keep Brain state isolated on Deploy Previews.
import { AsyncLocalStorage } from 'node:async_hooks';
import { getDeployStore } from '@netlify/blobs';
import * as auth from './auth.mjs';
export * from './auth.mjs';
const scope=new AsyncLocalStorage();
// File-based build uploads target the default deploy store, not a named store.
const previewStore=()=>getDeployStore({consistency:'strong'});
export const isBrainPreview=()=>scope.getStore()?.preview===true;
// API budgets and provider controls remain shared; a preview must not reset them.
const isolated=k=>isBrainPreview()&&!k.includes('usage')&&k!=='owner-ai-research-api-controls';
export function withBrainStore(handler){
 return (req,context)=>scope.run(context?.deploy?
  {preview:context.deploy.context==='deploy-preview'}:
  (scope.getStore()||{preview:false}),()=>handler(req,context));
}
export const kvGet=k=>isolated(k)?previewStore().get(k,{type:'json'}):auth.kvGet(k);
export const kvPut=(k,v)=>isolated(k)?previewStore().setJSON(k,v):auth.kvPut(k,v);
export const kvDel=k=>isolated(k)?previewStore().delete(k):auth.kvDel(k);
export async function kvList(prefix){
 if(!isolated(prefix))return auth.kvList(prefix);
 return (await previewStore().list({prefix})).blobs.map(b=>b.key);
}
