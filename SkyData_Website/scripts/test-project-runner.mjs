import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {rmSync} from 'node:fs';
import {safePath,validBundle,projectScript,PROJECT_PREFIX} from '../runner-package/project.mjs';
import {validJob} from '../runner-package/runner.mjs';
for(const p of ['../escape.js','/root.js','C:/a.js','a\\b.js','a/../b.js','.env.json','x/credentials.json','node_modules/a.js','x//y.js','a\0.js'])assert.equal(safePath(p),false,p);
const b={name:'fixture.zip',entry:'src/math.test.mjs',files:[{path:'src/math.mjs',text:'export const add=(a,b)=>a+b;'},{path:'src/math.test.mjs',text:"import {add} from './math.mjs';import assert from 'node:assert/strict';assert.equal(add(2,2),4);"}]};
assert.ok(validBundle(b));assert.ok(!validBundle({...b,files:[...b.files,b.files[0]]}));assert.ok(!validBundle({...b,entry:'missing.js'}));assert.ok(!validBundle({...b,files:[{path:'src/math.test.mjs',text:'x'.repeat(400001)}]}));
assert.ok(validJob({id:crypto.randomUUID(),code:PROJECT_PREFIX+JSON.stringify(b),expires:Date.now()+10000}));assert.ok(!validJob({id:crypto.randomUUID(),code:PROJECT_PREFIX+'{bad',expires:Date.now()+10000}));
// Run only our own fixed fixtures, using the same generated Node harness.
const run=bundle=>spawnSync(process.execPath,['-'],{input:projectScript(bundle),encoding:'utf8',timeout:10000});
const pass=run(b);assert.equal(pass.status,0,pass.stderr);assert.match(pass.stdout,/# fail 0/);
const bad=run({...b,files:b.files.map(f=>({...f,text:f.text.replace('add(2,2),4','add(2,2),5')}))});assert.equal(bad.status,1);assert.match(bad.stdout,/# fail 1/);
const missing=run({...b,files:[b.files[1]]});assert.equal(missing.status,1);assert.match(missing.stdout,/ERR_MODULE_NOT_FOUND/);
console.log('PASS project validation, relative imports, real Node passing/failing tests and missing-file errors. No Docker isolation claim from these local fixtures.');
