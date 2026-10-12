import { DOCUMENT_FILE_LIMIT, DOCUMENT_TEXT_LIMIT, type DocumentAttachment } from './document-attachment';
const textExtensions=new Set('txt md markdown csv tsv json jsonl xml html htm css js jsx ts tsx py rb php java c cpp h cs go rs sql sh yaml yml log ini toml'.split(' '));
export async function readDocument(file:File):Promise<DocumentAttachment>{
 if(file.size>DOCUMENT_FILE_LIMIT)throw new Error('Choose a document up to 25 MB.');
 const ext=file.name.split('.').pop()?.toLowerCase()||'';
 let text='';let truncated=false;
 if(ext==='pdf'){
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
  const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,standardFontDataUrl:'/pdf-fonts/',cMapUrl:'/pdf-cmaps/',cMapPacked:true});
  try{
   const pdf=await loading.promise;
   if(pdf.numPages>500)throw new Error('Choose a PDF with 500 pages or fewer.');
   for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n);const content=await page.getTextContent();
    text+=`\nPage ${n}\n`+content.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join('');
    page.cleanup();
    if(text.length>DOCUMENT_TEXT_LIMIT){truncated=true;break;}
   }
   if(!text.replace(/Page \d+/g,'').trim())throw new Error('This PDF has no readable text. Upload photos of the pages instead.');
  }finally{await loading.destroy();}
 }else if(ext==='docx'){
  const {unzipSync,strFromU8}=await import('fflate');
  const entries=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{
   if(entry.name!=='word/document.xml')return false;
   if(entry.originalSize>10*1024*1024)throw new Error('This Word document is too large. Upload a shorter section.');
   return true;
  }});
  if(!entries['word/document.xml'])throw new Error('Could not read this Word document. Save it as DOCX or text and try again.');
  const xml=new DOMParser().parseFromString(strFromU8(entries['word/document.xml']),'application/xml');
  if(xml.getElementsByTagName('parsererror').length)throw new Error('Could not read this Word document.');
  text=Array.from(xml.getElementsByTagNameNS('*','p')).map(p=>Array.from(p.getElementsByTagNameNS('*','t')).map(t=>t.textContent||'').join('')).join('\n');
 }else if(textExtensions.has(ext)||file.type.startsWith('text/')){
  text=await file.text();if(text.includes('\0'))throw new Error('This file is not readable text. Choose PDF, DOCX, text, CSV, or a code file.');
 }else throw new Error('Choose PDF, DOCX, text, CSV, JSON, or a code file.');
 text=text.trim();if(!text)throw new Error('This file is empty or has no readable text.');
 if(text.length>DOCUMENT_TEXT_LIMIT){truncated=true;text=text.slice(0,DOCUMENT_TEXT_LIMIT);if(/[\uD800-\uDBFF]$/.test(text))text=text.slice(0,-1);}
 return {name:file.name.slice(0,300),text,...(truncated?{truncated:true}:{})};
}
