import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as auth from '../lib/brain-auth.mjs';
import { connectorFor, connectorReadiness, connectorCoverage } from '../lib/brain-gis-connectors.mjs';

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
    if(!id)return reply(200,{counties:datasets.map(d=>connectorReadiness(d))});
    const dataset=datasets.find(d=>d.id===id);
    if(!dataset||!/^[-A-Za-z0-9_]+\.json$/.test(dataset.file))return reply(404,{error:'County dataset unavailable'});
    const [data,overlay,trial]=await Promise.all([
      read('data/'+dataset.file), auth.kvGet('brain-map-county-v1-'+id),
      auth.isBrainPreview()&&connectorFor(id)?.mode==='test-only'
        ? auth.kvGet('brain-gis-trial-v1-'+id) : null
    ]);
    if(data.id!==dataset.id||!Array.isArray(data.recs))throw Error('Dataset mismatch');
    return reply(200,{county:connectorReadiness(dataset,trial),coverage:connectorCoverage(data.recs,overlay)});
  }catch{
    return reply(503,{error:'County connector data unavailable'});
  }
}
export default auth.withBrainStore(handler);
