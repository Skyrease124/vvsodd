import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const schedule=fs.readFileSync('netlify/functions/brain-wayne-scheduled.mjs','utf8');
const worker=fs.readFileSync('netlify/functions/owner-brain-wayne-run.mjs','utf8');
test('published scheduled runner defaults off and requires explicit Netlify env opt in',()=>{
 assert.match(schedule,/schedule:'\*\/30 \* \* \* \*'/);
 assert.match(schedule,/PPA_WAYNE_AUTORUN_ENABLED/);
 assert.match(schedule,/\.get\('PPA_WAYNE_AUTORUN_ENABLED'\)==='true'/);
 assert.match(schedule,/context\.deploy\.published!==true/);
 assert.match(schedule,/context\?\.deploy\?\.context!=='production'/);
});
test('scheduled runner invokes same guarded worker as owner-triggered force button',()=>{
 assert.match(schedule,/import \{runScheduledWayne\} from '\.\/owner-brain-wayne-run\.mjs'/);
 assert.match(schedule,/await runScheduledWayne\(synthetic,context\)/);
 assert.match(worker,/export const runScheduledWayne=auth\.withBrainStore/);
 assert.match(worker,/await publish\(req,context\)/);
 assert.match(worker,/MAX_ATTEMPTS=3, MAX_PER_DAY=30/);
 assert.match(worker,/controlNow\?\.status==='paused'/);
 assert.match(worker,/auth\.kvGet\(OVERLAY\)/);
});
