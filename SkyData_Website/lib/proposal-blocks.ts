// Extracts complete-file replacements the model marked with ```<language> file=<path>.
// Anything without that marker (snippets, commands, partial excerpts) is never treated as a file.
export type ProposedBlock={path:string;text:string;language:string};
export type BlockReview=ProposedBlock&{eligible:boolean;isNew:boolean;originalSha256?:string;reason:string};
export function proposedBlocks(content:string):ProposedBlock[]{
 const out:ProposedBlock[]=[],re=/^(`{3,})([^\n`]*)\n([\s\S]*?)^\1[ \t]*$/gm;let m:RegExpExecArray|null;
 while((m=re.exec(content))){const info=m[2],file=info.match(/(?:^|\s)file=(?:"([^"]+)"|'([^']+)'|(\S+))/);if(!file)continue;const path=(file[1]||file[2]||file[3]).trim();if(path)out.push({path,text:m[3],language:info.replace(file[0],'').trim()});}
 return out;
}
export type ReceivedFile={path:string;status:'full'|'truncated'|'unavailable';sha256?:string};
// A replacement for an existing file is eligible only if the model received that complete original.
export function reviewBlocks(blocks:ProposedBlock[],received:ReceivedFile[]|null,existing:Set<string>):BlockReview[]{
 const counts=new Map<string,number>();for(const b of blocks)counts.set(b.path,(counts.get(b.path)||0)+1);
 return blocks.map(b=>{
  if((counts.get(b.path)||0)>1)return {...b,eligible:false,isNew:false,reason:'The model output this path more than once; regenerate or create a manual proposal.'};
  const got=received?.find(f=>f.path===b.path);
  if(got?.status==='full'&&got.sha256)return {...b,eligible:true,isNew:false,originalSha256:got.sha256,reason:'Complete original was sent to the model (SHA-256 '+got.sha256.slice(0,12)+'…).'};
  if(got)return {...b,eligible:false,isNew:false,reason:'Not eligible: the model received this file '+(got.status==='truncated'?'TRUNCATED':'UNAVAILABLE')+', not complete.'};
  if(existing.has(b.path.toLowerCase()))return {...b,eligible:false,isNew:false,reason:'Not eligible: this file exists in the ZIP but was not selected for the model, so it never saw the complete original.'};
  return {...b,eligible:true,isNew:true,reason:'New file (no original in the ZIP).'};
 });
}
