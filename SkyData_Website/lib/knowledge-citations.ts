/** Citation identity is tied to an immutable chunk, never its search rank. */
export type CitationRecord={id:string;document:string;name:string;page:number|null;content:string};
export function citationId(chunk:string){return 'K_'+chunk.replace(/[^a-zA-Z0-9]/g,'_');}
export function citationSource(h:CitationRecord,origin:string){
 const title=h.name+(h.page?' · PDF page '+h.page:' · excerpt');
 return {title,url:new URL('/knowledge?document='+encodeURIComponent(h.document)+'&chunk='+encodeURIComponent(h.id),origin).href};
}
export function validateKnowledgeCitations(content:string,records:CitationRecord[],origin:string){
 const allowed=new Map(records.map(h=>[citationId(h.id),h]));const used=new Map<string,{title:string;url:string}>();let invalid=0;
 let text=content.replace(/\[(K(?:_[a-zA-Z0-9_]+|\d+))([^\]\n]*)\](?:\([^\n)]*\))?/g,(_whole,id)=>{
  const h=allowed.get(id);if(!h){invalid++;return '[Source reference could not be confirmed]';}
  const source=citationSource(h,origin);used.set(id,source);
  const label=source.title.replace(/[\\\[\]]/g,'');return '['+label+']('+source.url+')';
 });
 // Validate direct document links too, including model-written labels and page fragments.
 text=text.replace(/\[([^\]\n]+)\]\(([^\s)]+)\)/g,(whole,_label,url)=>{
  let parsed:URL;try{parsed=new URL(url,origin);}catch{return whole;}
  if(parsed.pathname!=='/knowledge')return whole;
  const h=records.find(r=>r.id===parsed.searchParams.get('chunk')&&r.document===parsed.searchParams.get('document'));
  if(parsed.origin!==new URL(origin).origin||!h){invalid++;return '[Source reference could not be confirmed]';}
  const source=citationSource(h,origin);used.set(citationId(h.id),source);
  return '['+source.title.replace(/[\\\[\]]/g,'')+']('+source.url+')';
 });
 // No document content or owner identifiers in operational logs.
 console.info('knowledge_citation_validation',{referenced:used.size,invalid});
 return {content:text,sources:[...used.values()],invalid};
}
