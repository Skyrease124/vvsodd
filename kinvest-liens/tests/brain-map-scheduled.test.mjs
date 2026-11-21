import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const schedule=fs.readFileSync('netlify/functions/brain-wayne-scheduled.mjs','utf8');
const worker=fs.readFileSync('netlify/functions/owner-brain-wayne-run.mjs','utf8');
test('published scheduled runner defaults off and requires explicit Netlify env opt in',()=>{
 assert.match(schedule,/schedule:'\*\/30 \* \* \* \*'/);
 assert.match(schedule,/owner-brain-wayne-scheduler-control-v1/);
 assert.match(schedule,/setting\?\.enabled===true/);
 assert.match(schedule,/setting\?\.approvedForProduction===true/);
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

test('website scheduler toggle is owner-only, same-origin and production-only',()=>{
 const control=fs.readFileSync('netlify/functions/owner-brain-scheduler-control.mjs','utf8');
 const ownerPage=fs.readFileSync('kinvest-liens/owner/brain/index.html','utf8');
 const ready=fs.readFileSync('netlify/functions/owner-brain-autonomy-status.mjs','utf8');
 assert.match(control,/if\(!user\?\.owner\)/);
 assert.match(control,/if\(!production\)return reply\(403/);
 assert.match(control,/req\.headers\.get\('origin'\)!==new URL\(req\.url\)\.origin/);
 assert.match(control,/body\.confirmed!==true/);
 assert.match(control,/wayne-verified-gis-only/);
 assert.match(control,/enabled:false,approvedForProduction:false/);
 assert.match(ownerPage,/id="unattendedToggle"/);
 assert.match(ownerPage,/owner-brain-scheduler-control/);
 assert.match(ownerPage,/toggle\.hidden=!!d\.preview/);
 assert.match(ready,/websiteControlledSchedule:true/);
});
