// Bound the complete request, including reading JSON, so controls cannot hang forever.
(function(){
 'use strict';
 window.PPABrainRequest=async function(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(url,{...options,signal:controller.signal});
   const body=await response.json();
   return {ok:response.ok,status:response.status,json:async()=>body};
  }catch(error){
   if(controller.signal.aborted)throw Error('Request timed out after 20 seconds. Completion is unknown; refresh the status before trying again.');
   throw error;
  }finally{clearTimeout(timer);}
 };
 window.PPABrainPreviewStatus=function(data){
  if(!data.previewMode)return;
  const byId=id=>document.getElementById(id);
  byId('state').textContent='Preview ready';
  byId('autoState').textContent='Scheduled workers are disabled in this preview.';
  const explanation=byId('autoState').parentElement.querySelector('p.muted');
  if(explanation)explanation.textContent='Waiting longer will not start background research here. This preview uses an isolated test store. The official parcel test runs through the preview controls above; it does not need AI research.';
  for(const id of ['autoSummary','autoGeocode','autoElevation','autoCrosscheck','photonStatus','geoStatus'])byId(id).textContent='Not scheduled in this preview. No background request is loading.';
  byId('pause').disabled=true;byId('resume').disabled=true;
  byId('note').textContent='Preview queue last updated: '+(data.updatedAt||'not yet');
 };
})();
