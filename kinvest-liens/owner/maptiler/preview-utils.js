(function(root){
 'use strict';
 const count=(dataset,counts={})=>Math.min(Number.isFinite(Number(dataset.records))?Math.max(0,Number(dataset.records)):Infinity,Math.max(0,Number(dataset.mapped)||0)+Math.max(0,Number(counts[dataset.id])||0));
 function errorMessage(error,origin,key=''){
  const status=Number(error?.status)||0;
  if(status===401)return 'MapTiler rejected the API key (HTTP 401). The parcel correction feed is separate and remains available.';
  if(status===403)return 'MapTiler refused this request (HTTP 403). Check key origin restrictions and plan access for '+origin+'.';
  if(status===404)return 'The selected MapTiler style or tile resource was not found (HTTP 404).';
  if(status===429)return 'MapTiler rate or usage quota reached (HTTP 429).';
  let message=String(error?.message||'Unknown map error');
  if(key)message=message.split(key).join('[hidden]');
  message=message.replace(/([?&]key=)[^\s&"']+/gi,'$1[hidden]');
  if(/webgl|graphics context/i.test(message))return 'This browser could not initialize WebGL graphics. The verified parcel data is available, but the interactive map cannot render here.';
  if(error?.name==='AbortError'||error?.name==='TimeoutError')return 'The MapTiler request timed out. No map was confirmed loaded.';
  return 'Map preview could not load: '+message.slice(0,220);
 }
 function visibleParcels(records){
  const corrections=[],baseline=[];
  for(const record of records){
   if(!record.g||!record.cx)continue;
   if(record.__brainMap)corrections.push(record);
   else if(baseline.length<250)baseline.push(record);
  }
  return [...corrections,...baseline.slice(0,Math.max(0,250-corrections.length))];
 }
 const api={count,errorMessage,visibleParcels};
 if(typeof module!=='undefined')module.exports=api;
 root.PPAMapTilerPreview=api;
})(typeof window!=='undefined'?window:globalThis);
