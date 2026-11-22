import { larimerSources } from './brain-reconciliation-research.mjs';

const descriptions=Object.freeze({
 assessor:{title:'Free Property Search',data:'Parcel and account search instructions',restriction:'Parcel lineage requires an official record; this action does not submit search forms.'},
 treasurer:{title:'Tax Lien Sale',data:'Tax sale and account research entry point',restriction:'This action reads public metadata only and does not download attachments.'},
 recorder:{title:'Easy Access',data:'Recorded-document index and image-access instructions',restriction:'Document images can require authorized access. This action does not enter the records portal.'}
});
export const sourceDescriptors=Object.freeze([
 ...larimerSources.map(s=>Object.freeze({...s,...descriptions[s.id],evidenceType:'public_access_metadata',ownerConfirmation:true})),
 Object.freeze({id:'planning',authority:'Fort Collins Planning',url:'https://www.fcgov.com/developmentreview/',
   data:'Planning records',restriction:'Prior case-specific test; no repeat through this controller.',evidenceType:'planning_metadata',limit:0}),
 Object.freeze({id:'gis',authority:'Larimer County Tax Parcels',url:'https://maps1.larimer.org/arcgis/rest/services/MapServices/Parcels/MapServer/3',
   data:'Parcel layer and cadastral fields',restriction:'GIS trial exhausted; no requests through this controller.',evidenceType:'parcel_layer',limit:0})
]);

async function limitedText(res){
 const reader=res.body?.getReader();
 if(!reader)return '';
 const decoder=new TextDecoder();
 let size=0,html='';
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)return html+decoder.decode();
   size+=value.byteLength;
   if(size>512*1024)throw Error('Response exceeds limit');
   html+=decoder.decode(value,{stream:true});
  }
 }finally{await reader.cancel().catch(()=>{});}
}

export async function collectSourceMetadata(source,_record,{signal,fetcher=fetch}={}){
 const approved=larimerSources.find(s=>s.id===source?.id&&s.url===source?.url);
 if(!approved||!Object.hasOwn(descriptions,source.id))throw Error('Source adapter is not approved');
 const expected=descriptions[source.id];
 let httpStatus=null;
 try{
  const res=await fetcher(approved.url,{method:'GET',redirect:'manual',credentials:'omit',signal:signal??AbortSignal.timeout(8000),
   headers:{Accept:'text/html'}});
  httpStatus=res.status;
  if([301,302,303,307,308,401,403,451].includes(httpStatus))return {status:'restricted',httpStatus};
  if([404,410].includes(httpStatus))return {status:'missing',httpStatus};
  if(!res.ok||!res.headers.get('content-type')?.toLowerCase().startsWith('text/html'))return {status:'unavailable',httpStatus};
  const html=await limitedText(res);
  const text=html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  if(/verify (?:that )?you are human|access denied|sign in to (?:continue|view this record)/i.test(text))return {status:'restricted',httpStatus};
  if(!text.toLowerCase().includes(expected.title.toLowerCase()))return {status:'missing',httpStatus};
  return {status:'metadata',httpStatus,metadata:{title:expected.title,imageAccess:source.id==='recorder'?'authorized_access_required':'not_checked'}};
 }catch{return {status:'unavailable',httpStatus};}
}
