// Keep room for NVIDIA's normalization of numbers and abbreviations.
export function speechChunks(source:string,limit=450):string[]{
 const text=source.replace(/```[^\n]*\n?/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/^\s{0,3}#{1,6}\s+/gm,'').replace(/^\s*[*\-+]\s+/gm,'').replace(/[*_`]/g,'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
 const chunks:string[]=[];let rest=text;
 while(rest.length>limit){
  const window=rest.slice(0,limit+1);let boundary=-1;
  for(const match of window.matchAll(/[.!?](?:\s|$)/g))boundary=match.index!+1;
  if(boundary<limit/3)boundary=window.lastIndexOf(' ');
  if(boundary<1)boundary=limit;
  // Avoid splitting a Unicode surrogate pair at a forced boundary.
  if(/[\uD800-\uDBFF]/.test(rest[boundary-1]))boundary--;
  chunks.push(rest.slice(0,boundary).trim());rest=rest.slice(boundary).trim();
 }
 if(rest)chunks.push(rest);
 return chunks;
}
