import type {GroundingMetadata} from '@google/genai';
export type LiveGrounding={sources:{title:string;url:string}[];suggestions:string};
export function readLiveGrounding(metadata:GroundingMetadata):LiveGrounding{
 const sources:LiveGrounding['sources']=[];
 // Only provider metadata supplies links; never infer sources from spoken text.
 const chunks=metadata.groundingChunks||[];
 const used=new Set((metadata.groundingSupports||[]).flatMap(s=>s.groundingChunkIndices||[]));
 for(let index=0;index<chunks.length;index++){
  if(used.size&&!used.has(index))continue;
  const web=chunks[index].web;if(!web?.uri||web.uri.length>2048)continue;
  try{const url=new URL(web.uri);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)continue;
   if(!sources.some(s=>s.url===url.href))sources.push({url:url.href,title:(web.title||url.hostname).slice(0,500)});
  }catch{}
 }
 return {sources:sources.slice(0,10),suggestions:(metadata.searchEntryPoint?.renderedContent||'').slice(0,100000)};
}
export function mergeLiveGrounding(a:LiveGrounding,b:LiveGrounding):LiveGrounding{return {sources:[...a.sources,...b.sources.filter(s=>!a.sources.some(p=>p.url===s.url))].slice(0,10),suggestions:b.suggestions||a.suggestions};}
