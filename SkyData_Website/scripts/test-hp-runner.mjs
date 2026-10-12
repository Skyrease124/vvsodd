import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {execute,containerArgs,validJob} from '../runner-package/runner.mjs';
const args=containerArgs('test','sha256:abc');
for(const flag of ['--network','--memory','--memory-swap','--cpus','--pids-limit','--read-only','--cap-drop','--security-opt','--user','--pull'])assert.ok(args.includes(flag));
assert.equal(args[args.indexOf('--network')+1],'none');assert.equal(args[args.indexOf('--pull')+1],'never');assert.ok(!args.includes('--mount'));assert.ok(!args.includes('--privileged'));
assert.ok(validJob({id:crypto.randomUUID(),code:'console.log(4)',expires:Date.now()+10000}));assert.ok(!validJob({id:'anything',code:'',expires:0}));assert.ok(!validJob({id:crypto.randomUUID(),code:'x'.repeat(16001),expires:Date.now()+10000}));
function fake({exit=0,text='PASS',hang=false,large=false,error=false}={}){return (cmd,a,o)=>{assert.equal(cmd,'docker');assert.equal(o.shell,false);assert.ok(!Object.keys(o.env).some(k=>/TOKEN|KEY|SECRET/.test(k)));const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new PassThrough();c.kill=()=>{setImmediate(()=>c.emit('close',null));return true;};setImmediate(()=>{if(error)return c.emit('error',Error('fail'));if(large)c.stdout.write(Buffer.alloc(61000));else c.stdout.write(text);if(!hang&&!large)c.emit('close',exit);});return c;};}
let removed=0;const remove=async()=>{removed++;};
assert.equal((await execute('test','image',{spawnProcess:fake(),remove})).status,'passed');
assert.equal((await execute('test','image',{spawnProcess:fake({exit:1}),remove})).status,'failed');
assert.equal((await execute('test','image',{spawnProcess:fake({hang:true}),remove,timeoutMs:20})).status,'timeout');
assert.equal((await execute('test','image',{spawnProcess:fake({large:true}),remove})).status,'output_limit');
assert.equal((await execute('test','image',{spawnProcess:fake({error:true}),remove})).status,'infrastructure_error');
assert.equal((await execute('test','image',{spawnProcess:fake(),remove:async()=>{throw Error();}})).status,'infrastructure_error');
assert.equal(removed,5);
console.log('PASS runner process contract: success, assertion failure, timeout, output limit, spawn failure, cleanup failure, payload validation, and restricted Docker arguments. Docker process mocked; real container checks await HP self-test.');
