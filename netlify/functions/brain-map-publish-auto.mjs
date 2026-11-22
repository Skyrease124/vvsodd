// Guarded owner-approved Brain-to-Map publication pilot for Detroit city parcels.
// Uses official current GIS polygon (not geocoded positions) and explicit staging review.
// Writes only the dynamic map overlay store, not static parcel data / tax sale status.
import * as auth from '../lib/brain-auth.mjs';
const APPROVALS='owner-brain-approvals-v1',STATUS='brain-map-publication-status-v1';
const ROOT='https://pricepocketasset.com';
const GIS='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Parcels_Current/FeatureServer/0';
const norm=s=>String(s??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
async function json(url,limit=9000000,redirect='follow'){
 const r=await fetch(url,{signal:AbortSignal.timeout(9000),redirect});
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
async function handler(req,context){
 // Only the guarded Wayne worker may invoke publication. Public function requests cannot publish.
 if(context?.waynePublisherInternal!==true||typeof context.chargeWayneGisRequest!=='function')
  return new Response(JSON.stringify({ok:false,error:'Publisher is internal to guarded Wayne worker'}),{status:403,headers:{'Content-Type':'application/json'}});
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
  for(const a of approved.filter(a=>!saved.records[a.recordId]).slice(0,5)){
   if(saved.records[a.recordId])continue;
   const lat=a.proposedPosition?.lat,lon=a.proposedPosition?.lon;
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<42.2||lat>42.5||lon< -83.4||lon> -82.8){skipped++;continue;}
   const original=source.get(a.recordId);
   if(!original||original.g||original.cx||norm(original.p)!==norm(a.parcelId)){skipped++;continue;}
   if(!a.evidenceUrl||!/^https:\/\/(?:services2\.arcgis\.com|detroitmi\.gov|data\.detroitmi\.gov)\//i.test(a.evidenceUrl)){skipped++;continue;}
   if(a.independentlyChecked!==true){skipped++;continue;}
   // Detroit GIS uses a trailing period on some tax parcel IDs. Accept only
   // the exact identifier or that known variant; never use a prefix match.
   const parcel=String(a.parcelId);
   if(!/^[0-9]{8}\.?$/.test(parcel)){skipped++;continue;}
   const bare=parcel.replace(/\.$/,'');
   // Prefer the indexed object ID already established by the independent
   // verifier. Old owner-reviewed approvals still use the bounded legacy query.
   const objectId=a.officialObjectId;
   const indexed=Number.isSafeInteger(objectId)&&objectId>0;
   if(objectId!=null&&!indexed){skipped++;continue;}
   const clause=indexed?'object_id='+objectId:"parcel_number IN ('"+bare+"','"+bare+".')";
   const params={f:'json',where:clause,outFields:'parcel_number,address,object_id',returnGeometry:'true',outSR:'4326',resultRecordCount:'3'};
   if(!indexed){
    const envelope=JSON.stringify({xmin:lon-0.002,ymin:lat-0.002,xmax:lon+0.002,ymax:lat+0.002,spatialReference:{wkid:4326}});
    Object.assign(params,{geometry:envelope,geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects'});
   }
   const url=GIS+'/query?'+new URLSearchParams(params);
   let result;
   try{
    // Charge before dispatch, including failed GIS requests. The worker owns the shared daily cap.
    await context.chargeWayneGisRequest();
    result=await json(url,1000000,'error');
   }catch(e){status.lastError=String(e.message).slice(0,120);break;}
   // A pause can happen while awaiting the remote provider. Nothing may
   // publish after the pause, even if the GIS request succeeds.
   const latestControl=await auth.kvGet('owner-brain-scanner-v1');
   if(latestControl?.status==='paused'){status.state='paused';break;}
   const fs=result.features||[];
   if(fs.length!==1||norm(fs[0].attributes?.parcel_number)!==norm(a.parcelId)||indexed&&fs[0].attributes?.object_id!==objectId){skipped++;continue;}
   const poly=officialPolygon(fs[0].geometry?.rings);
   if(!poly){skipped++;continue;}
   // Owner's previously reviewed GIS position must be close to the freshly retrieved official polygon.
   if(Math.abs(a.proposedPosition.lat-poly.cx[1])>0.002||Math.abs(a.proposedPosition.lon-poly.cx[0])>0.002){skipped++;continue;}
   const stamp=new Date().toISOString();
   const record={i:a.recordId,p:String(a.parcelId),...poly,verifiedGeometry:true,verifiedAt:stamp,evidenceUrl:GIS,caseKey:a.caseKey};
   // Reload before write to avoid overwriting other functions' published records.
   const preWriteControl=await auth.kvGet('owner-brain-scanner-v1');
   if(preWriteControl?.status==='paused'){status.state='paused';break;}
   const current=await auth.kvGet(key)||{version:0,records:{}};
   if(current.records[a.recordId])continue;
   const updated={...current,version:(current.version||0)+1,updatedAt:stamp,records:{...current.records,[a.recordId]:record}};
   await auth.kvPut(key,updated);
   const history=await auth.kvGet('brain-map-history-v1')||{entries:[]};
   history.entries=[{dataset:'MI-wayne',recordId:a.recordId,parcelId:a.parcelId,action:'published',source:'official Detroit current parcel GIS',reviewCase:a.caseKey,at:stamp},...(history.entries||[])].slice(0,300);
   await auth.kvPut('brain-map-history-v1',history);
   const decisions=await auth.kvGet(APPROVALS);
   const decision=decisions?.entries?.find(e=>e.caseKey===a.caseKey);
   if(decision){decision.publishStatus='published';decision.publishedAt=stamp;await auth.kvPut(APPROVALS,decisions);}
   const queue=await auth.kvGet('owner-brain-scanner-v1');
   const item=queue?.queue?.find(r=>r.dataset==='MI-wayne'&&r.recordId===a.recordId);
   if(item?.review){item.review.publishStatus='published';await auth.kvPut('owner-brain-scanner-v1',queue);}
   passed++;
  }
  status.published=(status.published||0)+passed;
  status.skipped=(status.skipped||0)+skipped;
  status.lastBatch={published:passed,skipped};
  if(status.state==='running')status.state='idle';
 }catch(e){status.state='error';status.lastError=String(e.message).slice(0,140);}
 finally{status.lastCompleted=new Date().toISOString();await auth.kvPut(STATUS,status);}
}
// No independent production schedule: publish only as part of a verified Wayne worker batch.


export default auth.withBrainStore(handler);
