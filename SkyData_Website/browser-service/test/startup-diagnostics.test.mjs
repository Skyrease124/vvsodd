import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startupDiagnostics} from '../startup-diagnostics.mjs';
test('startup log is bounded, redacts credentials and tolerates absent logs',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'chrome-log-'));const path=join(dir,'stderr');
 try{
  assert.equal(await startupDiagnostics(path),'');
  await writeFile(path,'Crashpad failed '+ 'a'.repeat(64)+' Bearer secret-token AIzaSensitiveKey sk-private '+ 'x'.repeat(20000));
  const log=await startupDiagnostics(path);
  assert.match(log,/Crashpad failed/);assert.ok(log.length<=8192);for(const secret of ['a'.repeat(64),'secret-token','AIzaSensitiveKey','sk-private'])assert.ok(!log.includes(secret));
 }finally{await rm(dir,{recursive:true,force:true});}
});
