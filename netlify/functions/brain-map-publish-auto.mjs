// Guarded owner-approved Brain-to-Map publication pilot for Detroit city parcels.
// Uses official current GIS polygon (not geocoded positions) and explicit staging review.
// Writes only the dynamic map overlay store, not static parcel data / tax sale status.
import * as auth from '../lib/auth.mjs';
const APPROVALS='owner-brain-approvals-v1',STATUS='brain-map-publication-status-v1';
const ROOT='https://pricepocketasset.com';
const GIS='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
async function json(url,limit=9000000){
 const r=await fetch(url,{signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('HTTP '+r.status);
 const body=await r.text();if(Buffer.byteLength(body)>limit)throw Error('Response too large');
 const data=JSON.parse(body);if(data.error)throw Error(data.error.message||'Provider error');
 return data;
}
function officialPolygon(rings){
 if(!Array.isArray(rings)||rings.length!==1)return null; // no holes or multipart in pilot
 const ring=rings[0];if(!Array.isArray(ring)||ring.length<4||ring.length>6000)return null;
 const coords=[];let minX=180,minY=90,maxX=-180,maxY=-90;
 for(const p of ring){
  if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))return null;
  const [x,y]=p;
  if(x< -83.4||x> -82.8||y<42.2||y>42.5)return null;
  minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);
  coords.push([x,y]);
 }
 if(coords[0][0]!==coords.at(-1)[0]||coords[0][1]!==coords.at(-1)[1]||maxX-minX>0.02||maxY-minY>0.02)return null;
 if((maxX-minX)<1e-7||(maxY-minY)<1e-7)return null;
 return {g:[coords],bb:[minX,minY,maxX,maxY],cx:[(minX+maxX)/2,(minY+maxY)/2]};
}
export default async function(){
 const last=await auth.kvGet(STATUS)||{runs:0,published:0,skipped:0};
 const status={...last,runs:(last.runs||0)+1,lastStarted:new Date().toISOString(),state:'running',lastError:null};
 await auth.kvPut(STATUS,status);
 let passed=0,skipped=0;
 try{
  const control=await auth.kvGet('owner-brain-scanner-v1');
  if(control?.status==='paused'){status.state='paused';return;}
  const log=await auth.kvGet(APPROVALS)||{entries:[]};
  const approved=(log.entries||[]).filter(x=>x.decision==='approved_for_staging'&&x.dataset==='MI-wayne'&&x.state==='MI'&&x.county&&x.recordId&&x.parcelId);
  if(!approved.length){status.state='waiting_for_approved_polygons';return;}
  const county=await json(ROOT+'/map/data/MI-wayne.json',12000000);
  const source=new Map((county.recs||[]).map(r=>[r.i,r]));
  const key='brain-map-county-v1-MI-wayne';
  const saved=await auth.kvGet(key)||{version:0,records:{}};
  for(const a of approved.slice(0,5)){
   if(saved.records[a.recordId]||a.proposedPosition?.lat==null||a.proposedPosition?.lon==null)continue;
   const original=source.get(a.recordId);
   if(!original||original.g||original.cx||norm(original.p)!==norm(a.parcelId)){skipped++;continue;}
   if(!a.evidenceUrl||!/^https:\/\/(?:services2\.arcgis\.com|detroitmi\.gov|data\.detroitmi\.gov)\//i.test(a.evidenceUrl)){skipped++;continue;}
   if(a.independentlyChecked!==true){skipped++;continue;}
   const clause="parcel_number = '"+String(a.parcelId).replace(/'/g,"''").slice(0,70)+"'";
   const url=GIS+'/query?'+new URLSearchParams({f:'json',where:clause,outFields:'parcel_number,address,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'});
   let result;
   try{result=await json(url,1000000)}catch(e){status.lastError=String(e.message).slice(0,120);break;}
   const fs=result.features||[];
   if(fs.length!==1||norm(fs[0].attributes?.parcel_number)!==norm(a.parcelId)){skipped++;continue;}
   const poly=officialPolygon(fs[0].geometry?.rings);
   if(!poly){skipped++;continue;}
   // Owner's previously reviewed GIS position must be close to the freshly retrieved official polygon.
   if(Math.abs(a.proposedPosition.lat-poly.cx[1])>0.002||Math.abs(a.proposedPosition.lon-poly.cx[0])>0.002){skipped++;continue;}
   const stamp=new Date().toISOString();
   const record={i:a.recordId,p:String(a.parcelId),...poly,verifiedGeometry:true,verifiedAt:stamp,evidenceUrl:GIS,caseKey:a.caseKey};
   // Reload before write to avoid overwriting other functions' published records.
   const current=await auth.kvGet(key)||{version:0,records:{}};
   if(current.records[a.recordId])continue;
   const updated={...current,version:(current.version||0)+1,updatedAt:stamp,records:{...current.records,[a.recordId]:record}};
   await auth.kvPut(key,updated);
   const history=await auth.kvGet('brain-map-history-v1')||{entries:[]};
   history.entries=[{dataset:'MI-wayne',recordId:a.recordId,parcelId:a.parcelId,action:'published',source:'official Detroit current parcel GIS',reviewCase:a.caseKey,at:stamp},...(history.entries||[])].slice(0,300);
   await auth.kvPut('brain-map-history-v1',history);
   passed++;
  }
  status.published=(status.published||0)+passed;
  status.skipped=(status.skipped||0)+skipped;
  status.lastBatch={published:passed,skipped};
  if(status.state==='running')status.state='idle';
 }catch(e){status.state='error';status.lastError=String(e.message).slice(0,140);}
 finally{status.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,status);}
}
export const config={schedule:'35 */4 * * *'};
