import {readFile,rename,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {importLandBatch,landSummary} from '../../netlify/lib/brain-florida-land.mjs';

const [batchFile,checkpoint,limit]=process.argv.slice(2);
if(!batchFile||!checkpoint)throw Error('Usage: node import.mjs BATCH.json CHECKPOINT.json [ROW_LIMIT]');
const input=JSON.parse(await readFile(batchFile,'utf8'));
const previous=await readFile(checkpoint,'utf8').then(JSON.parse).catch(error=>{
 if(error.code!=='ENOENT')throw error;
 return null;
});
const {state,receipt}=importLandBatch(previous,input,{limit:limit===undefined?undefined:Number(limit)});
const temp=checkpoint+'.'+randomUUID()+'.tmp';
await writeFile(temp,JSON.stringify(state),{mode:0o600,flag:'wx'});
await rename(temp,checkpoint);
const {ingested,matched,unmatched,requests,published}=landSummary(state);
console.log(JSON.stringify({receipt:state.receipts[receipt],ingested,matched,unmatched,requests,published},null,2));
