import {KNOWLEDGE_PART_SIZE,KNOWLEDGE_MAX_FILE,type KnowledgeDocument} from './knowledge-core';
class KnowledgeRequestError extends Error { constructor(message:string,public status:number,public retryAfter:number){super(message);} }
export async function knowledgeApi<T=Record<string,unknown>>(path:string,method='GET',value?:unknown,signal?:AbortSignal){
 const response=await fetch('/api/knowledge'+path,{method,headers:value!==undefined?{'Content-Type':'application/json'}:undefined,body:value!==undefined?JSON.stringify(value):undefined,signal});const data=await response.json() as {error?:string};if(!response.ok)throw new KnowledgeRequestError(data.error||'Knowledge Core is temporarily unavailable.',response.status,Math.min(120,Math.max(1,Number(response.headers.get('Retry-After'))||3)));return data as T;
}
async function retry<T>(work:()=>Promise<T>,signal:AbortSignal){for(let i=0;;i++)try{return await work();}catch(e){if(signal.aborted||i>=3||e instanceof KnowledgeRequestError&&e.status<500&&e.status!==429)throw e;const delay=e instanceof KnowledgeRequestError&&e.status===429?e.retryAfter*1000:1000*(i+1);await new Promise<void>((resolve,reject)=>{const stop=()=>{clearTimeout(timer);reject(Error('Processing paused.'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},delay);signal.addEventListener('abort',stop,{once:true});});}}
export async function uploadKnowledge(file:File,category:string,progress:(message:string)=>void,signal:AbortSignal){
 if(file.size>KNOWLEDGE_MAX_FILE)throw Error('Choose a document up to 100 MB.');
 const created=await knowledgeApi<{id:string}>('','POST',{name:file.name,size:file.size,category},signal);const id=created.id as string;
 try{for(let offset=0,n=1;offset<file.size;offset+=KNOWLEDGE_PART_SIZE,n++){
  progress(`Uploading ${file.name} · ${Math.round(offset/file.size*100)}%`);
  await retry(async()=>{const r=await fetch(`/api/knowledge/${id}/part?number=${n}`,{method:'POST',body:file.slice(offset,offset+KNOWLEDGE_PART_SIZE),signal});if(!r.ok){const b=await r.json() as {error?:string};throw new KnowledgeRequestError(b.error||'Upload interrupted.',r.status,Number(r.headers.get('Retry-After'))||3);}},signal);
 }await retry(()=>knowledgeApi('/'+id+'/complete','POST',{},signal),signal);return id;
 }catch(e){throw Error((e instanceof Error?e.message:'Upload interrupted.')+' The incomplete upload is listed below and can be removed.');}
}
export async function extractKnowledge(id:string,progress:(message:string)=>void,signal:AbortSignal){
 const {document:doc}=await knowledgeApi('/'+id,'GET',undefined,signal) as {document:KnowledgeDocument};let batch=0;
 const send=async(text:string,page:number|null,pageLabel:string|null=null)=>{if(signal.aborted)throw Error('Processing paused. Resume when ready.');if(batch>=doc.next_batch)await retry(()=>knowledgeApi('/'+id+'/extract','POST',{number:batch,text,page,pageLabel},signal),signal);batch++;};
 try{
  const path='/api/knowledge/'+id+'/download';
  if(doc.kind==='pdf'){
   const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
   const loading=pdfjs.getDocument({url:path,withCredentials:true,disableAutoFetch:true,disableStream:true,rangeChunkSize:65536,isEvalSupported:false,standardFontDataUrl:'/pdf-fonts/',cMapUrl:'/pdf-cmaps/',cMapPacked:true});
   const abort=()=>void loading.destroy();signal.addEventListener('abort',abort,{once:true});
   try{const pdf=await loading.promise;if(pdf.numPages>5000)throw Error('PDFs are limited to 5,000 pages. Split this book into volumes.');
    const metadata=await pdf.getMetadata().catch(()=>null);const info=metadata?.info as {Title?:string;Author?:string}|undefined;
    await knowledgeApi('/'+id+'/metadata','POST',{units:pdf.numPages,title:info?.Title||doc.name,author:info?.Author||''},signal);
    const labels=await pdf.getPageLabels().catch(()=>null);
    batch=doc.next_batch;
    for(let n=doc.next_batch+1;n<=pdf.numPages;n++){progress(`Reading page ${n} of ${pdf.numPages} · ${doc.name}`);const page=await pdf.getPage(n);const content=await page.getTextContent();const text=content.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join('');page.cleanup();await send(text,n,labels?.[n-1]||null);await new Promise(r=>setTimeout(r,0));}
   }finally{signal.removeEventListener('abort',abort);await loading.destroy();}
  }else if(doc.kind==='docx'){
   progress('Extracting Word document…');const response=await fetch(path,{signal});if(!response.ok)throw Error('Document download failed.');const {unzip,strFromU8}=await import('fflate');
   const zip=new Uint8Array(await response.arrayBuffer());
   const entries=await new Promise<Record<string,Uint8Array>>((resolve,reject)=>{unzip(zip,{filter:entry=>entry.name==='word/document.xml'&&entry.originalSize<=16*1024*1024},(error,result)=>error?reject(error):resolve(result));});
   if(!entries['word/document.xml'])throw Error('DOCX text is missing or exceeds 16 MB. Export this book as PDF.');
   const parsed=new DOMParser().parseFromString(strFromU8(entries['word/document.xml']),'application/xml');if(parsed.getElementsByTagName('parsererror').length)throw Error('The Word document contains invalid XML.');
   const paragraphs=Array.from(parsed.getElementsByTagNameNS('*','p'));let buffer='';
   for(let i=0;i<paragraphs.length;i++){const p=paragraphs[i];const text=Array.from(p.getElementsByTagNameNS('*','t')).map(t=>t.textContent||'').join('');const style=p.getElementsByTagNameNS('*','pStyle')[0]?.getAttribute('w:val')||'';buffer+=(buffer?'\n\n':'')+(/^Heading/i.test(style)?'# ':'')+text;
    while(buffer.length>=40000){await send(buffer.slice(0,40000),null);buffer=buffer.slice(40000);progress(`Reading Word sections · ${i+1} of ${paragraphs.length}`);await new Promise(r=>setTimeout(r,0));}
   }if(buffer.trim())await send(buffer,null);
  }else{
   progress('Reading text in batches…');const response=await fetch(path,{signal});if(!response.ok||!response.body)throw Error('Document download failed.');const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let buffer='';
   try{for(;;){const part=await reader.read();buffer+=decoder.decode(part.value,{stream:!part.done});if(buffer.includes('\0'))throw Error('This file contains binary data. Upload UTF-8 text.');while(buffer.length>=40000){await send(buffer.slice(0,40000),null);buffer=buffer.slice(40000);progress(`Reading text · ${batch} sections saved`);await new Promise(r=>setTimeout(r,0));}if(part.done)break;}if(buffer.trim())await send(buffer,null);}finally{await reader.cancel().catch(()=>{});}
  }
  if(!batch)throw Error('No readable text was found. Scanned documents need OCR first.');
  await knowledgeApi('/'+id+'/finish','POST',{batches:batch},signal);progress('Text saved. Semantic indexing is running.');
 }catch(e){const message=signal.aborted?'Extraction paused. Resume processing to continue.':e instanceof Error?e.message:'Extraction failed.';await knowledgeApi('/'+id+'/error','POST',{error:message}).catch(()=>{});throw Error(message);}
}

/** Owner-triggered location repair; exact chunk hashes only, backups precede server updates. */
export async function verifyKnowledgePages(id:string,progress:(message:string)=>void,signal:AbortSignal){
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
 const loading=pdfjs.getDocument({url:'/api/knowledge/'+id+'/download',withCredentials:true,disableAutoFetch:true,disableStream:true,isEvalSupported:false});
 const abort=()=>void loading.destroy();signal.addEventListener('abort',abort,{once:true});let matched=0,unmatched=0,ambiguous=0;
 try{const pdf=await loading.promise;const labels=await pdf.getPageLabels().catch(()=>null);
  for(let n=1;n<=pdf.numPages;n++){
   if(signal.aborted)throw Error('Location verification paused. Completed pages are saved.');
   const page=await pdf.getPage(n),content=await page.getTextContent();
   const text=content.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join('');page.cleanup();
   const result=await knowledgeApi<{matched:number;unmatched:number;ambiguous:number}>('/'+id+'/verify-page','POST',{page:n,text,pageLabel:labels?.[n-1]||null},signal);
   matched+=result.matched;unmatched+=result.unmatched;ambiguous+=result.ambiguous;
   progress(`Checked PDF page ${n}/${pdf.numPages}: ${matched} exact matches; ${unmatched} unmatched; ${ambiguous} ambiguous.`);
  }
 }finally{signal.removeEventListener('abort',abort);await loading.destroy();}
 return {matched,unmatched,ambiguous};
}
