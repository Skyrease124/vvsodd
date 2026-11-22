import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as auth from '../lib/brain-auth.mjs';
import { connectorFor, connectorReadiness, connectorCoverage } from '../lib/brain-gis-connectors.mjs';

import {countyOperation} from '../lib/brain-gis-universal.mjs';
import {countyCheckpointKey,readCountyBudget,SHARED_COUNTY_DAILY_LIMIT} from '../lib/brain-gis-county-worker.mjs';

const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex'}});
const root=()=>join(process.env.LAMBDA_TASK_ROOT||process.cwd(),'kinvest-liens','map');
const read=async path=>JSON.parse(await readFile(join(root(),path),'utf8'));

async function handler(req) {
  if(req.method!=='GET')return reply(405,{error:'Read only'});
  const user=await auth.userFromCookie(req.headers.get('cookie')||'');
  if(!user?.owner)return reply(user?403:401,{error:'Owner access required'});
  try{
    const {datasets}=await read('index.json');
    const id=new URL(req.url).searchParams.get('dataset');
    if(!id)return reply(200,{counties:datasets.map(d=>({...connectorReadiness(d),operation:countyOperation(d.id)}))});
    const dataset=datasets.find(d=>d.id===id);
    if(!dataset||!/^[-A-Za-z0-9_]+\.json$/.test(dataset.file))return reply(404,{error:'County dataset unavailable'});
    const [data,overlay,trial]=await Promise.all([
      read('data/'+dataset.file), auth.kvGet('brain-map-county-v1-'+id),
      auth.isBrainPreview()&&connectorFor(id)?.mode==='test-only'
        ? auth.kvGet('brain-gis-trial-v1-'+id) : null
    ]);
    if(data.id!==dataset.id||!Array.isArray(data.recs))throw Error('Dataset mismatch');
    const operation=countyOperation(id);
    const coverage=connectorCoverage(data.recs,overlay);
    if(operation?.mode==='existing-worker'){
      const [worker,quota]=await Promise.all([auth.kvGet('owner-brain-wayne-worker-v1'),auth.readWayneGisQuota()]);
      const records=overlay?.records||{};
      Object.assign(operation,{
        progress:worker?.progress||null,lastSuccessfulAt:worker?.lastSuccessfulBatch||null,
        state:worker?.state||'not_started',sourceHealth:worker?.sourcePause||null,
        publicationPending:Object.values(records).some(row=>row?.publicationPending===true),
        pendingReview:Object.values(worker?.reviewQueue||{}).filter(row=>!row.resolvedAt&&!records[row.recordId]?.verifiedGeometry).length,
        quota:{used:quota.active?quota.count:null,limit:30,resumeAt:quota.resumeAt||null}
      });
    }else if(operation){
      const checkpoint=await auth.kvGet(countyCheckpointKey(id));
      Object.assign(operation,{lastSuccessfulAt:checkpoint?.lastSuccessfulAt||null,sourceHealth:checkpoint?.sourceHealth||null});
      if(checkpoint?.totalEligible>0){
        const total=checkpoint.totalEligible,progress=Math.min(total,checkpoint.cursor);
        const budget=await readCountyBudget({read:auth.kvGetVersioned});
        Object.assign(operation,{progress:{total,pending:total-progress,verified:coverage.verified,
          processingPercent:Math.round(10000*progress/total)/100,verifiedPercent:Math.round(10000*coverage.verified/total)/100},
         pendingReview:Object.values(checkpoint.review||{}).filter(row=>!row.resolvedAt).length,
         quota:{used:budget?.total??null,limit:SHARED_COUNTY_DAILY_LIMIT}});
      }
    }
    return reply(200,{county:connectorReadiness(dataset,trial),coverage,operation});
  }catch{
    return reply(503,{error:'County connector data unavailable'});
  }
}
export default auth.withBrainStore(handler);
