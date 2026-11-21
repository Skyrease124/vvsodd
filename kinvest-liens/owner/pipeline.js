(async()=>{
 try{
  const response=await fetch('/.netlify/functions/owner-brain-pipeline',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)return;const state=await response.json();
  const panel=document.createElement('section');panel.className='panel';panel.style.cssText='border:1px solid #345361;border-radius:16px;padding:18px;margin:16px 0;background:#112d3c;color:#edf7fa';
  const heading=document.createElement('h2');heading.textContent='Shared research pipeline';
  const counts=document.createElement('p');counts.textContent=state.sources+' source records · '+state.queued+' parcel cases · '+state.verified+' verified decisions · '+state.published+' published corrections';
  const flow=document.createElement('p');flow.textContent='Coverage gaps → source evidence → Brain verification → all maps → updated coverage';
  const note=document.createElement('p');note.textContent=state.scope;
  panel.append(heading,counts,flow,note);
  for(const [label,url] of [['Intelligence Center','/owner/intelligence/'],['AI Brain','/owner/brain/'],['Map Coverage & Repair','/owner/map-coverage/'],['MapTiler Preview','/owner/maptiler/']]){
   const a=document.createElement('a');a.href=url;a.textContent=label;a.style.cssText='color:#86e7cd;display:inline-block;margin:5px 15px 5px 0';panel.append(a);
  }
  const main=document.querySelector('main');if(main)main.prepend(panel);
 }catch{/* The primary dashboard retains its own access and error messages. */}
})();
