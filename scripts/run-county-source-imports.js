'use strict';
/**
 * Scheduled county source ingestion. Downloads only explicitly approved HTTPS JSON feeds.
 * Writes staged files, never live map data. Human review required before publishing.
 */
const fs=require('node:fs/promises');
const path=require('node:path');
const {validateCountyImport}=require('../netlify/lib/county-import-validation');
const {checkMapDataset}=require('./check-map-datasets');
const MAX_BYTES=15*1024*1024;
const safeSegment=s=>/^[a-z0-9-]+$/i.test(s);
async function fetchJSON(url,fetcher=fetch){
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port||!parsed.hostname||/^(localhost|.*\.local)$/i.test(parsed.hostname))throw Error('Only approved public HTTPS endpoints are allowed');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetcher(url,{redirect:'error',signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw Error('HTTP '+response.status);
    const declared=Number(response.headers.get('content-length')||0);
    if(declared>MAX_BYTES)throw Error('Source exceeds size limit');
    const reader=response.body.getReader();let total=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_BYTES){await reader.cancel();throw Error('Source exceeds size limit')}chunks.push(value)}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }finally{clearTimeout(timer)}
}
async function run(manifest,options={}){
  if(!Array.isArray(manifest))throw Error('Manifest must be an array');
  const results=[];
  for(const source of manifest){
    const {id,state,county,url,format}=source;
    if(!safeSegment(id)||!/^[A-Z]{2}$/.test(state)||typeof county!=='string'||!county.trim()||!['records','map'].includes(format))throw Error('Invalid source manifest entry');
    try{
      const data=await fetchJSON(url,options.fetcher);
      let report;
      if(format==='records'){
        const result=validateCountyImport(data,{state,county});
        report={summary:result.summary,errors:result.rejected.slice(0,30),ok:result.readyToPublish};
      }else{
        const checked=checkMapDataset(data,id+'.json');
        report={summary:{received:checked.count,state,county},errors:checked.errors,ok:checked.errors.length===0&&checked.count>0&&data.state===state&&data.county===county};
      }
      if(report.ok){
        const output=path.join(options.outputDir||'county-import-staging',id+'.json');
        await fs.mkdir(path.dirname(output),{recursive:true});
        await fs.writeFile(output,JSON.stringify({source:{id,state,county,url,format},checkedAt:new Date().toISOString(),data},null,2)+'\n');
      }
      results.push({id,...report});
    }catch(e){results.push({id,ok:false,errors:[String(e.message)]})}
  }
  return results;
}
module.exports={run,fetchJSON};
if(require.main===module)(async()=>{
  const manifest=JSON.parse(await fs.readFile(process.argv[2]||'county-sources.json','utf8'));
  const reports=await run(manifest);
  console.log(JSON.stringify(reports,null,2));
  if(reports.some(r=>!r.ok))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
