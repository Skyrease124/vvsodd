import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceDiagnostics} from '../resource-diagnostics.mjs';
test('resource snapshot is bounded, numeric or null, and never throws',async()=>{
 const r=await resourceDiagnostics();
 assert.ok(['v1','v2'].includes(r.cgroup));
 for(const v of [r.pids.current,r.memory.currentMB])assert.ok(v===null||typeof v==='number');
 assert.ok(r.pids.max===null||r.pids.max==='max'||typeof r.pids.max==='number');
 assert.ok(r.tasks===null||r.tasks.threads>=r.tasks.processes&&Object.keys(r.tasks.threadsByName).length<=8);
 assert.ok(JSON.stringify(r).length<4000,'small enough for a failure report');
});
