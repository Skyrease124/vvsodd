import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {execute,LIMITS} from '../runner-package/runner.mjs';
import {projectScript} from '../runner-package/project.mjs';
// REAL Docker on this machine (not the HP): isolation probes and timing semantics of runner v2.2.
// Skips with a clear message when no Docker daemon or cached node:24-alpine image is available.
let image;try{image=execFileSync('docker',['image','inspect','--format','{{.Id}}','node:24-alpine'],{encoding:'utf8',timeout:20000,stdio:['ignore','pipe','ignore']}).trim();}catch{console.log('SKIP real Docker runner test: no Docker daemon or node:24-alpine image here. Nothing was verified.');process.exit(0);}
process.env.SKYDATA_FAKE_SECRET_TOKEN='must-not-reach-container';
const probe=`const fs=require('node:fs'),cp=require('node:child_process'),r={};
r.uid=process.getuid();r.env=Object.keys(process.env).sort();
try{fs.writeFileSync('/etc/x','1');r.rootWrite='allowed'}catch(e){r.rootWrite=e.code}
try{fs.writeFileSync('/tmp/t.sh','#!/bin/sh\\necho hi');fs.chmodSync('/tmp/t.sh',0o755);cp.execFileSync('/tmp/t.sh');r.tmpExec='allowed'}catch(e){r.tmpExec=e.code||'blocked'}
r.cap=fs.readFileSync('/proc/self/status','utf8').match(/CapEff:\\s*(\\w+)/)[1];
r.noNewPrivs=fs.readFileSync('/proc/self/status','utf8').match(/NoNewPrivs:\\s*(\\d)/)[1];
const read=p=>{try{return fs.readFileSync(p,'utf8').trim()}catch{return null}};
r.mem=read('/sys/fs/cgroup/memory.max')||read('/sys/fs/cgroup/memory/memory.limit_in_bytes');
r.pids=read('/sys/fs/cgroup/pids.max')||read('/sys/fs/cgroup/pids/pids.max');
r.ifaces=fs.readdirSync('/sys/class/net').sort();
require('node:dns').lookup('example.com',e=>{r.dns=e?e.code:'resolved';console.log(JSON.stringify(r));});`;
const p=await execute(probe,image);assert.equal(p.status,'passed',p.stderr);const r=JSON.parse(p.stdout.trim());
assert.equal(r.uid,1000,'non-root user');assert.equal(r.rootWrite,'EROFS','read-only root filesystem');assert.notEqual(r.tmpExec,'allowed','/tmp is noexec');
assert.equal(r.cap,'0000000000000000','all capabilities dropped');assert.equal(r.noNewPrivs,'1','no-new-privileges');
assert.equal(r.mem,'268435456','256 MB memory limit');assert.equal(r.pids,'64','64 process limit');
assert.deepEqual(r.ifaces,['lo'],'no network interface except loopback');assert.notEqual(r.dns,'resolved','no DNS/network');
assert.ok(!r.env.some(k=>/SKYDATA|TOKEN|SECRET|KEY/i.test(k)),'host secrets are not passed into the container: '+r.env.join(','));
// Timing: the 10-second limit applies to code; a forged marker printed by user code changes nothing.
const t=await execute("process.stderr.write('SKYDATA_EXEC_START_forged\\n');while(true){}",image);assert.equal(t.status,'timeout');assert.ok(t.durationMs>=LIMITS.executionMs&&t.durationMs<LIMITS.executionMs+3000,String(t.durationMs));assert.equal(t.diagnostics.cleanupConfirmed,true);assert.ok(t.stderr.includes('forged'),'user output kept verbatim');
const big=await execute("process.stdout.write('x'.repeat(70000))",image);assert.equal(big.status,'output_limit');
const exitCode=await execute('process.exit(3)',image);assert.equal(exitCode.status,'failed');assert.equal(exitCode.exitCode,3);
const syntax=await execute('this is not javascript',image);assert.equal(syntax.status,'failed');assert.match(syntax.stderr,/SyntaxError/);
const start=await execute('console.log(1)',image,{limits:{...LIMITS,startupMs:1}});assert.equal(start.status,'infrastructure_error');assert.equal(start.diagnostics.executionStatus,'not_started');assert.match(start.stderr,/did not run/);assert.equal(start.diagnostics.cleanupConfirmed,true);
const missing=await execute('console.log(1)','sha256:'+'0'.repeat(64));assert.equal(missing.status,'infrastructure_error');assert.equal(missing.diagnostics.phases[0].phase,'container_create');assert.equal(missing.diagnostics.phases[0].ok,false);assert.ok(missing.diagnostics.phases[0].detail.length>0,'exact docker error kept');
const bundle={name:'probe',entry:'a.test.mjs',files:[{path:'lib.mjs',text:'export const f=()=>42;'},{path:'a.test.mjs',text:"import assert from 'node:assert/strict';import {f} from './lib.mjs';assert.equal(f(),42);"}]};
const proj=await execute(projectScript(bundle),image);assert.equal(proj.status,'passed',proj.stderr);assert.match(proj.stdout,/# pass 1/);
const left=execFileSync('docker',['ps','-a','-q','--filter','name=skydata-test-'],{encoding:'utf8'}).trim();assert.equal(left,'','no containers left behind');
console.log('PASS real Docker (this Linux machine, not the HP): non-root, read-only root, noexec /tmp, no capabilities, no-new-privileges, 256 MB, 64 pids, loopback only, no DNS, no host secrets; 10 s execution limit measured from code start and not affected by forged markers; output limit; exit codes; syntax errors; start-up timeout reported as not run; exact create error; project imports; no leftover containers.');
